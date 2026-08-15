# RAG / Knowledge Base

Retrieval-augmented generation for private documents. **Desktop v1 is local-first.**

## What v1 actually does

On **macOS / Linux / Windows**, the Tauri backend (`src-tauri/src/kb/`) persists knowledge bases in SQLite at app data `chaeboxi_kb.db` and searches with a **keyword + vector hybrid** (RRF, top 20).

| Piece | Reality |
| --- | --- |
| Metadata, files, chunks, embeddings | SQLite `chaeboxi_kb.db` (AUTOINCREMENT ids — survive quit) |
| Default embedder | `local:multilingual-e5-small` (intfloat E5, 384-d, ONNX) |
| Model file | Downloaded **once** (~180MB) into `models/multilingual-e5-small/`. **Not** bundled in the installer. After the first download, airplane mode works. |
| Chunking | 1200 characters / 150 overlap. Prefix `passage:` on docs and `query:` on search. |
| Search | Keep keyword `score_search_text`; add cosine over embedding BLOBs; fuse with RRF. If the model is not ready, **keyword only — no error toast**. |
| Parse | `.txt` / `.md` / `.csv` / `.json` / `.log` / `.pdf` (local text extract). Scanned/empty PDFs and Office fail honestly. |
| Worker | `pending` / retry / resume actually embed, one batch at a time. Status via `kb:embed:status`. |
| Mobile (iOS/Android) | Keyword / in-memory path only. No sqlite-vec, no model download, no KB UI changes. |

There is **no Mastra**, no `@mastra/rag`, and no sqlite-vec requirement in v1. Embeddings are `BLOB`s of little-endian `f32`; cosine runs in Rust.

## High-level flow

1. User creates a knowledge base (default embedding model: on-device E5).
2. User uploads a text file. Rust parses honestly, chunks with overlap, writes rows to SQLite, status `pending`.
3. The embed worker prefixes `passage:` and writes vectors when the local model (or a user-picked Ollama/BYOK model) is ready.
4. At chat time, `kb:search` embeds the query with `query:`, ranks by keyword + cosine, fuses with RRF, returns top 20.
5. The model answers with those chunks.

## Optional cloud / Ollama

The create form defaults to `local:multilingual-e5-small`. If the user picks Ollama or another provider, a warning explains that **text leaves the device**. Rerank, vision, MinerU, and PDF/Office parsing are **out of scope** for v1.

## Implementation pointers

- Rust module: `src-tauri/src/kb/` (`mod.rs`, `persist.rs`, `embed.rs`, `search.rs`, `parse.rs`)
- IPC: existing `kb:*` channels plus `kb:embed:status`. JSON field names are unchanged (mixed camelCase / snake_case).
- UI: `src/renderer/components/knowledge-base/`
- Platform contract: `src/renderer/platform/knowledge-base/`
- Model id parser: `src/shared/utils/knowledge-base-model-parser.ts`

## Airplane mode

After the first successful download of `multilingual-e5-small` into app data, local embedding and search do not need the network. The installer does **not** ship the ONNX weights.

## Notes

- Chaeboxi hosted document-parser cloud is **disabled** (`CHATBOX_CLOUD_ENABLED = false`).
- Prefer the on-device model for privacy.

## Tests

Rust unit tests live next to the modules (`persist`, `parse`, `search`, `embed`).

On a full desktop Tauri toolchain:

```bash
cd src-tauri && cargo test --lib kb::
```

Without GTK/WebKit (this repo also has a thin harness that `#[path]`-includes the logic modules):

```bash
cargo test --manifest-path src-tauri/kb-tests/Cargo.toml
```

Covered: SQLite survive-reopen, honest PDF/Office fail, 1200/150 chunk overlap, RRF fuse, keyword fallback, Vietnamese paraphrase via fake vectors (top 5).
