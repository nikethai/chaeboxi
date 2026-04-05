# Sprint 6 Design: Unified Search + OpenClaw Integration

**Date**: 2026-04-05
**Status**: Draft — Pending approval

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CHAEBOXI SEARCH LAYER                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              SHARED CITATION UI (Layer 3)             │   │
│  │  CitationBadge [1][2]  │  SourceCard  │  FollowUps   │   │
│  └──────────────┬───────────────────────┬───────────────┘   │
│                 │                       │                    │
│  ┌──────────────▼──────┐  ┌────────────▼───────────────┐   │
│  │  BUILT-IN (Layer 1) │  │   TURBO MODE (Layer 2)     │   │
│  │                      │  │                            │   │
│  │  ┌────────────────┐ │  │  ┌────────────────────┐    │   │
│  │  │ Search Providers│ │  │  │ OpenClaw Gateway   │    │   │
│  │  │ ┌──────┐       │ │  │  │ (WS client)        │    │   │
│  │  │ │Tavily│       │ │  │  │ ┌──────────────┐   │    │   │
│  │  │ │Exa   │ NEW   │ │  │  │ │Multi-step    │   │    │   │
│  │  │ │Serper│       │ │  │  │ │research agent│   │    │   │
│  │  │ │Bing  │       │ │  │  │ │+ CDP scraping│   │    │   │
│  │  │ │DDG   │       │ │  │  │ └──────────────┘   │    │   │
│  │  │ └──────┘       │ │  │  └────────────────────┘    │   │
│  │  │                │ │  │                            │   │
│  │  │ ┌────────────┐ │ │  │  ┌────────────────────┐    │   │
│  │  │ │Gemini      │ │ │  │  │ MCP Search Servers │    │   │
│  │  │ │Grounding   │ │ │  │  │ (Firecrawl, Brave, │    │   │
│  │  │ │(native API)│ │ │  │  │  Jina, Crawl4AI)   │    │   │
│  │  │ └────────────┘ │ │  │  └────────────────────┘    │   │
│  │  │                │ │  │                            │   │
│  │  │ ┌────────────┐ │ │  └────────────────────────────┘   │
│  │  │ │Jina Reader │ │ │                                    │
│  │  │ │(page scrape│ │ │                                    │
│  │  │ └────────────┘ │ │                                    │
│  │  └────────────────┘ │                                    │
│  └──────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### SearchCitation (new type in session.ts)

```typescript
interface SearchCitation {
  index: number           // [1], [2], etc.
  url: string
  title: string
  snippet?: string
  favicon?: string        // https://www.google.com/s2/favicons?domain=...
  source: 'builtin' | 'gemini-grounding' | 'openclaw' | 'mcp'
  accessedAt: number
  relevanceScore?: number // 0-1, from search provider
}
```

### Enhanced Message (extend existing)

```typescript
// Extend MessageSchema in session.ts
citations?: SearchCitation[]      // Citations for this message
searchQuery?: string              // Original search query used
searchProvider?: string           // Which provider answered
groundingMetadata?: {             // Gemini-specific grounding data
  searchEntryPoint?: string       // Google Search link
  groundingChunks?: Array<{
    web?: { uri: string; title: string }
  }>
  groundingSupports?: Array<{
    segment: { startIndex: number; endIndex: number; text: string }
    groundingChunkIndices: number[]
    confidenceScores: number[]
  }>
}
```

---

## Feature 1: Gemini Grounding with Google Search

### Why this is the biggest quick win

You already have a Gemini API key. Google Grounding:
- Returns **inline citations automatically** — no extra API calls
- Includes **grounding supports** mapping text segments to sources
- Includes **confidence scores** per citation
- **Free** with Gemini API (included in token cost)
- Works on `gemini-2.5-flash` and `gemini-2.5-pro`

### Implementation

**File: `src/shared/providers/definitions/models/gemini.ts`**

Add `google_search_retrieval` tool to Gemini requests:

```typescript
// When web search is enabled for this session:
tools: [
  ...existingTools,
  { google_search_retrieval: { dynamic_retrieval_config: { mode: "MODE_DYNAMIC", dynamic_threshold: 0.3 } } }
]
```

The response includes `groundingMetadata` in the candidate:
```json
{
  "candidates": [{
    "content": { "parts": [{ "text": "..." }] },
    "groundingMetadata": {
      "searchEntryPoint": { "renderedContent": "<style>...</style>" },
      "groundingChunks": [
        { "web": { "uri": "https://...", "title": "..." } }
      ],
      "groundingSupports": [
        {
          "segment": { "startIndex": 0, "endIndex": 85, "text": "..." },
          "groundingChunkIndices": [0],
          "confidenceScores": [0.95]
        }
      ]
    }
  }]
}
```

**File: `src/shared/models/abstract-ai-sdk.ts`** (or gemini model)

Parse grounding metadata from response and attach to message:
```typescript
// After streaming completes, extract grounding metadata
const groundingMetadata = result.response?.candidates?.[0]?.groundingMetadata
if (groundingMetadata) {
  const citations: SearchCitation[] = groundingMetadata.groundingChunks
    ?.map((chunk, i) => ({
      index: i + 1,
      url: chunk.web?.uri ?? '',
      title: chunk.web?.title ?? '',
      source: 'gemini-grounding' as const,
      accessedAt: Date.now(),
    }))
    .filter(c => c.url) ?? []

  // Attach to message
  targetMsg.citations = citations
  targetMsg.groundingMetadata = groundingMetadata
}
```

**Effort**: 1-2 days (you already have the API key and Gemini provider)

---

## Feature 2: Enhanced Built-in Search (Exa + Jina Reader)

### Exa Search Provider (new)

**File: `src/renderer/packages/web-search/exa.ts`**

```typescript
import { WebSearch, type WebSearchResult } from './base'

export default class ExaWebSearch extends WebSearch {
  async search(query: string): Promise<WebSearchResult[]> {
    const response = await this.fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        type: 'neural',              // Semantic search
        useAutoprompt: true,          // Let Exa optimize the query
        numResults: 8,
        contents: { text: { maxCharacters: 2000 } },
      }),
    })
    // Map to WebSearchResult[]
  }
}
```

### Jina Reader (page scraping)

**File: `src/renderer/packages/web-search/jina-reader.ts`**

Dead simple — just prefix any URL with `https://r.jina.ai/`:

```typescript
export async function scrapePage(url: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
    headers: { Accept: 'text/markdown' }
  })
  return response.text()  // Returns clean markdown
}
```

**Effort**: 1-2 days

---

## Feature 3: Citation UI Components

### CitationBadge (inline in markdown)

**File: `src/renderer/components/search/CitationBadge.tsx`**

Small `[1]` superscript badges inline with text. On hover: show source title + URL. On click: open in browser.

For Gemini grounding, `groundingSupports` maps exact text ranges to citation indices — we can inject `[1]` markers automatically.

For tool-based search, the model already outputs `[1]` markers when instructed.

### SourceCardList (horizontal scroll above/below message)

**File: `src/renderer/components/search/SourceCardList.tsx`**

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 🌐 Title │ │ 🌐 Title │ │ 🌐 Title │ │ 🌐 Title │
│ domain.c │ │ domain.c │ │ domain.c │ │ domain.c │
│ snippet..│ │ snippet..│ │ snippet..│ │ snippet..│
└──────────┘ └──────────┘ └──────────┘ └──────────┘
  ◄ ─ ─ ─ ─ horizontal scroll ─ ─ ─ ─ ►
```

Each card shows: favicon + title + domain + snippet preview. Clicking opens source.

### FollowUpSuggestions (below message)

**File: `src/renderer/components/search/FollowUpSuggestions.tsx`**

Pill-shaped buttons below search-enhanced messages:
```
💡 "How does X compare to Y?"  "What are the latest updates?"  "Explain in detail"
```

Generated by the model or extracted from "People also ask" data.

**Effort**: 2-3 days

---

## Feature 4: OpenClaw Integration (Tier 1 + Tier 2 prep)

### Tier 1: OpenAI-compatible provider

**File: `src/shared/providers/definitions/openclaw.ts`**

```typescript
export const openclawProvider = defineProvider({
  id: 'openclaw',
  name: 'OpenClaw',
  type: 'openai-compatible',
  defaultSettings: {
    apiHost: 'http://127.0.0.1:18789',
    apiPath: '/v1/chat/completions',
    models: ['pi-agent'],
  },
})
```

Uses existing OpenAI-compatible model infrastructure. Zero new code needed beyond the provider definition + settings UI.

### Tier 2 prep: Connection status indicator

**File: `src/renderer/stores/atoms/openclawAtoms.ts`**

```typescript
export const openclawStatusAtom = atom<'disconnected' | 'connecting' | 'connected'>('disconnected')
```

Show a small status dot in the sidebar or settings when OpenClaw is detected running locally (ping `http://127.0.0.1:18789/health`).

**Effort**: 1 day (Tier 1), Tier 2 deferred until SDK ships

---

## Feature 5: Search Pipeline Enhancement

### Query Classifier

**File: `src/renderer/packages/web-search-enhanced/query-classifier.ts`**

Before sending to the model, classify if the query needs search:
- Time-sensitive ("latest", "2026", "today")
- Factual lookup ("who is", "what is", "how many")
- Current events ("news about", specific recent topics)
- Technical docs ("how to", API references)

If classified as search-needed AND user has Gemini: use Grounding automatically.
If no Gemini: use built-in providers with Jina scraping.

### Citation Tracker

**File: `src/renderer/packages/web-search-enhanced/citation-tracker.ts`**

```typescript
class CitationTracker {
  private citations: Map<string, SearchCitation> = new Map()

  addFromSearchResults(results: WebSearchResult[]): void { ... }
  addFromGrounding(metadata: GroundingMetadata): void { ... }
  addFromOpenClaw(agentResults: any): void { ... }

  // Inject [1][2] markers into text based on source mapping
  annotateText(text: string, supports: GroundingSupport[]): string { ... }

  getCitations(): SearchCitation[] { ... }
}
```

Unified citation tracking regardless of source (built-in, Gemini, OpenClaw, MCP).

**Effort**: 1-2 days

---

## Implementation Priority

| Phase | Feature | Effort | Dependencies |
|-------|---------|--------|-------------|
| **Phase 1** | Gemini Grounding (native API) | 1-2 days | Gemini API key ✅ |
| **Phase 1** | Citation UI (SourceCardList + CitationBadge) | 2 days | Phase 1a |
| **Phase 2** | Exa search provider | 1 day | Exa API key |
| **Phase 2** | Jina Reader (page scraping) | 0.5 day | None (free) |
| **Phase 2** | OpenClaw Tier 1 (provider) | 1 day | OpenClaw running locally |
| **Phase 3** | Query classifier + citation tracker | 1-2 days | Phase 1+2 |
| **Phase 3** | FollowUp suggestions | 1 day | Phase 1 |
| **Future** | OpenClaw Tier 2 (WS gateway) | 1-2 weeks | SDK release |
| **Future** | MCP search servers (Firecrawl, Brave) | 1 day each | MCP infra ✅ |

### Total Phase 1+2: ~5-7 days
### Quick win: Gemini Grounding alone is 1-2 days for a massive UX upgrade

---

## Settings UI

**File: `src/renderer/routes/settings/web-search.tsx`** (extend existing)

Add:
- **Search provider dropdown**: Bing / DuckDuckGo / Google / Serper / Tavily / Exa (new)
- **Gemini Grounding toggle**: "Use Google Grounding when Gemini models are selected" (on by default)
- **Page scraping**: "Scrape top results for deeper context" + provider (Jina / Firecrawl MCP)
- **OpenClaw section**: Connection URL + status indicator + "Use for deep research" toggle

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Gemini grounding metadata format changes | Medium | Use AI SDK's abstraction layer, fallback to tool-based |
| Exa API rate limits | Low | Cache results, fallback to Tavily |
| Jina Reader blocks/rate limits | Low | Fallback to raw fetch + readability |
| OpenClaw not running | None | Graceful degradation to built-in search |
| Citation injection breaks markdown | Medium | Sanitize markers, render as separate component |

---

## Sources

- [Gemini Grounding with Google Search](https://ai.google.dev/gemini-api/docs/grounding)
- [Exa API Docs](https://docs.exa.ai)
- [Jina Reader API](https://jina.ai/reader)
- [OpenClaw Gateway Protocol](https://docs.openclaw.ai/gateway/protocol)
- Chaeboxi codebase analysis (web-search/, mcp/, providers/)
