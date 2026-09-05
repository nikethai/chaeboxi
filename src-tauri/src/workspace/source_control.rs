//! Read-only Git broker: fixed argv, sanitized environment, no renderer cwd/args.

use super::authority::WorkspaceRuntime;
use super::budgets::{SCM_LOG_PAGE, SCM_MAX_CHANGES, SCM_MAX_OUTPUT_BYTES, SCM_TIMEOUT_MS};
use super::error::{
    feature_disabled, git_unavailable, repository_outside_root, scm_timeout, WorkspaceError, PERMISSION_DENIED,
};
use super::git_porcelain::{parse_log, parse_status_v2};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

impl WorkspaceRuntime {
    pub fn source_control_status(&self, capability_id: &str, window_label: &str) -> Result<Value, WorkspaceError> {
        self.scm_gate("status")?;
        let (root, _, _, _) = self.lookup_cap(capability_id, window_label)?;
        let worktree = canonicalize_worktree(&root)?;
        if worktree != root {
            // Authorized root must equal the Git worktree root.
            if git_common_dir(&worktree).is_ok() && worktree != root {
                return Err(repository_outside_root());
            }
        }
        require_worktree_equals_root(&root)?;
        let output = run_git(
            &root,
            &[
                "status",
                "--porcelain=v2",
                "-z",
                "--branch",
                "--untracked-files=all",
                "--ignored=no",
            ],
        )?;
        let snap = parse_status_v2(&output);
        if snap.entries.len() > SCM_MAX_CHANGES {
            return Ok(json!({
                "truncated": true,
                "branch": snap.branch,
                "oid": snap.oid,
                "detached": snap.detached,
                "unborn": snap.unborn,
                "changes": [],
            }));
        }
        let changes: Vec<Value> = snap
            .entries
            .into_iter()
            .map(|e| {
                json!({
                    "changeId": e.change_id,
                    "status": e.status,
                    "label": e.path_label,
                })
            })
            .collect();
        Ok(json!({
            "truncated": false,
            "branch": snap.branch,
            "oid": snap.oid,
            "detached": snap.detached,
            "unborn": snap.unborn,
            "changes": changes,
            "repositoryId": opaque_repo_id(&root),
            "checkoutId": opaque_checkout_id(&root),
        }))
    }

    pub fn source_control_diff(
        &self,
        capability_id: &str,
        window_label: &str,
        change_id: Option<&str>,
    ) -> Result<Value, WorkspaceError> {
        self.scm_gate("diff")?;
        let (root, _, _, _) = self.lookup_cap(capability_id, window_label)?;
        require_worktree_equals_root(&root)?;
        let status = run_git(
            &root,
            &["status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all", "--ignored=no"],
        )?;
        let snap = parse_status_v2(&status);
        let Some(id) = change_id else {
            return Ok(json!({ "binary": false, "truncated": true, "text": "", "label": "" }));
        };
        let Some(entry) = snap.entries.into_iter().find(|e| e.change_id == id) else {
            return Err(super::error::not_found(id));
        };
        let path = String::from_utf8_lossy(&entry.path_bytes).into_owned();
        if path.starts_with('-') {
            return Err(super::error::unauthorized_root("Refusing leading-dash pathspec"));
        }
        let output = run_git(
            &root,
            &[
                "diff",
                "--no-ext-diff",
                "--no-textconv",
                "--no-color",
                "--",
                &path,
            ],
        )?;
        let binary = output.windows(15).any(|w| w == b"Binary files differ") || output.contains(&0);
        let text = if binary {
            String::new()
        } else {
            String::from_utf8_lossy(&output).chars().take(20_000).collect()
        };
        Ok(json!({
            "changeId": id,
            "label": entry.path_label,
            "binary": binary,
            "truncated": output.len() > 20_000,
            "text": text,
        }))
    }

    pub fn source_control_log(&self, capability_id: &str, window_label: &str, limit: Option<usize>) -> Result<Value, WorkspaceError> {
        self.scm_gate("log")?;
        let (root, _, _, _) = self.lookup_cap(capability_id, window_label)?;
        require_worktree_equals_root(&root)?;
        let n = limit.unwrap_or(SCM_LOG_PAGE).min(SCM_LOG_PAGE).max(1);
        let n_s = n.to_string();
        let output = run_git(
            &root,
            &[
                "log",
                "-n",
                &n_s,
                "-z",
                "--pretty=format:%H%x00%an%x00%at%x00%s",
            ],
        )?;
        let entries: Vec<Value> = parse_log(&output)
            .into_iter()
            .map(|e| {
                json!({
                    "commitId": e.commit_id,
                    "author": e.author,
                    "timestamp": e.timestamp,
                    "subject": e.subject,
                })
            })
            .collect();
        Ok(json!({ "entries": entries }))
    }

    fn scm_gate(&self, _op: &str) -> Result<(), WorkspaceError> {
        if !self.rollout().scm {
            return Err(feature_disabled("scm"));
        }
        if git_executable().is_none() {
            return Err(git_unavailable());
        }
        Ok(())
    }
}

fn git_executable() -> Option<PathBuf> {
    let names = ["git", "git.exe"];
    if let Ok(path) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path) {
            for name in names {
                let candidate = dir.join(name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }
    None
}

fn isolated_home() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("chaeboxi-git-home-{}", std::process::id()));
    let _ = fs::create_dir_all(&dir);
    dir
}

