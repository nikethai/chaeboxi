# RAG / Knowledge Base

Retrieval-augmented generation for private documents.

## Overview

Chaeboxi supports a local knowledge base so models can answer using user-provided files. On desktop, retrieval and embeddings integrate with the Tauri / platform layer; mobile and web use platform-appropriate storage.

## High-level flow

1. User uploads or indexes documents into a knowledge base.
2. Text is chunked and embedded.
3. At chat time, relevant chunks are retrieved and injected into the model context.
4. The model answers with that context (and optional citations depending on UI).

## Implementation pointers

- Knowledge base UI: `src/renderer/components/knowledge-base/`
- Platform contracts: `src/renderer/platform/`
- Settings related to document parsing: settings store + document parser types (legacy `chatbox-ai` parser values are mapped away; prefer `local` / `mineru` / `none`)

## Notes

- Chaeboxi hosted document-parser cloud is **disabled** in Chaeboxi (`CHATBOX_CLOUD_ENABLED = false`).
- Prefer local parsing for privacy.
