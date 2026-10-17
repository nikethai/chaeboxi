---
type: decision
status: draft
description: "Rename the app from Chaeboxi to Dango, including internal identifiers, with a one-time data move"
generated: { by: claude/opus-5.5, at: 2026-10-17T07:40:00+07:00 }
---
# ADR 0012: Rename to Dango

Status: proposed 2026-10-17, decided by the maintainer in conversation; waiting for `verified`.

## Context

The redesign gave the app a mascot: one round, dark body with two tilted eyes, "rounder like a dango". The name Chaeboxi is hard to say, hard to spell, and carries the old open-cube identity that the redesign replaces. The maintainer chose Dango.

Names are wired into stored data, not only into copy. The bundle identifier `com.chaeboxi` names every per-app folder the OS keeps (app data, config, caches, logs, and the webview's IndexedDB and localStorage). Integration tokens sit in the OS keychain under the service `chaeboxi.integrations`. The desktop knowledge base is `chaeboxi_kb.db`. Room packs are tagged `chaeboxi-room-pack`. Changing any of these without a move makes a first launch look empty.

## Decision

Rename everything, internal identifiers included, and move existing data on first launch.

| What | Before | After |
|---|---|---|
| Product name, window title, copy in every locale | Chaeboxi | Dango |
| App identifier: desktop, iOS, Android | `com.chaeboxi`, `com.chaeboxi.app`, `com.chaeboxi` | `io.github.nikethai.dango` on all three |
| Crate, binary, npm package | `chaeboxi`, `chaeboxi_lib` | `dango`, `dango_lib` |
| Keychain service | `chaeboxi.integrations` | `dango.integrations` |
| Knowledge-base file | `chaeboxi_kb.db` | `dango_kb.db` |
| Room pack tag and extension | `chaeboxi-room-pack`, `.chaeboxi-room.json` | `dango-room-pack`, `.dango-room.json` |
| Build env vars | `CHAEBOXI_*` | `DANGO_*` |
| Repo, issues, Pages links | `nikethai/chaeboxi`, `nikethai.github.io/chaeboxi` | `nikethai/dango`, `nikethai.github.io/dango` |
| Repo skills | `.claude/skills/chaeboxi-*` | `.claude/skills/dango-*` |

How existing data comes across:

- **Per-app folders** (`src-tauri/src/legacy_rename.rs`). At the very start of `run()`, before any window or webview exists, each `<base>/com.chaeboxi` is renamed to `<base>/io.github.nikethai.dango` when the old folder exists and the new one does not. Bases: macOS `~/Library/{Application Support, Caches, Logs, WebKit, HTTPStorages}`; Windows `%APPDATA%`, `%LOCALAPPDATA%`; Linux XDG data, config and cache. A rename is atomic on the same volume. If the new folder already exists, nothing is touched.
- **Knowledge base.** Inside the moved data folder, `chaeboxi_kb.db` and its `-wal`/`-shm` files are renamed to `dango_kb.db`.
- **Keychain** (`secret-store.ts`). On the first read of an integration secret, the old service is checked, the item is copied to the new service, and the old item is removed only after the copy succeeds. Deleting an account removes both.
- **Room packs.** Packs tagged `chaeboxi-room-pack` still import; the file picker accepts both extensions.

Kept as they were:

- Dated records stay as written: `docs/archive/`, `docs/adr/` 0001–0011, `docs/research/`, `docs/specs/`, earlier `docs/log.md` entries, and `assets/logo-design/2026-08-05-chaeboxi/`.
- The history-sync server keeps its deploy defaults (`chaeboxi-history-sync` service name, `/opt/…` and `/var/lib/…` paths, run user), so an existing install is not orphaned. Rename those on the server itself if wanted.

## Consequences

- **Rollback.** An older Chaeboxi build opened after Dango has run will start empty, because its folder has moved. Downgrades are not supported; this is acceptable before 1.0.
- **macOS keychain prompt.** The first time Dango reads a token saved by Chaeboxi, macOS may ask whether Dango can use that item, because the old item's access list names the old app. Allowing it once completes the move.
- **iOS and Android.** Phone storage is sandboxed per bundle ID and cannot be moved by the app. A new bundle ID is a new app: a TestFlight or store listing under `com.chaeboxi.app` does not carry over, and phone data starts fresh.
- **Why `io.github.nikethai.dango`.** Reverse-DNS IDs should sit on a domain you control. Nobody here owns dango.com, and Apple bundle IDs are unique across all developers, so `com.dango.app` might already be registered. The GitHub Pages domain is the maintainer's, so the ID cannot collide. If Dango gets its own domain later, keep this ID anyway: changing it again means another migration.
- **GitHub.** The maintainer renames the repository to `dango`. GitHub redirects old repo, clone and issue URLs. Pages does not redirect: `nikethai.github.io/chaeboxi` stops working when the repository is renamed.
- **Name clearance.** A web search on 2026-10-17 found earlier software called Dango, including an emoji-prediction keyboard from 2016. This is not a trademark search. Check the USPTO and WIPO databases before a store listing.
- **Not checked here.** A full desktop build: `cargo check` could not complete in the agent's Linux sandbox because the ONNX Runtime download is blocked. The migration module was tested on its own (6 unit tests plus a run against a fake home folder). Run `pnpm dev` once on the Mac to confirm.

## Alternatives considered

- **Visible name only.** Keep every identifier as `chaeboxi`. No risk, but the old name would stay in folder names, the keychain and file names for good.
- **Rename without moving data.** Simplest, but chats, settings, tokens and the knowledge base would not carry over.
