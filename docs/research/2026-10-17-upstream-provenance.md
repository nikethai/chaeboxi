---
type: research
status: draft
description: "Which files on main still contain code, text or assets from the upstream GPLv3 project, and how much"
generated: { by: claude/opus-5.5, at: 2026-10-17T13:45:00+07:00 }
---
# Upstream provenance audit

**Date:** 2026-10-17
**Ref audited:** `origin/main` at `3f7c2725`
**Upstream baseline:** `fe801920` (last upstream commit before the fork diverged, "release 1.19.0", 2026-02-13) and `upstream/main` at `40cbd874` (2026-08-09)
**Per-file data:** [`files.csv`](2026-10-17-upstream-provenance/files.csv), 799 rows
**Plan that uses this:** [clean-room rewrite plan](../specs/2026-10-17-clean-room-relicense.md)

## Why

Dango is GPL-3.0-only because it is derived from an upstream GPLv3 project. Moving to another license needs every piece of upstream-authored code, copy and asset either removed or rewritten from scratch. This note says what is left and where.

## Method

Four independent checks. A file counts as upstream-derived if any of them flags it.

1. **Blame with move and copy detection.** `git blame -w -M -C -C` on all 1,557 text files (lock files and binaries excluded). Each line is credited to its author. Lines whose author email matches `thong|nikethai|canvilled|huyminh|huynguyen` (case-insensitive) count as team lines; everything else counts as upstream.
2. **Copy detection (4-line runs).** Each line is trimmed and runs of spaces are collapsed. Lines shorter than 10 characters, and trivial lines (braces, imports, comments), are dropped. Each run of 4 remaining lines is hashed. A line counts as matched if it falls inside a run that also occurs in the upstream code at `fe801920` or `upstream/main`. This catches code that was moved, renamed or lightly edited, which blame credits to whoever moved it.
3. **Identical files.** A file is flagged if its git blob is byte-for-byte equal to any blob anywhere in upstream history (11,637 objects). This is the only check that covers images, fonts and other binaries.
4. **Usage.** Upstream-owned files are grep-checked for imports that still reference them. The check is a heuristic, so some of what it flags may still be in use.

Each file's upstream share is the larger of (blame upstream lines ÷ blamed lines) and (matched lines ÷ significant lines). Files are classified as follows:

| Class | Rule | Files |
|---|---|---|
| identical | blob equals an upstream blob | 273 |
| upstream | share ≥ 80% | 224 |
| mixed | share 10–80% | 156 |
| trace | share < 10%, but at least 1 upstream blame line or 4 matched lines | 155 |
| clean | none of the above | 996 |
| **total** | | **1,804** |

## Findings

**Overall.** Blame credits 180,808 lines to the team and 82,306 lines to upstream (31.3%). After excluding lock files, `LICENSE`/`NOTICE` and `docs/archive/`, about 80,100 upstream-derived lines remain, spread across 799 files. That count includes code that blame credits to the team but that the copy check matched to upstream.

**What is already clean:**
- **Rust backend.** All 166 files under `src-tauri/` are clean. This includes the knowledge base, MCP client, workspace and IPC code.
- **Your own modules.** 451 source files and 139 test files are fully clean under all four checks.
- **Website.** It is clean apart from `site.css` and its lock file.

**Where upstream code concentrates:**

| Work package | Files | Est. upstream lines |
|---|---:|---:|
| WP00 dead code and unused assets (delete) | 76 | 3,363 |
| WP01 i18n: 13 locale files, changelogs, English copy | 21 | 14,221 |
| WP02 token estimation and context management | 18 | 2,932 |
| WP03 providers and model layer | 83 | 6,762 |
| WP04 stores, storage, migration, types | 56 | 6,645 |
| WP05 platform, bootstrap, app shell | 34 | 2,682 |
| WP06 feature packages (knowledge-base UI, MCP registry, remote, initial data, web search) | 60 | 6,514 |
| WP07 settings UI | 46 | 3,322 |
| WP08 image creator | 12 | 1,707 |
| WP09 chat UI and components (includes dev routes) | 138 | 10,606 |
| WP10 modals | 22 | 1,502 |
| WP11 shared utilities and hooks | 51 | 3,534 |
| WP12 tests and fixtures | 69 | 12,996 |
| WP13 build config and tooling | 18 | 1,073 |
| WP14 images, icons, fonts | 68 | binary |
| WP15 docs, repo meta, templates | 27 | 2,171 |

