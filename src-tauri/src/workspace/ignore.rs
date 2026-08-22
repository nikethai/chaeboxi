//! Hard-deny plus nested `.gitignore` matching for project listing/search/read.

const DEFAULT_SKIP_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    ".next",
    "coverage",
    ".cache",
    "__pycache__",
    ".venv",
    "venv",
    ".turbo",
    ".parcel-cache",
];

fn basename_lower(path: &str) -> String {
    path.replace('\\', "/")
        .rsplit('/')
        .next()
        .unwrap_or(path)
        .to_ascii_lowercase()
}

fn components(path: &str) -> Vec<String> {
    path.replace('\\', "/")
        .split('/')
        .filter(|s| !s.is_empty() && *s != ".")
        .map(|s| s.to_string())
        .collect()
}

/// Hard-denied secrets and VCS internals never list/search/read/attach.
pub fn is_hard_denied(relative_path: &str) -> bool {
    let rel = relative_path.replace('\\', "/").trim_start_matches('/').to_string();
    if rel.is_empty() {
        return false;
    }
    let parts = components(&rel);
    let lower_parts: Vec<String> = parts.iter().map(|p| p.to_ascii_lowercase()).collect();
    if lower_parts.iter().any(|p| {
        matches!(
            p.as_str(),
            ".git" | ".ssh" | ".gnupg" | ".aws" | ".kube" | ".docker"
        )
    }) {
        return true;
    }
    // `.config/gcloud/`
    if lower_parts.windows(2).any(|w| w[0] == ".config" && w[1] == "gcloud") {
        return true;
    }
    let base = basename_lower(&rel);
    if base == ".env" || base.starts_with(".env.") {
        return true;
    }
    if base.ends_with(".pem") || base.ends_with(".key") {
        return true;
    }
    if base.starts_with("id_rsa") || base.starts_with("id_ed25519") {
        return true;
    }
    false
}

pub fn is_default_skip_dir(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    DEFAULT_SKIP_DIRS.iter().any(|d| *d == lower)
}

#[derive(Debug, Clone)]
pub(crate) struct GitignoreRule {
    negated: bool,
    directory_only: bool,
    pattern: String,
}

/// Very small gitignore matcher: `*`, trailing slash, rooted `/pattern`, no include override of hard-deny.
pub fn parse_gitignore(text: &str) -> Vec<GitignoreRule> {
    let mut rules = Vec::new();
    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut negated = false;
        let mut body = line;
        if let Some(rest) = body.strip_prefix('!') {
            negated = true;
            body = rest;
        }
        let directory_only = body.ends_with('/');
        let pattern = body.trim_matches('/').to_string();
        if pattern.is_empty() {
            continue;
        }
        rules.push(GitignoreRule {
            negated,
            directory_only,
            pattern,
        });
    }
    rules
}

fn glob_match(pattern: &str, text: &str) -> bool {
    fn rec(p: &[u8], t: &[u8]) -> bool {
        let mut i = 0;
        let mut j = 0;
        while i < p.len() {
            if p[i] == b'*' {
                i += 1;
                if i == p.len() {
                    return true;
                }
                while j <= t.len() {
                    if rec(&p[i..], &t[j..]) {
                        return true;
                    }
                    if j == t.len() {
                        break;
                    }
                    j += 1;
                }
                return false;
            }
            if p[i] == b'?' {
                if j >= t.len() {
                    return false;
                }
                i += 1;
                j += 1;
                continue;
            }
            if j >= t.len() || p[i] != t[j] {
                return false;
            }
            i += 1;
            j += 1;
        }
        j == t.len()
    }
    rec(pattern.as_bytes(), text.as_bytes())
}

fn rule_matches(rule: &GitignoreRule, relative_path: &str, is_dir: bool) -> bool {
    if rule.directory_only && !is_dir {
        return false;
    }
    let rel = relative_path.replace('\\', "/").trim_start_matches('/').to_string();
    let base = basename_lower(&rel);
    let pat = rule.pattern.replace('\\', "/");
    if glob_match(&pat.to_ascii_lowercase(), &base) {
        return true;
    }
    if glob_match(&pat.to_ascii_lowercase(), &rel.to_ascii_lowercase()) {
        return true;
    }
    // Match any path suffix (`build` ignores `src/build`).
    let parts = components(&rel);
    parts.iter().any(|p| glob_match(&pat.to_ascii_lowercase(), &p.to_ascii_lowercase()))
}

#[derive(Debug, Default, Clone)]
pub struct IgnoreStack {
    /// (directory relative path, rules)
    layers: Vec<(String, Vec<GitignoreRule>)>,
    has_git: bool,
}

impl IgnoreStack {
    pub fn new(has_git: bool) -> Self {
        Self {
            layers: Vec::new(),
            has_git,
        }
    }

    pub fn push_gitignore(&mut self, dir_relative: &str, text: &str) {
        let rules = parse_gitignore(text);
        if !rules.is_empty() {
            self.layers.push((dir_relative.replace('\\', "/"), rules));
        }
    }

    pub fn is_ignored(&self, relative_path: &str, is_dir: bool) -> bool {
        if is_hard_denied(relative_path) {
            return true;
        }
        let name = basename_lower(relative_path);
        if !self.has_git && is_dir && is_default_skip_dir(&name) {
            return true;
        }
        let mut ignored = false;
        for (dir, rules) in &self.layers {
            let child = if dir.is_empty() {
                relative_path.replace('\\', "/")
            } else {
                let prefix = format!("{}/", dir.trim_matches('/'));
                let rel = relative_path.replace('\\', "/");
                if let Some(rest) = rel.strip_prefix(&prefix) {
                    rest.to_string()
                } else if rel == *dir {
                    String::new()
                } else {
                    continue;
                }
            };
            for rule in rules {
                if rule_matches(rule, &child, is_dir) {
                    // Negation cannot override hard-deny; it can un-ignore gitignore matches only.
                    ignored = !rule.negated;
                }
            }
        }
        ignored
    }
}

pub fn gitignore_path(dir_relative: &str) -> String {
    let dir = dir_relative.trim().trim_matches('/').replace('\\', "/");
    if dir.is_empty() {
        ".gitignore".into()
    } else {
        format!("{dir}/.gitignore")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn denies_env_and_keys() {
        assert!(is_hard_denied(".env"));
        assert!(is_hard_denied(".env.local"));
        assert!(is_hard_denied("secrets/id_rsa"));
        assert!(is_hard_denied("certs/foo.pem"));
        assert!(is_hard_denied(".git/config"));
        assert!(is_hard_denied(".ssh/config"));
        assert!(is_hard_denied(".config/gcloud/key.json"));
        assert!(!is_hard_denied("src/app.ts"));
        assert!(!is_hard_denied("README.md"));
    }

    #[test]
    fn gitignore_relative_path() {
        assert_eq!(gitignore_path(""), ".gitignore");
        assert_eq!(gitignore_path("src"), "src/.gitignore");
        assert_eq!(gitignore_path("/src/lib/"), "src/lib/.gitignore");
    }

    #[test]
    fn gitignore_and_default_skip() {
        let mut stack = IgnoreStack::new(false);
        stack.push_gitignore("", "dist/\n*.log\n!keep.log\n");
        assert!(stack.is_ignored("dist", true));
        assert!(stack.is_ignored("foo.log", false));
        assert!(stack.is_ignored("node_modules", true));
        assert!(!stack.is_ignored("src/app.ts", false));
    }
}
