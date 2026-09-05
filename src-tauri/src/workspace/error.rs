#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceError {
    pub code: &'static str,
    pub message: String,
}

impl WorkspaceError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn to_ipc_err(&self) -> String {
        format!("{}: {}", self.code, self.message)
    }

    pub fn to_envelope(&self) -> serde_json::Value {
        serde_json::json!({
            "ok": false,
            "error": { "code": self.code, "message": self.message },
        })
    }
}

pub fn envelope_ok(value: serde_json::Value) -> serde_json::Value {
    serde_json::json!({ "ok": true, "value": value })
}

pub const UNAUTHORIZED_ROOT: &str = "UNAUTHORIZED_ROOT";
pub const OUTSIDE_ROOT: &str = "OUTSIDE_ROOT";
pub const SYMLINK_ESCAPE: &str = "SYMLINK_ESCAPE";
pub const STALE_CAPABILITY: &str = "STALE_CAPABILITY";
pub const WRONG_WINDOW: &str = "WRONG_WINDOW";
pub const REVOKED: &str = "REVOKED";
pub const PERMISSION_DENIED: &str = "PERMISSION_DENIED";
#[allow(dead_code)] // referenced from workspace::handle on non-desktop OS cfgs
pub const UNSUPPORTED_PLATFORM: &str = "UNSUPPORTED_PLATFORM";
pub const NOT_FOUND: &str = "NOT_FOUND";
pub const ALREADY_EXISTS: &str = "ALREADY_EXISTS";
pub const CONFLICT: &str = "CONFLICT";
pub const AMBIGUOUS_EDIT: &str = "AMBIGUOUS_EDIT";
pub const MUTATION_DISABLED: &str = "MUTATION_DISABLED";
pub const HARD_DENIED: &str = "HARD_DENIED";
pub const BINARY: &str = "BINARY";
pub const CANCELLED: &str = "CANCELLED";
pub const LIMIT_EXCEEDED: &str = "LIMIT_EXCEEDED";
pub const QUEUE_SATURATED: &str = "QUEUE_SATURATED";
pub const FEATURE_DISABLED: &str = "FEATURE_DISABLED";
pub const EXPORT_CONFLICT: &str = "EXPORT_CONFLICT";
pub const EXPORT_CANCELLED: &str = "EXPORT_CANCELLED";
pub const ENOSPC: &str = "ENOSPC";
pub const REPOSITORY_OUTSIDE_ROOT: &str = "REPOSITORY_OUTSIDE_ROOT";
pub const GIT_UNAVAILABLE: &str = "GIT_UNAVAILABLE";
pub const SCM_TIMEOUT: &str = "SCM_TIMEOUT";
pub const SCM_DISABLED: &str = "SCM_DISABLED";
pub const CHANGE_SET_INVALID: &str = "CHANGE_SET_INVALID";
pub const APPLY_TICKET_INVALID: &str = "APPLY_TICKET_INVALID";
pub const PARTIAL_APPLY: &str = "PARTIAL_APPLY";

pub fn unauthorized_root(msg: &str) -> WorkspaceError {
    WorkspaceError::new(UNAUTHORIZED_ROOT, msg)
}

pub fn outside_root() -> WorkspaceError {
    WorkspaceError::new(OUTSIDE_ROOT, "Path is outside the authorized project root")
}

pub fn symlink_escape() -> WorkspaceError {
    WorkspaceError::new(SYMLINK_ESCAPE, "Refusing to follow a symlink or reparse point")
}

pub fn stale_capability() -> WorkspaceError {
    WorkspaceError::new(STALE_CAPABILITY, "Capability is stale or does not match the current root generation")
}

pub fn wrong_window() -> WorkspaceError {
    WorkspaceError::new(WRONG_WINDOW, "Privileged workspace operations are bound to the main window")
}

pub fn revoked() -> WorkspaceError {
    WorkspaceError::new(REVOKED, "Capability was revoked")
}

pub fn not_found(path: &str) -> WorkspaceError {
    WorkspaceError::new(NOT_FOUND, format!("Not found: {path}"))
}

pub fn already_exists(path: &str) -> WorkspaceError {
    WorkspaceError::new(ALREADY_EXISTS, format!("Already exists: {path}"))
}

pub fn conflict(path: &str) -> WorkspaceError {
    WorkspaceError::new(CONFLICT, format!("Revision mismatch: {path}"))
}

pub fn ambiguous_edit() -> WorkspaceError {
    WorkspaceError::new(AMBIGUOUS_EDIT, "oldString matched zero or multiple times")
}

pub fn mutation_disabled() -> WorkspaceError {
    WorkspaceError::new(MUTATION_DISABLED, "Workspace mutation is disabled")
}

pub fn hard_denied(path: &str) -> WorkspaceError {
    WorkspaceError::new(HARD_DENIED, format!("Path is excluded from project context: {path}"))
}

pub fn cancelled() -> WorkspaceError {
    WorkspaceError::new(CANCELLED, "Workspace request was cancelled")
}

pub fn limit_exceeded(msg: &str) -> WorkspaceError {
    WorkspaceError::new(LIMIT_EXCEEDED, msg)
}

pub fn queue_saturated() -> WorkspaceError {
    WorkspaceError::new(QUEUE_SATURATED, "Too many concurrent workspace operations")
}

pub fn feature_disabled(name: &str) -> WorkspaceError {
    WorkspaceError::new(FEATURE_DISABLED, format!("{name} is disabled"))
}

#[allow(dead_code)]
pub fn export_cancelled() -> WorkspaceError {
    WorkspaceError::new(EXPORT_CANCELLED, "Export was cancelled")
}

pub fn enospc() -> WorkspaceError {
    WorkspaceError::new(ENOSPC, "Not enough space to complete the export or apply")
}

pub fn repository_outside_root() -> WorkspaceError {
    WorkspaceError::new(REPOSITORY_OUTSIDE_ROOT, "Git repository root is outside the authorized folder")
}

pub fn git_unavailable() -> WorkspaceError {
    WorkspaceError::new(GIT_UNAVAILABLE, "Git is not available")
}

pub fn scm_timeout() -> WorkspaceError {
    WorkspaceError::new(SCM_TIMEOUT, "Source control operation timed out")
}

pub fn apply_ticket_invalid() -> WorkspaceError {
    WorkspaceError::new(APPLY_TICKET_INVALID, "Apply ticket is invalid, expired, or already used")
}

pub fn change_set_invalid(msg: &str) -> WorkspaceError {
    WorkspaceError::new(CHANGE_SET_INVALID, msg)
}
