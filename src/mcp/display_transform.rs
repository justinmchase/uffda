//! Shared structured-result-to-markup transform for the session display surface
//! (req:mcp-server-011). Highlight spans and retained match trees both become
//! [`DisplayNode`]s, then render through [`render_display_html`].

use super::ops::RetainedMatch;
use serde_json::Value;

/// Intermediate node shared by highlight and match-tree display views.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DisplayNode {
    pub label: String,
    pub css_class: String,
    pub title: Option<String>,
    pub children: Option<Vec<DisplayNode>>,
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Renders a `DisplayNode` tree/list to a self-contained HTML fragment.
pub fn render_display_html(nodes: &[DisplayNode]) -> String {
    fn render_node(node: &DisplayNode) -> String {
        let title_attr = node
            .title
            .as_ref()
            .map(|title| format!(" title=\"{}\"", escape_html(title)))
            .unwrap_or_default();
        let children = node.children.as_ref().filter(|list| !list.is_empty());
        match children {
            None => format!(
                "<span class=\"{}\"{}>{}</span>",
                node.css_class,
                title_attr,
                escape_html(&node.label)
            ),
            Some(children) => {
                let children_html: String = children.iter().map(render_node).collect();
                format!(
                    "<div class=\"node {}\"{}><div class=\"node-label\">{}</div><div class=\"node-children\">{}</div></div>",
                    node.css_class,
                    title_attr,
                    escape_html(&node.label),
                    children_html
                )
            }
        }
    }
    nodes.iter().map(render_node).collect()
}

fn highlight_css_class(role: &str) -> String {
    let normalized = match role {
        "newLine" => "newline",
        other => other,
    };
    format!("hl-{normalized}")
}

fn match_kind_css_class(kind: &str) -> String {
    match kind {
        "ok" => "match-ok".into(),
        "skip" => "match-skip".into(),
        "fail" => "match-fail".into(),
        "error" => "match-error".into(),
        "lr" => "match-lr".into(),
        other => format!("match-{other}"),
    }
}

/// One leaf [`DisplayNode`] per highlight span, in source order.
pub fn highlight_result_to_display_nodes(result: &Value) -> Vec<DisplayNode> {
    let Some(spans) = result.get("spans").and_then(Value::as_array) else {
        return Vec::new();
    };
    spans
        .iter()
        .filter_map(|span| {
            let text = span.get("text")?.as_str()?;
            let role = span.get("role")?.as_str().unwrap_or("identifier");
            let offset = span.get("offset").and_then(Value::as_u64).unwrap_or(0) as usize;
            let length = span.get("length").and_then(Value::as_u64).unwrap_or(0) as usize;
            Some(DisplayNode {
                label: text.to_string(),
                css_class: highlight_css_class(role),
                title: Some(format!("{role} [{offset}, {})", offset + length)),
                children: None,
            })
        })
        .collect()
}

const MAX_MATCH_DISPLAY_NODES: usize = 5000;

/// Converts a retained match tree into a [`DisplayNode`] tree.
pub fn match_result_to_display_nodes(root: &RetainedMatch) -> Vec<DisplayNode> {
    let mut count = 0usize;
    fn convert(node: &RetainedMatch, count: &mut usize) -> DisplayNode {
        *count += 1;
        let label = node.rule.clone().unwrap_or_else(|| node.kind.clone());
        let span_info = if node.kind == "ok" || node.kind == "fail" || node.kind == "skip" {
            format!(" [{}, {})", node.start, node.end)
        } else {
            String::new()
        };
        let css_class = match_kind_css_class(&node.kind);
        if node.kind != "ok" && node.kind != "fail" {
            return DisplayNode {
                label: format!("{label}{span_info}"),
                css_class,
                title: None,
                children: None,
            };
        }
        if *count >= MAX_MATCH_DISPLAY_NODES {
            return DisplayNode {
                label: format!("{label}{span_info}"),
                css_class,
                title: None,
                children: Some(vec![DisplayNode {
                    label: "(truncated)".into(),
                    css_class: "truncated".into(),
                    title: None,
                    children: None,
                }]),
            };
        }
        let mut children = Vec::new();
        for child in &node.children {
            if *count >= MAX_MATCH_DISPLAY_NODES {
                break;
            }
            children.push(convert(child, count));
        }
        DisplayNode {
            label: format!("{label}{span_info}"),
            css_class,
            title: None,
            children: if children.is_empty() {
                None
            } else {
                Some(children)
            },
        }
    }
    vec![convert(root, &mut count)]
}

