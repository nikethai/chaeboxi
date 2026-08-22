//! Native-known user-global agent roots. Project-relative and nested-home
//! paths (e.g. `$HOME/repo/.claude/skills`) are not global roots.

const ALLOWED_SUFFIXES: &[&str] = &[
    ".claude/skills",
    ".codex/skills",
    ".agents/skills",
    ".cursor/skills",
    ".grok/skills",
    ".gemini/skills",
    ".config/opencode/skills",
    ".claude/commands",
    ".codex/commands",
    ".cursor/commands",
    ".agents/commands",
    ".grok/commands",
    ".gemini/commands",
    ".claude/settings.json",
    ".cursor/hooks.json",
];

fn normalize_slashes(path: &str) -> String {
    path.replace('\\', "/")
}

/// `raw` is allowed only when it is `~/<suffix>` or `$home/<suffix>` (or a file under that suffix).
pub fn is_native_known_global_root(raw: &str, home: &str) -> bool {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.starts_with("./") || trimmed == "." || trimmed.starts_with("../") {
        return false;
    }
    let home_n = normalize_slashes(home).trim_end_matches('/').to_string();
    let expanded = if trimmed == "~" {
        home_n.clone()
    } else if let Some(rest) = trimmed.strip_prefix("~/") {
        format!("{home_n}/{rest}")
    } else {
        normalize_slashes(trimmed)
    };
    let Some(rest) = expanded
        .strip_prefix(&home_n)
        .map(|r| r.trim_start_matches('/').to_string())
    else {
        return false;
    };
    if rest.is_empty() {
        return false;
    }
    ALLOWED_SUFFIXES
        .iter()
        .any(|suffix| rest == *suffix || rest.starts_with(&format!("{suffix}/")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_home_global_tilde_and_expanded() {
        assert!(is_native_known_global_root("~/.claude/skills", "/Users/me"));
        assert!(is_native_known_global_root("/Users/me/.claude/skills", "/Users/me"));
        assert!(is_native_known_global_root("/Users/me/.claude/settings.json", "/Users/me"));
    }

    #[test]
    fn rejects_project_nested_under_home() {
        assert!(!is_native_known_global_root(
            "/Users/me/secret-project/.claude/skills",
            "/Users/me"
        ));
        assert!(!is_native_known_global_root("./.claude/skills", "/Users/me"));
        assert!(!is_native_known_global_root("/etc/passwd", "/Users/me"));
        assert!(!is_native_known_global_root("/Users/me/repo/.cursor/hooks.json", "/Users/me"));
    }
}
