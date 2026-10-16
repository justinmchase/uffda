//! `#[derive(Collect)]` and `Rootable!` support for `uffda-heap`.
//!
//! Adapted from `gc-arena-derive` 0.7.0 (MIT OR Apache-2.0) so that generated
//! code names only `::uffda_heap`, never a specific collector crate.

use proc_macro2::{Span, TokenStream};
use quote::{ToTokens, quote, quote_spanned};
use syn::{
    parse::{Parse, ParseStream},
    spanned::Spanned,
    visit_mut::VisitMut,
};
use synstructure::{AddBounds, decl_derive};

fn collect_derive(s: synstructure::Structure) -> TokenStream {
    fn find_collect_meta(attrs: &[syn::Attribute]) -> syn::Result<Option<&syn::Attribute>> {
        let mut found = None;
        for attr in attrs {
            if attr.path().is_ident("collect") && found.replace(attr).is_some() {
                return Err(syn::parse::Error::new_spanned(
                    attr.path(),
                    "Cannot specify multiple `#[collect]` attributes! Consider merging them.",
                ));
            }
        }
        Ok(found)
    }

    // A `Drop` impl may observe garbage-collected pointers that were already
    // freed in the same sweep, so every derive must pick a mode that rules that
    // out: the type is `'static`, has no `Drop` impl, or explicitly opts in.
    #[derive(PartialEq)]
    enum Mode {
        RequireStatic,
        NoDrop,
        UnsafeDrop,
    }

    let mut mode = None;
    let mut override_bound = None;
    let mut gc_lifetime = None;

    fn usage_error(meta: &syn::meta::ParseNestedMeta, msg: &str) -> syn::parse::Error {
        meta.error(format_args!(
            "{msg}. `#[collect(...)]` requires one mode (`require_static`, `no_drop`, or `unsafe_drop`) and optionally `bound = \"...\"`."
        ))
    }

    let result = match find_collect_meta(&s.ast().attrs) {
        Ok(Some(attr)) => attr.parse_nested_meta(|meta| {
            if meta.path.is_ident("bound") {
                if override_bound.is_some() {
                    return Err(usage_error(&meta, "multiple bounds specified"));
                }
                let lit: syn::LitStr = meta.value()?.parse()?;
                override_bound = Some(lit);
                return Ok(());
            }
            if meta.path.is_ident("gc_lifetime") {
                if gc_lifetime.is_some() {
                    return Err(usage_error(&meta, "multiple `'gc` lifetimes specified"));
                }
                let lit: syn::Lifetime = meta.value()?.parse()?;
                gc_lifetime = Some(lit);
                return Ok(());
            }
            meta.input.parse::<syn::parse::Nothing>()?;
            if mode.is_some() {
                return Err(usage_error(&meta, "multiple modes specified"));
            } else if meta.path.is_ident("require_static") {
                mode = Some(Mode::RequireStatic);
            } else if meta.path.is_ident("no_drop") {
                mode = Some(Mode::NoDrop);
            } else if meta.path.is_ident("unsafe_drop") {
                mode = Some(Mode::UnsafeDrop);
            } else {
                return Err(usage_error(&meta, "unknown option"));
            }
            Ok(())
        }),
        Ok(None) => Ok(()),
        Err(err) => Err(err),
    };
    if let Err(err) = result {
        return err.to_compile_error();
    }

    let Some(mode) = mode else {
        panic!("deriving `Collect` requires a `#[collect(...)]` attribute");
    };

    let where_clause = if mode == Mode::RequireStatic {
        quote!(where Self: 'static)
    } else {
        override_bound
            .as_ref()
            .map(|x| {
                x.parse()
                    .expect("`#[collect]` failed to parse explicit trait bound expression")
            })
            .unwrap_or_else(|| quote!())
    };

    let mut errors = vec![];

    let collect_impl = if mode == Mode::RequireStatic {
        let mut impl_struct = s.clone();
        impl_struct.add_bounds(AddBounds::None);
        impl_struct.gen_impl(quote! {
            gen unsafe impl<'gc> ::uffda_heap::Collect<'gc> for @Self #where_clause {
                const NEEDS_TRACE: bool = false;
            }
        })
    } else {
        let mut impl_struct = s.clone();
        let mut needs_trace_expr = TokenStream::new();
        quote!(false).to_tokens(&mut needs_trace_expr);
        let mut static_bindings = vec![];

        // Fields marked `#[collect(require_static)]` get a `'static` bound, which
        // guarantees they hold no `Gc` pointers and may be skipped when tracing.
        impl_struct.filter(|b| match find_collect_meta(&b.ast().attrs) {
            Ok(Some(attr)) => {
                let mut static_binding = false;
                let result = attr.parse_nested_meta(|meta| {
                    if meta.input.is_empty() && meta.path.is_ident("require_static") {
                        static_binding = true;
                        static_bindings.push(b.ast().ty.clone());
                        Ok(())
                    } else {
                        Err(meta.error("Only `#[collect(require_static)]` is supported on a field"))
                    }
                });
                errors.extend(result.err());
                !static_binding
            }
            Ok(None) => true,
            Err(err) => {
                errors.push(err);
                true
            }
        });

        for static_binding in static_bindings {
            impl_struct.add_where_predicate(syn::parse_quote! { #static_binding: 'static });
        }

        if let syn::Data::Enum(..) = impl_struct.ast().data {
            for v in impl_struct.variants() {
                for attr in v.ast().attrs {
                    if attr.path().is_ident("collect") {
                        errors.push(syn::parse::Error::new_spanned(
                            attr.path(),
                            "`#[collect]` is not supported on enum variants",
                        ));
                    }
                }
            }
        }

        for v in impl_struct.variants() {
            for b in v.bindings() {
                let ty = &b.ast().ty;
                let call_span = b.ast().span().resolved_at(Span::call_site());
                quote_spanned!(call_span=>
                    || <#ty as ::uffda_heap::Collect>::NEEDS_TRACE
                )
                .to_tokens(&mut needs_trace_expr);
            }
        }
        let trace_body = impl_struct.each(|bi| {
            let call_span = bi.ast().span().resolved_at(Span::call_site());
            quote_spanned!(call_span=>
                {
                    let bi = #bi;
                    cc.trace(bi);
                }
            )
        });

        if gc_lifetime.is_none() {
            let mut all_lifetimes =
                impl_struct
                    .ast()
                    .generics
                    .params
                    .iter()
                    .filter_map(|p| match p {
                        syn::GenericParam::Lifetime(lt) => Some(lt),
                        _ => None,
                    });
            if let Some(lt) = all_lifetimes.next() {
                if all_lifetimes.next().is_none() {
                    gc_lifetime = Some(lt.lifetime.clone());
                } else {
                    panic!(
                        "deriving `Collect` on a type with multiple lifetime parameters requires a `#[collect(gc_lifetime = ...)]` attribute"
                    );
                }
            }
        };

        if override_bound.is_some() {
            impl_struct.add_bounds(AddBounds::None);
        } else {
            impl_struct.add_bounds(AddBounds::Generics);
        };

        if let Some(gc_lifetime) = gc_lifetime {
            impl_struct.gen_impl(quote! {
                gen unsafe impl ::uffda_heap::Collect<#gc_lifetime> for @Self #where_clause {
                    const NEEDS_TRACE: bool = #needs_trace_expr;

                    #[inline]
                    fn trace<Trace: ::uffda_heap::Trace<#gc_lifetime>>(&self, cc: &mut Trace) {
                        match *self { #trace_body }
                    }
                }
            })
        } else {
            impl_struct.gen_impl(quote! {
                gen unsafe impl<'gc> ::uffda_heap::Collect<'gc> for @Self #where_clause {
                    const NEEDS_TRACE: bool = #needs_trace_expr;

                    #[inline]
                    fn trace<Trace: ::uffda_heap::Trace<'gc>>(&self, cc: &mut Trace) {
                        match *self { #trace_body }
                    }
                }
            })
        }
    };

    let drop_impl = if mode == Mode::NoDrop {
        let mut drop_struct = s.clone();
        drop_struct.add_bounds(AddBounds::None).gen_impl(quote! {
            gen impl ::uffda_heap::__MustNotImplDrop for @Self {}
        })
    } else {
        quote!()
    };

    let errors = errors.into_iter().map(|e| e.to_compile_error());
    quote! {
        #collect_impl
        #drop_impl
        #(#errors)*
    }
}

