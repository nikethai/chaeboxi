//! Quick Local Run discovery. Host execution is never a fallback.

use super::error::feature_disabled;
use super::policy::CapState;
use serde_json::{json, Value};

pub const WASI_NO_GO_REASON: &str =
    "No pinned WASI-compatible QuickJS artifact (version, digest, license, Preview ABI) is bundled. \
     Wasmtime is not linked. Host execution, Docker, and Node are not substitutes.";

pub fn status() -> Value {
    json!({
        "state": CapState::Unavailable.as_str(),
        "reason": "feasibility-gate",
        "detail": WASI_NO_GO_REASON,
        "provider": "none",
        "language": "javascript",
        "hostExecution": false,
    })
}

pub fn reject_run() -> super::error::WorkspaceError {
    feature_disabled("wasi")
}