fn run_git(cwd: &Path, args: &[&str]) -> Result<Vec<u8>, WorkspaceError> {
    let git = git_executable().ok_or_else(git_unavailable)?;
    let home = isolated_home();
    let empty_hooks = home.join("hooks");
    let _ = fs::create_dir_all(&empty_hooks);
    let mut cmd = Command::new(&git);
    cmd.current_dir(cwd);
    cmd.env_clear();
    let mut path_dirs = Vec::new();
    if let Some(parent) = git.parent() {
        path_dirs.push(parent.to_path_buf());
    }
    #[cfg(unix)]
    {
        path_dirs.push(PathBuf::from("/usr/bin"));
        path_dirs.push(PathBuf::from("/bin"));
    }
    cmd.env("PATH", std::env::join_paths(path_dirs).unwrap_or_default());
    cmd.env("HOME", &home);
    cmd.env("XDG_CONFIG_HOME", home.join("xdg"));
    cmd.env("GIT_CONFIG_NOSYSTEM", "1");
    cmd.env("GIT_CONFIG_GLOBAL", home.join("gitconfig"));
    cmd.env("GIT_CONFIG_SYSTEM", home.join("gitconfig"));
    cmd.env("GIT_TERMINAL_PROMPT", "0");
    cmd.env("GIT_OPTIONAL_LOCKS", "0");
    cmd.env("GIT_PAGER", "cat");
    cmd.env("PAGER", "cat");
    cmd.env("GIT_EDITOR", ":");
    cmd.env("EDITOR", ":");
    cmd.env("VISUAL", ":");
    cmd.env("GIT_ASKPASS", "");
    cmd.env("SSH_ASKPASS", "");
    cmd.env("LC_ALL", "C");
    cmd.env("LANG", "C");
    cmd.args([
        "-c",
        "core.hooksPath=",
        "-c",
        "core.fsmonitor=",
        "-c",
        "core.useBuiltinFSMonitor=false",
        "-c",
        "filter.lfs.smudge=",
        "-c",
        "filter.lfs.clean=",
        "-c",
        "filter.lfs.process=",
        "-c",
        "diff.external=",
        "-c",
        "pager.status=false",
        "-c",
        "pager.diff=false",
        "-c",
        "pager.log=false",
        "-c",
        "interactive.diffFilter=",
        "-c",
        "credential.helper=",
        "-c",
        "alias.status=",
        "-c",
        "alias.diff=",
        "-c",
        "alias.log=",
        "--no-optional-locks",
    ]);
    cmd.args(args);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| WorkspaceError::new(PERMISSION_DENIED, format!("{e}")))?;
    let done = Arc::new(AtomicBool::new(false));
    let started = Instant::now();
    let timeout = Duration::from_millis(SCM_TIMEOUT_MS);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if started.elapsed() > timeout {
                    let _ = child.kill();
                    done.store(true, Ordering::SeqCst);
                    return Err(scm_timeout());
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(err) => return Err(WorkspaceError::new(PERMISSION_DENIED, format!("{err}"))),
        }
    }
    let output = child
        .wait_with_output()
        .map_err(|e| WorkspaceError::new(PERMISSION_DENIED, format!("{e}")))?;
    if output.stdout.len() > SCM_MAX_OUTPUT_BYTES {
        return Ok(output.stdout[..SCM_MAX_OUTPUT_BYTES].to_vec());
    }
    if !output.status.success() {
        let _redacted = String::from_utf8_lossy(&output.stderr);
        return Err(WorkspaceError::new(
            PERMISSION_DENIED,
            "Source control command failed",
        ));
    }
    let _ = done;
    Ok(output.stdout)
}

fn canonicalize_worktree(root: &Path) -> Result<PathBuf, WorkspaceError> {
    fs::canonicalize(root).map_err(|e| WorkspaceError::new(PERMISSION_DENIED, format!("{e}")))
}

fn git_common_dir(root: &Path) -> Result<PathBuf, WorkspaceError> {
    let git = root.join(".git");
    if git.is_dir() {
        return Ok(git);
    }
    if git.is_file() {
        let text = fs::read_to_string(&git).map_err(|e| WorkspaceError::new(PERMISSION_DENIED, format!("{e}")))?;
        if let Some(rest) = text.trim().strip_prefix("gitdir:") {
            return Ok(PathBuf::from(rest.trim()));
        }
    }
    Err(WorkspaceError::new(PERMISSION_DENIED, "Not a git repository"))
}

fn require_worktree_equals_root(root: &Path) -> Result<(), WorkspaceError> {
    // Discover: if git rev-parse --show-toplevel differs from root, reject.
    let out = run_git(root, &["rev-parse", "--show-toplevel"]);
    match out {
        Ok(bytes) => {
            let text = String::from_utf8_lossy(&bytes).trim().to_string();
            let discovered = PathBuf::from(text);
            let canon_root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
            let canon_disc = fs::canonicalize(&discovered).unwrap_or(discovered);
            if canon_disc != canon_root {
                return Err(repository_outside_root());
            }
            Ok(())
        }
        Err(_) => {
            // Not a repository: still an error for SCM
            Err(WorkspaceError::new(PERMISSION_DENIED, "Not a git repository"))
        }
    }
}

fn opaque_repo_id(root: &Path) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(b"repo");
    hasher.update(root.as_os_str().as_encoded_bytes());
    hasher.finalize().iter().map(|b| format!("{b:02x}")).take(16).collect()
}

fn opaque_checkout_id(root: &Path) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(b"checkout");
    hasher.update(root.as_os_str().as_encoded_bytes());
    hasher.finalize().iter().map(|b| format!("{b:02x}")).take(16).collect()
}

/// Host env must not leak into Git. Used by hostile tests.
pub fn git_env_allowlist() -> HashMap<String, String> {
    let mut m = HashMap::new();
    m.insert("GIT_TERMINAL_PROMPT".into(), "0".into());
    m.insert("GIT_OPTIONAL_LOCKS".into(), "0".into());
    m
}
