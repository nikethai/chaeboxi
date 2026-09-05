//! Compiled native rollout policy. Renderer flags may only hide or revoke.

use serde_json::{json, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NativeRollout {
    pub explorer: bool,
    pub export: bool,
    pub scm: bool,
    pub staging: bool,
    pub apply: bool,
    pub wasi: bool,
    pub worktrees: bool,
    /// Direct create/edit/delete IPC. Tests only; production stays off.
    pub direct_mutation: bool,
}

impl NativeRollout {
    /// High-risk bits stay compiled off until a later compatibility release.
    pub fn compiled() -> Self {
        Self {
            explorer: true,
            export: false,
            scm: false,
            staging: false,
            apply: false,
            wasi: false,
            worktrees: false,
            direct_mutation: false,
        }
    }

    pub fn for_tests_with_mutation(mutation: bool) -> Self {
        Self {
            explorer: true,
            export: true,
            scm: true,
            staging: true,
            apply: true,
            wasi: false,
            worktrees: false,
            direct_mutation: mutation,
        }
    }

    #[allow(dead_code)]
    pub fn intersect_disable(&self, user_export: bool, user_scm: bool, user_staging: bool, user_apply: bool) -> Self {
        Self {
            explorer: self.explorer,
            export: self.export && user_export,
            scm: self.scm && user_scm,
            staging: self.staging && user_staging,
            apply: self.apply && user_apply,
            wasi: false,
            worktrees: false,
            direct_mutation: self.direct_mutation,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapState {
    Ready,
    Disabled,
    Unavailable,
    Unsupported,
}

impl CapState {
    pub fn as_str(self) -> &'static str {
        match self {
            CapState::Ready => "ready",
            CapState::Disabled => "disabled",
            CapState::Unavailable => "unavailable",
            CapState::Unsupported => "unsupported",
        }
    }
}

pub fn capability_entry(state: CapState, reason: &str) -> Value {
    json!({
        "state": state.as_str(),
        "reason": reason,
    })
}

pub fn discovery_matrix(rollout: NativeRollout, git_available: bool) -> Value {
    let scm = if !rollout.scm {
        capability_entry(CapState::Disabled, "native-rollout")
    } else if !git_available {
        capability_entry(CapState::Unavailable, "git-not-found")
    } else {
        capability_entry(CapState::Ready, "ok")
    };
    json!({
        "explorer": capability_entry(if rollout.explorer { CapState::Ready } else { CapState::Disabled }, "ok"),
        "export": capability_entry(if rollout.export { CapState::Ready } else { CapState::Disabled }, "native-rollout"),
        "scm": scm,
        "staging": capability_entry(if rollout.staging { CapState::Ready } else { CapState::Disabled }, "native-rollout"),
        "apply": capability_entry(if rollout.apply { CapState::Ready } else { CapState::Disabled }, "native-rollout"),
        "wasi": capability_entry(CapState::Unavailable, "feasibility-gate"),
        "worktrees": capability_entry(CapState::Unavailable, "feasibility-gate"),
        "directMutation": capability_entry(
            if rollout.direct_mutation { CapState::Ready } else { CapState::Disabled },
            "native-rollout",
        ),
    })
}