decl_derive! {
    [Collect, attributes(collect)] =>
    /// Derives `uffda_heap::Collect`.
    ///
    /// The type must declare one mode with `#[collect(...)]`:
    ///
    /// - `require_static` - the type is `'static`, holds no `Gc` pointers and is
    ///   never traced.
    /// - `no_drop` - the type has no `Drop` impl; every field is traced.
    /// - `unsafe_drop` - the type has a `Drop` impl that must not dereference
    ///   any `Gc` pointer.
    ///
    /// Optional settings: `bound = "where ..."` replaces the generated bounds and
    /// `gc_lifetime = 'gc` picks the collector lifetime when a type has several.
    /// A field may be marked `#[collect(require_static)]` to skip tracing it.
    collect_derive
}

/// Replaces every `'_` lifetime in a type with the given lifetime. Not public
/// API; used by `uffda_heap::Rootable!`. Syntax: `__unelide_lifetimes!('lt; Type)`.
#[doc(hidden)]
#[proc_macro]
pub fn __unelide_lifetimes(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    struct Input {
        lt: syn::Lifetime,
        ty: syn::Type,
    }

    impl Parse for Input {
        fn parse(input: ParseStream) -> syn::Result<Self> {
            let lt: syn::Lifetime = input.parse()?;
            let _: syn::Token!(;) = input.parse()?;
            let ty: syn::Type = input.parse()?;
            Ok(Self { lt, ty })
        }
    }

    struct UnelideLifetimes(syn::Lifetime);

    impl VisitMut for UnelideLifetimes {
        fn visit_lifetime_mut(&mut self, i: &mut syn::Lifetime) {
            if i.ident == "_" {
                *i = self.0.clone();
            }
        }
    }

    let mut input = syn::parse_macro_input!(input as Input);
    UnelideLifetimes(input.lt).visit_type_mut(&mut input.ty);
    input.ty.to_token_stream().into()
}
