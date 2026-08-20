//! Pure AX role / name matching. Safe to unit-test without Accessibility.

/// Role filter from the renderer (`search` | `text_field` | `button` | `any`).
pub fn normalize_role_filter(raw: &str) -> &'static str {
    match raw.trim().to_ascii_lowercase().as_str() {
        "search" | "search_field" | "axsearchfield" => "search",
        "text" | "text_field" | "textfield" | "axtextfield" | "textarea" => "text_field",
        "button" | "axbutton" => "button",
        _ => "any",
    }
}

pub fn sanitize_app_name(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '.' | '-' | '_'))
        .take(64)
        .collect::<String>()
        .trim()
        .to_string()
}

pub fn looks_like_search(role: &str, title: &str, description: &str, placeholder: &str) -> bool {
    if role == "AXSearchField" {
        return true;
    }
    if !matches!(role, "AXTextField" | "AXComboBox" | "AXTextArea") {
        return false;
    }
    let blob = format!("{title} {description} {placeholder}").to_ascii_lowercase();
    blob.contains("search") || blob.contains("find") || blob.contains("filter") || blob.contains("look up")
}

pub fn matches_role_filter(
    filter: &str,
    role: &str,
    title: &str,
    description: &str,
    placeholder: &str,
) -> bool {
    if role == "AXSecureTextField" {
        return false;
    }
    match filter {
        "search" => looks_like_search(role, title, description, placeholder),
        "text_field" => matches!(role, "AXTextField" | "AXSearchField" | "AXComboBox" | "AXTextArea"),
        "button" => role == "AXButton" || role == "AXPopUpButton",
        _ => matches!(
            role,
            "AXButton"
                | "AXPopUpButton"
                | "AXTextField"
                | "AXSearchField"
                | "AXComboBox"
                | "AXTextArea"
                | "AXCheckBox"
                | "AXLink"
        ),
    }
}

pub fn name_matches(needle: &str, title: &str, description: &str, placeholder: &str) -> bool {
    let n = needle.trim().to_ascii_lowercase();
    if n.is_empty() {
        return true;
    }
    [title, description, placeholder]
        .iter()
        .any(|s| s.to_ascii_lowercase().contains(&n) || s.eq_ignore_ascii_case(needle.trim()))
}

pub fn parse_path_id(id: &str) -> Option<Vec<usize>> {
    if id.is_empty() {
        return None;
    }
    let mut out = Vec::new();
    for part in id.split('.') {
        let n = part.parse::<usize>().ok()?;
        out.push(n);
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_filter_aliases() {
        assert_eq!(normalize_role_filter("Search_Field"), "search");
        assert_eq!(normalize_role_filter("AXButton"), "button");
        assert_eq!(normalize_role_filter("nope"), "any");
    }

    #[test]
    fn search_heuristics() {
        assert!(looks_like_search("AXSearchField", "", "", ""));
        assert!(looks_like_search("AXTextField", "", "Search chats", ""));
        assert!(!looks_like_search("AXTextField", "Name", "", ""));
        assert!(!matches_role_filter("search", "AXSecureTextField", "", "", ""));
    }

    #[test]
    fn path_and_name() {
        assert_eq!(parse_path_id("0.2.11"), Some(vec![0, 2, 11]));
        assert!(parse_path_id("0.x").is_none());
        assert!(name_matches("7", "7", "", ""));
        assert!(name_matches("plus", "Add", "plus", ""));
        assert!(!name_matches("8", "7", "", ""));
        assert_eq!(sanitize_app_name("WhatsApp; rm -rf"), "WhatsApp rm -rf");
    }
}
