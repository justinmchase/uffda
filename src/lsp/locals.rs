//! Local bindings for hover, completion, and rename (requirement 006): the
//! rule parameters, captured variables, and lambda parameters an identifier
//! can refer to, found through the document's parse tree (`[Declaration]` /
//! `[Parameter]` / `[NameReference]` metadata plus the runtime pattern and
//! expression AST each production projects), never through grammar rule names.

use super::editor::{
    EditorDecorator, Node, declared_name, has_editor_metadata, is_success, name_reference_kinds,
    node_id, walk_accepted,
};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

/// Pattern kinds the runtime AST uses (`PatternKind`).
const PATTERN_KINDS: &[&str] = &[
    "and",
    "any",
    "between",
    "character",
    "end",
    "equal",
    "except",
    "fail",
    "includes",
    "into",
    "lookahead",
    "maybe",
    "not",
    "ok",
    "or",
    "over",
    "pipeline",
    "projection",
    "quantifier",
    "regexp",
    "resolve",
    "skip",
    "recover",
    "switch",
    "then",
    "type",
    "variable",
];

/// Where an identifier sits in the parse tree: at the last covering node a
/// pre-order walk of the accepted parse reaches.
#[derive(Clone, Default)]
pub struct IdentifierPosition {
    /// Nodes covering the identifier, outermost first.
    pub chain: Vec<Node>,
    /// Present when the identifier sits in a `[NameReference]`: the declaration
    /// kinds it names (`None`: every kind).
    pub reference: Option<Option<Vec<String>>>,
}

impl IdentifierPosition {
    pub fn from_chain(chain: Vec<Node>) -> Self {
        let reference = chain
            .iter()
            .find(|node| has_editor_metadata(node, EditorDecorator::NameReference))
            .map(|node| name_reference_kinds(node));
        Self { chain, reference }
    }

    /// Whether a name here may resolve to a declaration of `kind`: always at a
    /// non-reference position, otherwise per the reference's kinds.
    pub fn accepts_kind(&self, kind: &str) -> bool {
        match &self.reference {
            None | Some(None) => true,
            Some(Some(kinds)) => kinds.iter().any(|candidate| candidate == kind),
        }
    }

    pub fn annotated(&self, decorator: EditorDecorator) -> Option<&Node> {
        self.chain
            .iter()
            .find(|node| has_editor_metadata(node, decorator))
    }
}

/// Where the identifier `[start, end)` sits in `tree`.
pub fn identifier_position(tree: &Node, start: usize, end: usize) -> IdentifierPosition {
    let mut chain: Vec<Node> = Vec::new();
    walk_accepted(tree, |node, ancestors| {
        if !is_success(node) || ancestors.iter().any(|ancestor| !is_success(ancestor)) {
            return;
        }
        if node.start > start || node.end < end {
            return;
        }
        chain = ancestors.to_vec();
        chain.push(Rc::clone(node));
    });
    IdentifierPosition::from_chain(chain)
}

/// [`identifier_position`] for each of `spans` (sorted by start, not
/// overlapping), in one walk of `tree`.
pub fn identifier_positions(tree: &Node, spans: &[(usize, usize)]) -> Vec<IdentifierPosition> {
    if !is_success(tree) {
        return spans
            .iter()
            .map(|_| IdentifierPosition::default())
            .collect();
    }
    let mut parent: HashMap<usize, Option<usize>> = HashMap::new();
    let mut nodes: HashMap<usize, Node> = HashMap::new();
    let mut last: Vec<Option<Node>> = vec![None; spans.len()];
    walk_accepted(tree, |node, ancestors| {
        let (start, end) = (node.start, node.end);
        let mut index = spans.partition_point(|span| span.0 < start);
        let mut covers = false;
        while index < spans.len() && spans[index].0 < end {
            if spans[index].1 <= end {
                covers = true;
                last[index] = Some(Rc::clone(node));
            }
            index += 1;
        }
        if !covers {
            return;
        }
        nodes.insert(node_id(node), Rc::clone(node));
        parent.insert(node_id(node), ancestors.last().map(node_id));
        let mut level = ancestors.len();
        while level > 0 && !parent.contains_key(&node_id(&ancestors[level - 1])) {
            let ancestor = &ancestors[level - 1];
            nodes.insert(node_id(ancestor), Rc::clone(ancestor));
            parent.insert(
                node_id(ancestor),
                level.checked_sub(2).map(|above| node_id(&ancestors[above])),
            );
            level -= 1;
        }
    });
    last.into_iter()
        .map(|node| {
            let mut chain = Vec::new();
            let mut at = node.as_ref().map(node_id);
            while let Some(id) = at {
                let Some(node) = nodes.get(&id) else { break };
                chain.push(Rc::clone(node));
                at = parent.get(&id).copied().flatten();
            }
            chain.reverse();
            IdentifierPosition::from_chain(chain)
        })
        .collect()
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LocalBinding {
    Parameter {
        name: String,
        /// The rule declaring the parameter.
        declaration_name: Option<String>,
    },
    Variable {
        name: String,
        /// Source span of the binding pattern (`name:pattern`).
        start: usize,
        end: usize,
        /// The declaration whose own parameters/pattern bind it (not a lambda).
        declaration_name: Option<String>,
    },
}

impl LocalBinding {
    pub fn name(&self) -> &str {
        match self {
            Self::Parameter { name, .. } | Self::Variable { name, .. } => name,
        }
    }

    pub fn kind_label(&self) -> &'static str {
        match self {
            Self::Parameter { .. } => "parameter",
            Self::Variable { .. } => "variable",
        }
    }

    pub fn declaration_name(&self) -> Option<&str> {
        match self {
            Self::Parameter {
                declaration_name, ..
            }
            | Self::Variable {
                declaration_name, ..
            } => declaration_name.as_deref(),
        }
    }
}

