//! Managed worktree feasibility. A plain `git worktree add` is NO-GO until checkout cannot execute hooks/filters.

use super::policy::CapState;
use serde_json::{json, Value};

pub const WORKTREE_NO_GO_REASON: &str =
    "git worktree add performs a checkout that can run repository-controlled smudge filters and hooks. \
     No vetted non-executing checkout is bundled. Renderer destination paths are not accepted. \
     Picker-owned and dirty checkouts are never auto-deleted.";

pub fn status() -> Value {
    json!({
        "state": CapState::Unavailable.as_str(),
        "reason": "feasibility-gate",
        "detail": WORKTREE_NO_GO_REASON,
    })
}
