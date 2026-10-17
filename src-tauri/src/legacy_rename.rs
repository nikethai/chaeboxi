//! One-time move of data left behind by the app's previous name.
//!
//! The app was called Chaeboxi with the bundle identifier `com.chaeboxi`. The
//! OS keys every per-app folder by that identifier (app data, config, caches,
//! logs, and the webview's own storage), so after the rename to Dango
//! (`com.dango`) a first launch would otherwise look empty.
//!
//! This runs at the very start of `run()`, before Tauri creates any window,
//! because the webview opens its storage as soon as the first window exists.
//! For each per-app base folder it renames `<base>/com.chaeboxi` to
//! `<base>/com.dango` when the old one exists and the new one does not. A
//! rename on the same volume is atomic and needs no extra disk space. When the
//! new folder already exists (the user has run Dango before), nothing is
//! touched, so this never overwrites anything.
//!
//! Inside the moved data folder, the knowledge-base file `chaeboxi_kb.db` (and
//! its SQLite `-wal` / `-shm` companions) is renamed to `dango_kb.db` the same
//! way.
//!
//! Keychain items are migrated lazily by the renderer (see
//! `src/renderer/packages/integrations/secret-store.ts`).

use std::path::{Path, PathBuf};

pub const LEGACY_IDENTIFIER: &str = "com.chaeboxi";
pub const IDENTIFIER: &str = "com.dango";
pub const LEGACY_KB_FILENAME: &str = "chaeboxi_kb.db";

/// Per-app base folders on this OS. Each one holds a folder named after the
/// bundle identifier.
pub fn base_dirs() -> Vec<PathBuf> {
    let mut out = Vec::new();
    #[cfg(target_os = "macos")]
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        let lib = home.join("Library");
        for sub in [
            "Application Support",
            "Caches",
            "Logs",
            "WebKit",
            "HTTPStorages",
        ] {
            out.push(lib.join(sub));
        }
    }
    #[cfg(target_os = "windows")]
    for var in ["APPDATA", "LOCALAPPDATA"] {
        if let Some(dir) = std::env::var_os(var) {
            out.push(PathBuf::from(dir));
        }
    }
    #[cfg(target_os = "linux")]
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        let xdg = |var: &str, fallback: &str| {
            std::env::var_os(var)
                .map(PathBuf::from)
                .filter(|p| p.is_absolute())
                .unwrap_or_else(|| home.join(fallback))
        };
        out.push(xdg("XDG_DATA_HOME", ".local/share"));
        out.push(xdg("XDG_CONFIG_HOME", ".config"));
        out.push(xdg("XDG_CACHE_HOME", ".cache"));
    }
    out
}

/// Renames `<base>/<old>` to `<base>/<new>` for every base where the old
/// folder exists and the new one does not. Returns the folders that moved.
pub fn move_identifier_dirs(bases: &[PathBuf], old: &str, new: &str) -> Vec<PathBuf> {
    let mut moved = Vec::new();
    for base in bases {
        let from = base.join(old);
        let to = base.join(new);
        if !from.is_dir() || to.exists() {
            continue;
        }
        match std::fs::rename(&from, &to) {
            Ok(()) => moved.push(to),
            Err(err) => eprintln!(
                "[rename] could not move {} to {}: {err}",
                from.display(),
                to.display()
            ),
        }
    }
    moved
}

/// Renames `<dir>/<old_name>` (and its `-wal` / `-shm` files) to
/// `<dir>/<new_name>` when the new main file does not exist yet.
pub fn rename_kb_file(dir: &Path, old_name: &str, new_name: &str) -> bool {
    let old_main = dir.join(old_name);
    let new_main = dir.join(new_name);
    if !old_main.is_file() || new_main.exists() {
        return false;
    }
    for suffix in ["", "-wal", "-shm"] {
        let from = dir.join(format!("{old_name}{suffix}"));
        let to = dir.join(format!("{new_name}{suffix}"));
        if from.exists() && !to.exists() {
            if let Err(err) = std::fs::rename(&from, &to) {
                eprintln!("[rename] could not rename {}: {err}", from.display());
                return false;
            }
        }
    }
    true
}

/// Runs the whole migration. Safe to call on every launch: once the new
/// folders exist it does nothing.
pub fn migrate() {
    let bases = base_dirs();
    let moved = move_identifier_dirs(&bases, LEGACY_IDENTIFIER, IDENTIFIER);
    for dir in &moved {
        eprintln!("[rename] moved data to {}", dir.display());
    }
    for base in &bases {
        rename_kb_file(
            &base.join(IDENTIFIER),
            LEGACY_KB_FILENAME,
            crate::kb::persist::DB_FILENAME,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dango-rename-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn identifier_matches_tauri_config() {
        let conf: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(conf["identifier"], IDENTIFIER);
    }

    #[test]
    fn moves_old_folder_when_new_is_missing() {
        let root = temp_root("move");
        fs::create_dir_all(root.join(LEGACY_IDENTIFIER)).unwrap();
        fs::write(root.join(LEGACY_IDENTIFIER).join("settings.json"), "{}").unwrap();

        let moved = move_identifier_dirs(&[root.clone()], LEGACY_IDENTIFIER, IDENTIFIER);

        assert_eq!(moved, vec![root.join(IDENTIFIER)]);
        assert!(root.join(IDENTIFIER).join("settings.json").is_file());
        assert!(!root.join(LEGACY_IDENTIFIER).exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn never_overwrites_an_existing_new_folder() {
        let root = temp_root("keep");
        fs::create_dir_all(root.join(LEGACY_IDENTIFIER)).unwrap();
        fs::create_dir_all(root.join(IDENTIFIER)).unwrap();
        fs::write(root.join(IDENTIFIER).join("settings.json"), "new").unwrap();

        let moved = move_identifier_dirs(&[root.clone()], LEGACY_IDENTIFIER, IDENTIFIER);

        assert!(moved.is_empty());
        assert_eq!(
            fs::read_to_string(root.join(IDENTIFIER).join("settings.json")).unwrap(),
            "new"
        );
        assert!(root.join(LEGACY_IDENTIFIER).exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn skips_missing_bases_quietly() {
        let root = temp_root("missing");
        let moved = move_identifier_dirs(&[root.join("nope")], LEGACY_IDENTIFIER, IDENTIFIER);
        assert!(moved.is_empty());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn renames_kb_file_with_sqlite_companions() {
        let root = temp_root("kb");
        for suffix in ["", "-wal", "-shm"] {
            fs::write(root.join(format!("{LEGACY_KB_FILENAME}{suffix}")), suffix).unwrap();
        }

        assert!(rename_kb_file(&root, LEGACY_KB_FILENAME, "dango_kb.db"));

        for suffix in ["", "-wal", "-shm"] {
            assert!(root.join(format!("dango_kb.db{suffix}")).is_file());
            assert!(!root.join(format!("{LEGACY_KB_FILENAME}{suffix}")).exists());
        }
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn leaves_kb_alone_when_new_file_exists() {
        let root = temp_root("kb-keep");
        fs::write(root.join(LEGACY_KB_FILENAME), "old").unwrap();
        fs::write(root.join("dango_kb.db"), "new").unwrap();

        assert!(!rename_kb_file(&root, LEGACY_KB_FILENAME, "dango_kb.db"));
        assert_eq!(fs::read_to_string(root.join("dango_kb.db")).unwrap(), "new");
        let _ = fs::remove_dir_all(&root);
    }
}