fn is_pattern(value: &Value) -> bool {
    value
        .get("kind")
        .and_then(Value::as_str)
        .is_some_and(|kind| PATTERN_KINDS.contains(&kind))
}

fn is_lambda(value: &Value) -> bool {
    value.get("kind").and_then(Value::as_str) == Some("lambda")
        && value.get("pattern").is_some_and(is_pattern)
}

/// A `[Declaration]` (parsed or still being typed) or a parsed lambda.
fn is_scope(node: &Node) -> bool {
    has_editor_metadata(node, EditorDecorator::Declaration)
        || (is_success(node) && node.value.as_ref().is_some_and(is_lambda))
}

fn variable_name(node: &Node) -> Option<&str> {
    let value = node.value.as_ref()?;
    if is_pattern(value) && value.get("kind").and_then(Value::as_str) == Some("variable") {
        value.get("name").and_then(Value::as_str)
    } else {
        None
    }
}

/// Visits each `Ok` node directly within `scope` once (nested scopes
/// excluded): the accepted parse, plus the attempts on `chain` (a construct
/// still being typed is a `Fail` reaching the position and keeps the bindings
/// it parsed before failing). Other `Fail` branches are rejected attempts,
/// whose would-be bindings bind nothing.
fn walk_scope(scope: &Node, chain: &HashSet<usize>, mut visit: impl FnMut(&Node)) {
    let mut seen: HashSet<usize> = HashSet::new();
    let mut stack = vec![Rc::clone(scope)];
    while let Some(node) = stack.pop() {
        if seen.contains(&node_id(&node)) || (!Rc::ptr_eq(&node, scope) && is_scope(&node)) {
            continue;
        }
        seen.insert(node_id(&node));
        if is_success(&node) {
            visit(&node);
        }
        for child in node.children.iter().rev() {
            if is_success(child) || chain.contains(&node_id(child)) {
                stack.push(Rc::clone(child));
            }
        }
    }
}

type Variables = Vec<(String, Node)>;

/// The first node binding each variable directly within `scope`, narrowed to
/// the innermost node projecting that binding.
fn variables_in(scope: &Node, chain: &HashSet<usize>) -> Variables {
    let mut found: Variables = Vec::new();
    walk_scope(scope, chain, |node| {
        let Some(name) = variable_name(node) else {
            return;
        };
        if found.iter().any(|(existing, _)| existing == name) {
            return;
        }
        found.push((name.to_string(), narrowed(node, name)));
    });
    found
}

fn narrowed(node: &Node, name: &str) -> Node {
    let mut dead = HashSet::new();
    for child in &node.children {
        if let Some(inner) = first_binding(child, name, &mut dead) {
            return inner;
        }
    }
    Rc::clone(node)
}

fn first_binding(node: &Node, name: &str, dead: &mut HashSet<usize>) -> Option<Node> {
    if !is_success(node) || is_scope(node) || dead.contains(&node_id(node)) {
        return None;
    }
    if variable_name(node) == Some(name) {
        return Some(narrowed(node, name));
    }
    for child in &node.children {
        if let Some(inner) = first_binding(child, name, dead) {
            return Some(inner);
        }
    }
    dead.insert(node_id(node));
    None
}

/// The names a declaration's `[Parameter]` productions bind.
fn parameters_of(declaration: &Node, chain: &HashSet<usize>) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    walk_scope(declaration, chain, |node| {
        if !has_editor_metadata(node, EditorDecorator::Parameter) {
            return;
        }
        if let Some(name) = node
            .value
            .as_ref()
            .and_then(|value| value.get("name"))
            .and_then(Value::as_str)
            && !names.iter().any(|existing| existing == name)
        {
            names.push(name.to_string());
        }
    });
    names
}

/// Per-scope bindings shared across [`local_bindings_at`] calls.
#[derive(Default)]
pub struct LocalScopeMemo {
    variables: HashMap<usize, Variables>,
    parameters: HashMap<usize, Vec<String>>,
}