/// Convenience: wrap a fragment in a minimal document shell.
pub fn display_document(body_inner: &str) -> String {
    format!("<!doctype html><title>uffda</title><body>{body_inner}</body>")
}

/// Build a trivial retained match for unit tests (ok/skip/fail leaves).
#[cfg(test)]
pub fn test_match(
    kind: &str,
    rule: Option<&str>,
    children: Vec<std::rc::Rc<RetainedMatch>>,
) -> RetainedMatch {
    RetainedMatch {
        kind: kind.into(),
        start: 0,
        end: 1,
        rule: rule.map(str::to_string),
        recovered: false,
        pattern: Value::Null,
        value: None,
        metadata: Value::Null,
        children,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::rc::Rc;

    #[test]
    // req:mcp-server-011
    fn highlight_spans_become_leaf_nodes_with_role_css_classes() {
        let result = json!({
            "ok": true,
            "spans": [
                { "text": "rule", "role": "keyword", "offset": 0, "length": 4 },
                { "text": " ", "role": "whitespace", "offset": 4, "length": 1 },
                { "text": "A", "role": "identifier", "offset": 5, "length": 1 }
            ]
        });
        let nodes = highlight_result_to_display_nodes(&result);
        assert_eq!(nodes.len(), 3);
        assert_eq!(nodes[0].label, "rule");
        assert_eq!(nodes[0].css_class, "hl-keyword");
        let html = render_display_html(&nodes);
        assert!(html.contains("<span class=\"hl-keyword\""));
        assert!(html.contains(">rule<"));
    }

    #[test]
    // req:mcp-server-011
    fn name_refinements_get_their_own_css_classes() {
        let result = json!({
            "ok": true,
            "spans": [
                { "text": "f", "role": "function", "offset": 1, "length": 1 },
                { "text": "a", "role": "variable", "offset": 3, "length": 1 },
                { "text": "b", "role": "property", "offset": 5, "length": 1 }
            ]
        });
        let classes: std::collections::BTreeMap<_, _> = highlight_result_to_display_nodes(&result)
            .into_iter()
            .map(|n| (n.label, n.css_class))
            .collect();
        assert_eq!(classes["f"], "hl-function");
        assert_eq!(classes["a"], "hl-variable");
        assert_eq!(classes["b"], "hl-property");
    }

    #[test]
    // req:mcp-server-011
    fn match_tree_converts_by_kind_and_renders_nested_html() {
        let child_a = Rc::new(test_match("ok", Some("child-a"), vec![]));
        let child_b = Rc::new(test_match("fail", Some("child-b"), vec![]));
        let root = test_match("ok", Some("root"), vec![child_a, child_b]);
        let nodes = match_result_to_display_nodes(&root);
        assert_eq!(nodes.len(), 1);
        assert_eq!(nodes[0].css_class, "match-ok");

        let skip = test_match("skip", None, vec![]);
        assert_eq!(
            match_result_to_display_nodes(&skip)[0].css_class,
            "match-skip"
        );

        let html = render_display_html(&nodes);
        assert!(html.contains("<div class=\"node match-ok\">"));
        assert!(html.contains("<span class=\"match-ok\">"));
        assert!(html.contains("child-a"));
        assert!(html.contains("<span class=\"match-fail\">"));
    }

    #[test]
    // req:mcp-server-011
    fn render_escapes_html_significant_characters_in_labels() {
        let html = render_display_html(&[DisplayNode {
            label: "<script>&\"</script>".into(),
            css_class: "hl-string".into(),
            title: None,
            children: None,
        }]);
        assert!(html.contains("&lt;script&gt;&amp;&quot;&lt;/script&gt;"));
        assert!(!html.contains("<script>"));
    }
}
