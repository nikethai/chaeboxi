use super::error::{outside_root, WorkspaceError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelativePath {
    pub components: Vec<String>,
}

impl RelativePath {
    pub fn parse(input: &str) -> Result<Self, WorkspaceError> {
        if input.contains('\0') {
            return Err(outside_root());
        }
        let n = input.replace('\\', "/").trim().to_string();
        if n.is_empty() || n == "." {
            return Ok(Self { components: vec![] });
        }
        if n.starts_with('/') || n.starts_with("//") || looks_absolute_windows(&n) {
            return Err(outside_root());
        }
        let mut components = Vec::new();
        for part in n.split('/') {
            if part.is_empty() || part == "." {
                continue;
            }
            if part == ".." {
                if components.pop().is_none() {
                    return Err(outside_root());
                }
                continue;
            }
            if part == "~" || part.contains(':') {
                return Err(outside_root());
            }
            components.push(part.to_string());
        }
        Ok(Self { components })
    }

    pub fn as_display(&self) -> String {
        self.components.join("/")
    }

    pub fn join_child(&self, name: &str) -> Result<Self, WorkspaceError> {
        if name.is_empty() || name == "." || name.contains('/') || name.contains('\\') || name == ".." {
            return Err(outside_root());
        }
        let mut components = self.components.clone();
        components.push(name.to_string());
        Ok(Self { components })
    }

    pub fn parent(&self) -> Self {
        let mut components = self.components.clone();
        components.pop();
        Self { components }
    }

    pub fn file_name(&self) -> Option<&str> {
        self.components.last().map(String::as_str)
    }
}

fn looks_absolute_windows(n: &str) -> bool {
    let bytes = n.as_bytes();
    bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':'
}

pub fn content_revision(content: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(content);
    hasher.update(content.len().to_le_bytes());
    let digest = hasher.finalize();
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_escape_and_absolute() {
        assert!(RelativePath::parse("../secret").is_err());
        assert!(RelativePath::parse("/etc/passwd").is_err());
        assert!(RelativePath::parse("C:/Windows").is_err());
        assert!(RelativePath::parse("foo/../../etc").is_err());
        assert_eq!(
            RelativePath::parse("src/../src/app.ts").unwrap().as_display(),
            "src/app.ts"
        );
    }
}
