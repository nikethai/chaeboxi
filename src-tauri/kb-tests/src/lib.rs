//! Re-exports kb logic modules so tests run without Tauri/GTK.
#[path = "../../src/kb/parse.rs"]
pub mod parse;
#[path = "../../src/kb/search.rs"]
pub mod search;
#[path = "../../src/kb/persist.rs"]
pub mod persist;