/// Every local binding visible at `position`, innermost first (a name bound by
/// an inner scope shadows the same name further out), mirroring reference
/// resolution: variables (expression references) bound by an enclosing lambda
/// or declaration pattern, and parameters (pattern references) of the
/// enclosing declaration.
///
/// `memo` shares each scope's bindings across calls; it applies only to
/// positions in the accepted parse (a chain of `Ok` nodes).
pub fn local_bindings_at(
    position: &IdentifierPosition,
    mut memo: Option<&mut LocalScopeMemo>,
) -> Vec<LocalBinding> {
    let variables = position.accepts_kind("func");
    let parameters = position.accepts_kind("rule");
    let chain: HashSet<usize> = position.chain.iter().map(node_id).collect();
    let shared = position.chain.iter().all(|node| is_success(node));
    let mut bindings: Vec<LocalBinding> = Vec::new();
    let mut bound: HashSet<String> = HashSet::new();
    let mut add = |binding: LocalBinding| {
        if bound.insert(binding.name().to_string()) {
            bindings.push(binding);
        }
    };
    for node in position.chain.iter().rev() {
        if !is_scope(node) {
            continue;
        }
        let is_declaration = has_editor_metadata(node, EditorDecorator::Declaration);
        let declaration_name = if is_declaration {
            declared_name(node)
        } else {
            None
        };
        if variables {
            let scoped = match (&mut memo, shared) {
                (Some(memo), true) => memo
                    .variables
                    .entry(node_id(node))
                    .or_insert_with(|| variables_in(node, &chain))
                    .clone(),
                _ => variables_in(node, &chain),
            };
            for (name, variable) in scoped {
                add(LocalBinding::Variable {
                    name,
                    start: variable.start,
                    end: variable.end,
                    declaration_name: declaration_name.clone(),
                });
            }
        }
        if is_declaration {
            if parameters {
                let names = match (&mut memo, shared) {
                    (Some(memo), true) => memo
                        .parameters
                        .entry(node_id(node))
                        .or_insert_with(|| parameters_of(node, &chain))
                        .clone(),
                    _ => parameters_of(node, &chain),
                };
                for name in names {
                    add(LocalBinding::Parameter {
                        name,
                        declaration_name: declaration_name.clone(),
                    });
                }
            }
            break;
        }
    }
    bindings
}

/// The innermost local binding of `name` visible at `position`.
pub fn local_binding_at(position: &IdentifierPosition, name: &str) -> Option<LocalBinding> {
    local_bindings_at(position, None)
        .into_iter()
        .find(|binding| binding.name() == name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lsp::editor::test_support::parse;

    fn position_of(source: &str, tree: &Node, needle: &str, nth: usize) -> IdentifierPosition {
        let start = source.match_indices(needle).nth(nth).expect("needle").0;
        identifier_position(tree, start, start + needle.len())
    }

    #[test]
    // req:cli-language-server-006
    fn variables_and_rule_parameters_bind_within_their_declaration() {
        let source = "rule Main<P> = x:Other P -> (add x 1);\nrule Other = any;\n";
        let (tree, _) = parse(source);

        // `x` in the expression references the captured variable.
        let at_x = position_of(source, &tree, "x", 1);
        assert!(at_x.reference.is_some(), "x is a name reference");
        let binding = local_binding_at(&at_x, "x").expect("x binds");
        assert!(matches!(
            binding,
            LocalBinding::Variable { ref name, declaration_name: Some(ref d), .. }
                if name == "x" && d == "Main"
        ));

        // `P` in the pattern references the rule parameter.
        let at_p = position_of(source, &tree, "P", 1);
        assert_eq!(
            local_binding_at(&at_p, "P"),
            Some(LocalBinding::Parameter {
                name: "P".into(),
                declaration_name: Some("Main".into())
            })
        );

        // `Other` is a declaration, not a local.
        let at_other = position_of(source, &tree, "Other", 0);
        assert_eq!(local_binding_at(&at_other, "Other"), None);

        // Another rule does not see `Main`'s variable.
        let at_second = position_of(source, &tree, "any", 0);
        assert!(local_bindings_at(&at_second, None).is_empty());
    }

    #[test]
    // req:cli-language-server-006
    fn batch_positions_match_single_positions() {
        let source = "rule Main<P> = x:Other P -> (add x 1);\nrule Other = any;\n";
        let (tree, _) = parse(source);
        let find = |needle: &str, nth: usize| {
            let start = source.match_indices(needle).nth(nth).unwrap().0;
            (start, start + needle.len())
        };
        let spans = [
            find("Main", 0),
            find("P", 1),
            find("x", 1),
            find("Other", 1),
        ];
        let batch = identifier_positions(&tree, &spans);
        for (span, position) in spans.iter().zip(batch) {
            let single = identifier_position(&tree, span.0, span.1);
            assert_eq!(position.chain.len(), single.chain.len(), "{span:?}");
            assert_eq!(position.reference, single.reference, "{span:?}");
        }
    }
}
