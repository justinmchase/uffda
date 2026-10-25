//! Static call-graph analysis for selective packrat memoization.
//!
//! See `.agents/specifications/runtime/selective-memoization.spec.md`.

use crate::module::CompiledModuleGraph;
use crate::pattern::ResolveTargetKind;
use crate::resolver::graph::{MemberKind, ModuleMember};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug)]
struct CalleeInfo {
    /// True when any call site could not be pinned to a single concrete rule.
    dynamic: bool,
    callees: Vec<ModuleMember>,
}

/// Compute `can_skip_memo` for every rule in `graph`.
pub(crate) fn compute_skip_memo(graph: &CompiledModuleGraph) -> HashMap<ModuleMember, bool> {
    let mut callee_cache = HashMap::new();
    let mut results = HashMap::new();
    let mut members = Vec::new();
    for module in graph.graph.modules.values() {
        for member in module
            .locals
            .values()
            .chain(module.imports.values())
            .chain(module.exports.values())
            .chain(module.default.iter())
        {
            if member.kind == MemberKind::Rule {
                members.push(member.clone());
            }
        }
    }
    members.sort_by(|left, right| {
        (
            left.module_url.as_str(),
            left.declaration_index,
            left.kind as u8,
        )
            .cmp(&(
                right.module_url.as_str(),
                right.declaration_index,
                right.kind as u8,
            ))
    });
    members.dedup();
    for member in &members {
        let skip = can_skip_with_cache(graph, member, &mut callee_cache);
        results.insert(member.clone(), skip);
    }
    results
}

fn can_skip_with_cache(
    graph: &CompiledModuleGraph,
    member: &ModuleMember,
    cache: &mut HashMap<ModuleMember, CalleeInfo>,
) -> bool {
    if member.kind != MemberKind::Rule {
        return false;
    }
    let info = callees_of(graph, member, cache);
    if info.dynamic {
        return false;
    }
    for callee in &info.callees {
        if callee == member || reaches(graph, callee, member, &mut HashSet::new(), cache) {
            return false;
        }
    }
    true
}

fn callees_of(
    graph: &CompiledModuleGraph,
    member: &ModuleMember,
    cache: &mut HashMap<ModuleMember, CalleeInfo>,
) -> CalleeInfo {
    if let Some(info) = cache.get(member) {
        return info.clone();
    }
    let info = callees_of_uncached(graph, member);
    cache.insert(member.clone(), info.clone());
    info
}

fn callees_of_uncached(graph: &CompiledModuleGraph, member: &ModuleMember) -> CalleeInfo {
    let Some(declaration) = graph.declaration(member) else {
        return CalleeInfo {
            dynamic: true,
            callees: vec![],
        };
    };
    if !declaration.parameters.is_empty() {
        return CalleeInfo {
            dynamic: true,
            callees: vec![],
        };
    }
    let mut dynamic = false;
    let mut callees = Vec::new();
    for site in declaration.pattern.resolve_sites() {
        if dynamic {
            break;
        }
        match site.target_kind {
            ResolveTargetKind::Reference => {
                if site.argument_count > 0 {
                    dynamic = true;
                    break;
                }
                let Some(name) = site.name else {
                    dynamic = true;
                    break;
                };
                match graph.resolve(&member.module_url, name) {
                    None => {
                        dynamic = true;
                        break;
                    }
                    Some(target) if target.kind == MemberKind::Rule => {
                        if !callees.iter().any(|existing| existing == &target) {
                            callees.push(target);
                        }
                    }
                    Some(_) => {
                        // Func (and similar non-rule) references are not rule
                        // call edges; Deno skips them via `isFunc`.
                    }
                }
            }
            ResolveTargetKind::Run => {
                dynamic = true;
                break;
            }
            ResolveTargetKind::Special => match site.value {
                None => {
                    dynamic = true;
                    break;
                }
                Some(value) if value.is_rule() => {
                    // Concrete embedded rule pattern: a fixed callee, but Rust's
                    // `ResolveValue` does not carry `ModuleMember` identity the
                    // way Deno's `SpecialKind.Rule` does. Treat as a pinned,
                    // non-dynamic edge with no further rule-identity callees.
                    let _ = value;
                }
                Some(_) => {
                    dynamic = true;
                    break;
                }
            },
        }
    }
    CalleeInfo { dynamic, callees }
}

fn reaches(
    graph: &CompiledModuleGraph,
    start: &ModuleMember,
    target: &ModuleMember,
    visiting: &mut HashSet<ModuleMember>,
    cache: &mut HashMap<ModuleMember, CalleeInfo>,
) -> bool {
    if !visiting.insert(start.clone()) {
        return false;
    }
    let info = callees_of(graph, start, cache);
    if info.dynamic {
        return true;
    }
    for callee in &info.callees {
        if callee == target || reaches(graph, callee, target, visiting, cache) {
            return true;
        }
    }
    false
}