Of the 799 files, 153 are "trace" files with about 1,000 upstream lines between them. Most of those lines are boilerplate that blame credits to upstream, such as a shared `useTranslation` line. They are low risk, but they still need to be swept.

**Specific points:**
- **i18n keys are upstream copy.** The English locale uses the English sentence itself as the key (1,283 keys). Rewriting the copy therefore means new keys too. The 13 non-English locales are about 860 lines each of upstream translations. The three changelog files are upstream release notes.
- **Code ported from newer upstream releases.** 14 files gained matches when `upstream/main` was added to the comparison, about 200 lines. The main ones are `src/shared/providers/definitions/minimax.ts` and `.../models/openai-responses.ts`. These were ported after the fork, so they are already included in the totals.
- **Vendored third-party code.** `src/shared/utils/word_count.ts` carries a 2015–2016 copyright header for Hsiaoming Yang (yuehu/word-count). It belongs to that third party, not to upstream. Confirm its license and keep the notice, or replace the file.
- **Third-party logos.** The images in `src/renderer/static/logos/` and `static/icons/providers/` are other companies' marks, in copies brought in by upstream. They should be re-sourced from each brand's official kit or another permissively licensed source.
- **Brand strings.** "chatbox" still appears in 271 files: env vars such as `CHATBOX_BUILD_PLATFORM`, `stripChatboxPaidFeatures()` and Tailwind tokens. This is a trademark and tidiness issue, not a copyright one.
- **Docs archive.** `docs/archive/` contains 6 files with upstream text (about 2,070 lines). The archive is read-only by policy, so deciding what to do with it is a maintainer call.

## Dependencies

**npm.** 2,552 packages were found in `node_modules`, which may include stale packages. Almost all are permissive: MIT 1,953, Apache-2.0 277, ISC 163, BSD 92. The rest need attention:

- **Dual-licensed packages.** Pick the permissive option and record that choice:
  - jszip (MIT or GPL-3.0) → MIT
  - node-forge (BSD-3-Clause or GPL-2.0) → BSD-3-Clause
  - dompurify (MPL-2.0 or Apache-2.0) → Apache-2.0
  - harmony-reflect (Apache-2.0 or MPL-1.1) → Apache-2.0
- **No license in `package.json`.** Confirm each one before relicensing:
  - `@a2a-js/sdk`
  - `@giscus/react`
  - `@splinetool/runtime`
  - `applescript`
  - `cohere-ai` (a direct dependency)
  - `khroma`
  - `spawn-command`
- **Other unclear entries.**
  - `@trapezedev/project` and `@trapezedev/gradle-parse` say "SEE LICENSE", so the license file needs reading.
  - Two packages declare FSL-1.1-MIT, a source-available license that turns into MIT after two years. The audit could not identify which packages these are.

**Cargo.** There are 20 direct crates in `src-tauri/Cargo.toml`. Their licenses were not checked because there is no Cargo toolchain in the audit environment; the plan runs `cargo deny check licenses`.

## Limits

- **Blame cannot see AI or by-hand rewrites.** Code reworked from upstream by hand or by an AI shows up as team code in blame. The copy check only catches it when 4 consecutive significant lines survive, so a heavy rewrite is invisible to both checks. Behaviour and structure copied without the text cannot be detected by any script; only the clean-room process in the plan covers that.
- **The copy check over-matches common boilerplate.** Some "trace" hits are boilerplate that is not protectable on its own.
- **The usage check is a grep heuristic.** Before deleting anything it flags, confirm with `pnpm check` and a build.
- **This audit is engineering evidence, not a legal opinion.**
