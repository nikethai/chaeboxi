//! macOS Accessibility hybrid grounding for Computer Use.
//! Query / focus / press AX roles; empty trees return `fallback: "vision"`.

mod matchers;
#[cfg(target_os = "macos")]
mod macos;

use serde_json::Value;

pub async fn ax_query(params: &Value) -> Result<Value, String> {
    ax_dispatch("query", params).await
}

pub async fn ax_act(params: &Value) -> Result<Value, String> {
    ax_dispatch("act", params).await
}

async fn ax_dispatch(kind: &str, params: &Value) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        return macos::dispatch(kind, params).await;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (kind, params);
        Ok(serde_json::json!({
            "ok": false,
            "error": "UNSUPPORTED",
            "fallback": "vision",
            "note": "Accessibility tree grounding is macOS-only. Use screenshots and pixel acts."
        }))
    }
}
