use crate::value::Value;
use gc_arena::{Collect, Gc, Mutation};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Collect)]
#[collect(require_static)]
pub struct Origin {
    pub start: usize,
    pub end: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Collect)]
#[collect(require_static)]
pub struct CharRun {
    pub length: usize,
    pub origin: Origin,
    pub linear: bool,
}

#[derive(Collect)]
#[collect(no_drop)]
pub struct Located<'gc> {
    pub(crate) raw: Value<'gc>,
    pub origin: Origin,
    pub chars: Vec<CharRun>,
}

impl<'gc> Value<'gc> {
    pub fn raw(self) -> Self {
        match self {
            Self::Located(value) => value.raw,
            value => value,
        }
    }

    pub fn origin(self) -> Option<Origin> {
        match self {
            Self::Located(value) => Some(value.origin),
            _ => None,
        }
    }

    pub fn wrap(self, mc: &Mutation<'gc>, origin: Origin) -> Self {
        if matches!(self, Self::Located(_)) {
            self
        } else {
            Self::Located(Gc::new(
                mc,
                Located {
                    raw: self,
                    origin,
                    chars: vec![],
                },
            ))
        }
    }

    pub fn same_wrapper(self, other: Self) -> bool {
        match (self, other) {
            (Self::Located(left), Self::Located(right)) => Gc::ptr_eq(left, right),
            _ => false,
        }
    }

    pub fn char_origin(self, index: usize) -> Option<Origin> {
        let Self::Located(value) = self else {
            return None;
        };
        let Self::String(text) = value.raw else {
            return None;
        };
        if index >= text.chars().count() {
            return None;
        }
        let mut offset = index;
        for run in &value.chars {
            if offset < run.length {
                return Some(if run.linear {
                    Origin {
                        start: run.origin.start + offset,
                        end: run.origin.start + offset + 1,
                    }
                } else {
                    run.origin
                });
            }
            offset -= run.length;
        }
        Some(value.origin)
    }

    pub fn carry_item(self, mc: &Mutation<'gc>, item: Self, index: usize) -> Self {
        match self.origin() {
            Some(origin) => item.wrap(mc, self.char_origin(index).unwrap_or(origin)),
            None => item,
        }
    }

    pub fn wrap_root(self, mc: &Mutation<'gc>) -> Self {
        if matches!(self, Self::Located(_)) {
            return self;
        }
        match self {
            Self::String(text) => {
                let length = text.chars().count();
                let origin = Origin {
                    start: 0,
                    end: length,
                };
                Self::Located(Gc::new(
                    mc,
                    Located {
                        raw: self,
                        origin,
                        chars: if length == 0 {
                            vec![]
                        } else {
                            vec![CharRun {
                                length,
                                origin,
                                linear: true,
                            }]
                        },
                    },
                ))
            }
            _ => self.wrap(mc, Origin { start: 0, end: 1 }),
        }
    }
}

pub fn concatenate<'gc>(
    mc: &Mutation<'gc>,
    values: &[Value<'gc>],
    origin: Origin,
) -> Result<Value<'gc>, crate::coercion::StringCoercionError> {
    let mut text = String::new();
    let mut chars: Vec<CharRun> = Vec::new();
    for value in values {
        let part = crate::coercion::string_text(*value)?;
        let length = part.chars().count();
        if length == 0 {
            continue;
        }
        let runs = match value {
            Value::Located(value)
                if matches!(value.raw, Value::String(_)) && !value.chars.is_empty() =>
            {
                value.chars.clone()
            }
            _ => vec![CharRun {
                length,
                origin: value.origin().unwrap_or(origin),
                linear: false,
            }],
        };
        for run in runs {
            if let Some(last) = chars.last_mut()
                && last.linear == run.linear
                && ((!last.linear && last.origin == run.origin)
                    || (last.linear && last.origin.end == run.origin.start))
            {
                last.length += run.length;
                if last.linear {
                    last.origin.end = run.origin.end;
                }
                continue;
            }
            chars.push(run);
        }
        text.push_str(&part);
    }
    Ok(Value::Located(Gc::new(
        mc,
        Located {
            raw: Value::string(mc, text),
            origin,
            chars,
        },
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:into-001 req:runtime-memory-001
    fn wrapper_is_immutable_and_equality_observes_raw_identity() {
        gc_arena::arena::rootless_mutate(|mc| {
            let array = Value::array(mc, vec![]);
            let first = array.wrap(mc, Origin { start: 1, end: 2 });
            let second = array.wrap(mc, Origin { start: 3, end: 4 });
            assert!(first.strict_eq(second));
            assert!(!first.same_wrapper(second));
            assert!(first.same_wrapper(first.wrap(mc, Origin { start: 9, end: 10 })));
        });
    }

    #[test]
    // req:into-001 req:expressions-runtime-004
    fn concatenation_preserves_unicode_character_runs_and_literal_origins() {
        gc_arena::arena::rootless_mutate(|mc| {
            let source = Value::string(mc, "😀a").wrap_root(mc);
            let literal = Value::string(mc, "\n").wrap(mc, Origin { start: 7, end: 9 });
            let result = concatenate(mc, &[source, literal], Origin { start: 0, end: 9 }).unwrap();
            assert_eq!(result.char_origin(0), Some(Origin { start: 0, end: 1 }));
            assert_eq!(result.char_origin(1), Some(Origin { start: 1, end: 2 }));
            assert_eq!(result.char_origin(2), Some(Origin { start: 7, end: 9 }));
            assert_eq!(result.char_origin(3), None);
            assert_eq!(crate::coercion::string_text(result).unwrap(), "😀a\n");
        });
    }
}
