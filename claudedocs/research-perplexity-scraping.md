# Research Report: Perplexity-like Web Search & Scraping for AI Chat Apps

**Date**: 2026-04-05
**Scope**: Jan AI architecture analysis, MCP scraping landscape, integration recommendations for Chaeboxi

---

## Table of Contents

1. [Jan AI's Web Search Architecture](#1-jan-ais-web-search-architecture)
2. [MCP Web Search & Scraping Landscape](#2-mcp-web-search--scraping-landscape)
3. [Perplexica: Open-Source Perplexity Reference Architecture](#3-perplexica-open-source-perplexity-reference-architecture)
4. [UI Patterns for Citations & Sources](#4-ui-patterns-for-citations--sources)
5. [MCP Scraping Tools Comparison Table](#5-mcp-scraping-tools-comparison-table)
6. [Recommended Integration Approach for Chaeboxi](#6-recommended-integration-approach-for-chaeboxi)
7. [Implementation Sketch](#7-implementation-sketch)

---

## 1. Jan AI's Web Search Architecture

### Overview

Jan AI (jan.ai) is an open-source ChatGPT/Claude alternative that has evolved from a basic local LLM client into a full AI platform with built-in web search. Their approach centers on **MCP (Model Context Protocol) as the universal connector** for search and browsing tools.

### Key Components

#### 1.1 Default Web Search (Exa Integration)

Jan ships with **Exa** as the default search provider, enabled out-of-the-box:
- Users can ask about current events immediately without configuration
- Exa provides free-tier access for Jan users
- Exa uses **semantic/neural search** rather than keyword matching, producing higher-quality results for AI consumption

> "Jan enables access to current web information by default. You can ask it to search about latest news. Thanks to Exa for enabling free tier access." — Jan QuickStart docs

#### 1.2 MCP-Based Tool Architecture

Jan implements web search through MCP servers, not hard-coded API integrations. The MCP approach means:

- **Pluggable providers**: Users can swap Exa for Serper, Crawl4AI, or any MCP-compatible search server
- **Tool-use pattern**: The LLM decides when to search via function calling / tool use
- **Standard protocol**: JSON-RPC 2.0 over stdio or HTTP transport

**Configuration flow** (from Jan's Settings):
```
Settings → Experimental Features (enable) → MCP Servers → Enable search MCP (Serper, Exa, etc.)
```

#### 1.3 Deep Research Pipeline

Jan's "Deep Research" mode (documented at `jan.ai/post/deepresearch`) replicates OpenAI's deep research methodology:

**Pipeline stages**:
1. **Planning** — Model creates a research plan with multiple search angles
2. **Searching** — Executes 5-10+ unique search queries across different angles (statistics, opinions, case studies, news, reports)
3. **Scraping** — Uses `scrape` tool for full article retrieval with document structure preservation
4. **Analysis** — Model synthesizes findings across sources
5. **Synthesis** — Produces comprehensive report with citations and recommendations

**MCP Tools used (Serper example)**:
| Tool | Purpose |
|------|---------|
| `google_search` | Performs web searches, extracts metadata (title, URL, snippet) |
| `scrape` | Extracts full article content while preserving document structure |

**Performance benchmarks** (from Jan's testing):

| Model | Time | Searches | Tokens |
|-------|------|----------|--------|
| Jan-Nano (4B local) | 3 min | 7 searches | 1,112 |
| GPT-4o | 1 min | 11 searches | 660 |
| o3 | 3 min | 24 searches | 1,728 |

#### 1.4 Jan v1 Model (Search-Optimized)

Jan released **Jan v1**, a 4B parameter model specifically optimized for web search:

- **91.1% SimpleQA accuracy** — outperforms Perplexity Pro
- Built on Qwen3-4B-thinking foundation for enhanced reasoning + tool utilization
- Designed for "agentic reasoning and problem-solving within the Jan App"
- Uses embedded chat template with tool-use rules
- System prompt instructs step-by-step tool usage, only calling search when necessary

**Research prompt template features**:
- Visit all cited URLs and verify entities mentioned
- Achieve comprehensive coverage before concluding
- Produce self-contained markdown reports with proper citations
- Track investigation progress, avoid redundant tool calls

#### 1.5 Browser MCP (v0.7.3+)

Jan v0.7.3 introduced **Jan Browser MCP server** for AI-powered browser automation:
- Search the web, navigate pages, take screenshots, extract content
- Works through natural conversation with OpenAI-compatible models
- **Proactive Mode**: Automatically captures visual snapshots and page content during browser usage
- Seamlessly integrated with the chat interface

#### 1.6 Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                    Jan App (Electron)                │
│                                                     │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │  Chat UI  │  │  MCP Client   │  │  Model Engine│ │
│  │(React/Next)│ │  Controller   │  │(Local/Cloud) │ │
│  └─────┬─────┘  └───────┬───────┘  └──────┬───────┘ │
│        │                │                  │         │
│        │    ┌───────────┴───────────┐     │         │
│        │    │   MCP Server Manager  │     │         │
│        │    └───────────┬───────────┘     │         │
│        │                │                  │         │
└────────┼────────────────┼──────────────────┼─────────┘
         │                │                  │
    ┌────┴────┐   ┌───────┴───────┐   ┌─────┴─────┐
    │  UI     │   │  MCP Servers  │   │  LLM API  │
    │Rendering│   │  (stdio/HTTP) │   │ (Ollama/  │
    │         │   │               │   │  Cloud)   │
    └─────────┘   │ ┌───────────┐ │   └───────────┘
                  │ │   Exa     │ │
                  │ │  Serper   │ │
                  │ │ Crawl4AI  │ │
                  │ │  Browser  │ │
                  │ └───────────┘ │
                  └───────────────┘
```

### Code References (GitHub: janhq/jan)

- MCP server configuration: `Settings → MCP Servers` in the app UI
- Search tool integration: Through MCP tool-use protocol (model decides when to call `google_search`, `scrape`, etc.)
- Deep Research: Custom assistant + MCP search tools combo
- Jan v1 system prompts: Published at `jan.ai/post/jan-v1-for-research`

---

## 2. MCP Web Search & Scraping Landscape

### 2.1 Firecrawl MCP Server

**GitHub**: `github.com/firecrawl/firecrawl-mcp-server`
**Category**: Full-stack web data extraction

**8 Tools exposed**:

| Tool | Purpose |
|------|---------|
| `firecrawl_scrape` | Extract content from single URLs (JSON/markdown/branding) |
| `firecrawl_batch_scrape` | Process multiple URLs in parallel |
| `firecrawl_map` | Discover all URLs on a website |
| `firecrawl_crawl` | Multi-page extraction with configurable depth |
| `firecrawl_search` | Web search for information discovery |
| `firecrawl_extract` | Structured JSON extraction via LLM analysis |
| `firecrawl_agent` | Autonomous multi-source research with AI reasoning |
| `firecrawl_interact` | Browser automation (click, type, navigate) |

**Key strengths**:
- Handles JavaScript-rendered content
- Bypasses anti-bot protections
- Structured data extraction via JSON schemas
- Fastest response time (7.92s avg) among tested providers
- Self-hosted option available
- Supports stdio and HTTP Streamable transports

**Weaknesses**:
- Lowest success rate in independent testing (33.69%)
- Requires API key ($19/mo for 3,000 credits)
- Email-only support

**Best for**: Deep scraping, structured extraction, research agents

### 2.2 Tavily MCP Server

**GitHub**: `tavily.com` (official Docker Hub MCP)
**Category**: AI-optimized search API

**4 Tools exposed**:

| Tool | Purpose |
|------|---------|
| `search` | Basic search with customizable depth |
| `searchContext` | Context-aware search for improved relevance |
| `searchQNA` | Question-and-answer focused search |
| `extract` | Content extraction from known URLs |

**Key features**:
- Search depth options (basic/advanced)
- Topic categories: general, news, finance
- Time range filtering (day, week, month)
- Domain include/exclude filtering
- Raw content inclusion option
- Built specifically for AI agent consumption

**Best for**: Quick, relevant search results optimized for LLM context. Widely used in LangChain/LangGraph workflows.

### 2.3 Brave Search MCP Server

**GitHub**: `github.com/brave/brave-search-mcp-server`
**Category**: Privacy-focused comprehensive search

**6 Tools exposed**:

| Tool | Purpose |
|------|---------|
| `brave_web_search` | Comprehensive web search with rich filtering |
| `brave_local_search` | Business/place search with ratings, hours, AI descriptions |
| `brave_video_search` | Video content with metadata and thumbnails |
| `brave_image_search` | Image retrieval with URLs |
| `brave_news_search` | Current articles with freshness controls |
| `brave_summarizer` | AI-powered summaries from search results |

**Key features**:
- Privacy-focused (no user tracking)
- Multiple search types (web, local, video, image, news)
- SafeSearch controls
- Language/country filtering
- Pagination support
- Tool whitelisting/blacklisting
- Free tier available (2,000 queries/month)

**Best for**: Privacy-conscious search with broad coverage across content types

### 2.4 Exa MCP Server

**GitHub**: `github.com/exa-labs/exa-mcp-server`
**Category**: Semantic/neural AI-native search

**4 Tools exposed**:

| Tool | Purpose |
|------|---------|
| `web_search_exa` | Semantic web search with clean content |
| `web_search_advanced_exa` | Advanced search with comprehensive filtering (disabled by default) |
| `get_code_context_exa` | Code examples from GitHub, Stack Overflow, docs |
| `crawling_exa` | Full content extraction from known URLs |

**Key features**:
- **Semantic search** — understands meaning, not just keywords
- Specialized filters for companies, news, people, research papers
- Fast and deep search modes with neural options
- Clean, structured results with URLs, dates, summaries
- Domain inclusion/exclusion
- Remote HTTP transport (`https://mcp.exa.ai/mcp`)

**Best for**: High-quality semantic search results, especially for research and knowledge-intensive queries. Jan AI's default search provider.

### 2.5 Jina AI MCP Server

**GitHub**: `github.com/jina-ai/MCP`
**Category**: Comprehensive web intelligence

**19 Tools exposed** (most comprehensive):

**Reader & Content**:
- `read_url` — Clean markdown extraction from web pages
- `parallel_read_url` — Concurrent multi-page reading
- `capture_screenshot_url` — Page screenshots
- `extract_pdf` — PDF figure/table/equation extraction

**Search**:
- `search_web` — General web search
- `search_arxiv` — Academic paper search
- `search_ssrn` — Social science research
- `search_images` — Image search
- `search_bibtex` — Academic papers with BibTeX

**Intelligence**:
- `expand_query` — Query rewriting/expansion
- `sort_by_relevance` — Document reranking via Reranker API
- `classify_text` — Text classification
- `deduplicate_strings` / `deduplicate_images` — Semantic deduplication
- `guess_datetime_url` — Publication date detection

**Key features**:
- Uses ReaderLM-v2 for high-quality HTML→Markdown conversion
- Fact-checking/grounding capabilities
- Server-side tool filtering to optimize token usage
- Academic search capabilities (arXiv, SSRN)
- Free tier available

**Best for**: Research-heavy workflows needing reader + search + reranking + academic sources

### 2.6 Crawl4AI MCP Server

**GitHub**: `github.com/MaitreyaM/WEB-SCRAPING-MCP`
**Category**: Open-source intelligent scraping

**3 Tools exposed**:

| Tool | Purpose |
|------|---------|
| `scrape_url` | Full page content in Markdown format |
| `extract_text_by_query` | Search within pages for specific text (up to 5 snippets) |
| `smart_extract` | LLM-powered (Gemini) structured extraction via natural language |

**Key features**:
- Open-source (Python-based)
- JavaScript rendering support
- LLM-powered intelligent extraction
- Docker containerization
- SSE communication on port 8002
- No API key needed for basic scraping

**Best for**: Self-hosted scraping without paid API dependencies. Used by Jan AI in deep research workflows.

### 2.7 MCP Omnisearch

**GitHub**: `github.com/spences10/mcp-omnisearch`
**Category**: Multi-provider search aggregator

**4 Tools exposed**:

| Tool | Purpose |
|------|---------|
| `web_search` | Query multiple providers with domain filtering |
| `ai_search` | AI-powered answers with citations (Kagi FastGPT, Exa, Linkup) |
| `github_search` | Code, repo, and user search |
| `web_extract` | URL content extraction/summarization |

**Supported providers**: Tavily, Brave, Kagi, Exa AI, GitHub, Linkup, Firecrawl

**Best for**: Unified search interface across multiple providers without managing separate MCP servers

### 2.8 Serper MCP

**Category**: Google Search Results API via MCP

**2 Tools exposed**:
| Tool | Purpose |
|------|---------|
| `google_search` | Google SERP results with metadata |
| `scrape` | Full page content extraction |

**Best for**: Google-quality search results. Jan AI's primary documented search tool for deep research.

---

## 3. Perplexica: Open-Source Perplexity Reference Architecture

[Perplexica](https://github.com/ItzCrazyKns/Perplexica) is the most mature open-source Perplexity clone. Understanding its architecture is critical for building similar features.

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Perplexica Architecture                   │
│                                                             │
│  ┌──────────────────┐                                       │
│  │   Next.js UI      │  Chat, Search, Discovery, Library    │
│  │  (App Router)     │  pages with source attribution       │
│  └────────┬─────────┘                                       │
│           │                                                 │
│  ┌────────┴─────────┐                                       │
│  │   API Routes      │  /chat (streaming), /search,         │
│  │                   │  /providers, /images, /videos         │
│  └────────┬─────────┘                                       │
│           │                                                 │
│  ┌────────┴─────────────────────────────────────────┐       │
│  │          Agent Orchestration Layer                │       │
│  │                                                  │       │
│  │  1. Classifier → Determines if research needed   │       │
│  │     - Query reformulation                        │       │
│  │     - Widget selection                           │       │
│  │                                                  │       │
│  │  2. Parallel Execution                           │       │
│  │     ┌──────────┐  ┌──────────┐                   │       │
│  │     │Researcher│  │ Widgets  │  (run in parallel) │       │
│  │     │ Actions  │  │(weather, │                    │       │
│  │     │          │  │calc,etc) │                    │       │
│  │     └────┬─────┘  └────┬─────┘                   │       │
│  │          │             │                          │       │
│  │  3. Answer Synthesis                              │       │
│  │     - Search results as context                   │       │
│  │     - Widget outputs                              │       │
│  │     - Streams response with citations             │       │
│  └──────────────────────────────────────────────────┘       │
│           │                                                 │
│  ┌────────┴─────────┐  ┌───────────┐  ┌──────────────┐     │
│  │    SearXNG        │  │  LLM      │  │  SQLite DB   │     │
│  │  (Meta-search)    │  │(Local/API)│  │  (History)   │     │
│  └──────────────────┘  └───────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Search Pipeline (3 Stages)

**Stage 1: Classification** (`classifier.ts`)
- Evaluates whether research/search is necessary for the query
- Determines which widgets are relevant (weather, calculator, etc.)
- Reformulates user query into standalone search-optimized form

**Stage 2: Parallel Research + Widgets**
- **Research actions** (in `src/lib/agents/search/researcher/actions/`):
  1. Web search via SearXNG (privacy-focused meta-search)
  2. Academic papers and scholarly content
  3. Social platform discussions
  4. Semantic search across user uploads
  5. Direct URL content extraction
- **Widgets** run simultaneously for structured data (weather, etc.)
- All tools centrally registered for coordinated execution

**Stage 3: Answer Synthesis**
- Combines search results + widget outputs as LLM context
- Streams response to user with inline citations
- Widget results displayed in UI but **not cited as sources** (distinction from search results)

### 3.3 Citation Implementation

Perplexica's citation approach:
- LLM annotates synthesized responses with **footnote references** linking to source URLs
- Larger models (Phi-4+) produce paragraph summaries with footnote annotations
- UI renders both content text and source attribution in separate visual areas
- Sources displayed as clickable cards alongside the response
- The system separates **citable content** (search results) from **non-citable content** (widget data)

### 3.4 Key Takeaways for Chaeboxi

1. **Classifier-first**: Don't search on every query — classify first
2. **Parallel execution**: Research + widgets run simultaneously
3. **Citation separation**: Track which content is citable vs display-only
4. **Meta-search**: SearXNG aggregates multiple search engines for better coverage
5. **Query reformulation**: Transform conversational queries into search-optimized form

---

## 4. UI Patterns for Citations & Sources

### 4.1 Perplexity's Citation UX (Industry Standard)

Based on analysis of Perplexity and similar products:

**Inline Citations**:
- Numbered superscript references `[1][2][3]` within the response text
- Clicking a citation highlights/scrolls to the corresponding source card
- Citations appear immediately as the text streams

**Source Cards** (displayed above or beside the response):
- Favicon + domain name
- Page title (truncated)
- Brief snippet/description
- Link to original source
- Displayed in a horizontal scrollable row or grid

**Follow-up Suggestions**:
- 3-4 related questions displayed after the response
- Generated based on the search results and conversation context
- Clicking a suggestion triggers a new search cycle

**Search Progress Indicator**:
- "Searching..." with animated dots
- Shows which sources are being consulted
- Sources appear progressively as they're found

### 4.2 Chaeboxi's Current Search UI

Chaeboxi already has a `SearchResultCard` component and `WebSearchToolCallUI` in `ToolCallPartUI.tsx`:

**Current implementation**:
- Search results shown in a collapsible tool call section
- `SearchResultCard`: Shows numbered title + link in a compact card (200px max width)
- Results displayed in a `SimpleGrid` (3-4 columns) when expanded
- Horizontal scrollable row when collapsed
- No inline citations in response text
- No follow-up suggestions

### 4.3 Recommended UI Enhancements

#### A. Inline Citation References

```tsx
// Within the Markdown renderer, detect citation patterns like [1], [2]
// and render them as clickable superscript badges

<sup className="citation-ref" onClick={() => scrollToSource(index)}>
  <Badge size="xs" variant="filled" color="blue">{index}</Badge>
</sup>
```

#### B. Enhanced Source Cards

```tsx
// Richer source card with favicon, domain, and snippet
<Paper radius="md" p="sm" className="source-card">
  <Group gap="xs">
    <Avatar src={`https://www.google.com/s2/favicons?domain=${domain}`} size="xs" />
    <Text size="xs" c="dimmed">{domain}</Text>
  </Group>
  <Text size="sm" fw={500} lineClamp={2}>{title}</Text>
  <Text size="xs" c="dimmed" lineClamp={2}>{snippet}</Text>
</Paper>
```

#### C. Search Progress Stream

```tsx
// Show sources being consulted in real-time
<Group gap="xs" className="search-progress">
  <Loader size="xs" />
  <Text size="xs">Searching {sources.length} sources...</Text>
  {sources.map(s => (
    <Badge key={s.domain} size="xs" variant="outline">
      <Avatar src={favicon} size={12} /> {s.domain}
    </Badge>
  ))}
</Group>
```

#### D. Follow-up Suggestions

```tsx
// Generated by LLM based on search results
<Group mt="md" gap="xs">
  {suggestions.map(q => (
    <Button
      key={q}
      variant="light"
      size="xs"
      leftSection={<IconSearch size={14} />}
      onClick={() => handleFollowUp(q)}
    >
      {q}
    </Button>
  ))}
</Group>
```

---

## 5. MCP Scraping Tools Comparison Table

| Feature | Firecrawl | Tavily | Brave Search | Exa | Jina AI | Crawl4AI | Serper | Omnisearch |
|---------|-----------|--------|-------------|-----|---------|----------|--------|------------|
| **Tool Count** | 8 | 4 | 6 | 4 | 19 | 3 | 2 | 4 |
| **Search** | ✅ | ✅ | ✅ | ✅ (semantic) | ✅ | ❌ | ✅ (Google) | ✅ (multi) |
| **Page Scraping** | ✅ | ✅ (extract) | ❌ | ✅ (crawl) | ✅ (reader) | ✅ | ✅ | ✅ |
| **Structured Extract** | ✅ (JSON schema) | ❌ | ❌ | ❌ | ❌ | ✅ (LLM) | ❌ | ❌ |
| **JS Rendering** | ✅ | N/A | N/A | N/A | ✅ | ✅ | ❌ | Varies |
| **Academic Search** | ❌ | ❌ | ❌ | ❌ | ✅ (arXiv, SSRN) | ❌ | ❌ | ❌ |
| **Reranking** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Image Search** | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **News Search** | ❌ | ✅ (topic filter) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Local/Business** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Self-hostable** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Free Tier** | 500 credits | 1,000 API calls/mo | 2,000 queries/mo | Limited | ✅ | ✅ (OSS) | 2,500 queries | Depends |
| **Pricing** | $19/mo | $0-$100+/mo | Free-$9/mo | $0-$100+/mo | Free-paid | Free (OSS) | $50/mo | Free (OSS) |
| **Transport** | stdio + HTTP | stdio | stdio + HTTP | HTTP remote | HTTP remote | SSE | stdio | stdio + Docker |
| **Response Speed** | ~8s avg | Fast | Medium | Fast | Medium | Varies | Fast | Varies |
| **Success Rate** | 33.69%* | High | High | High | High | Varies | High | Varies |
| **Best For** | Deep scraping | AI-optimized search | Privacy + variety | Semantic search | Research + reader | Self-hosted scrape | Google results | Multi-provider |

*Firecrawl's low success rate is from Proxyway's anti-bot testing benchmark; actual performance for AI scraping of normal pages is much higher.

---

## 6. Recommended Integration Approach for Chaeboxi

### 6.1 Strategy: Layered Search Architecture

Chaeboxi already has a solid foundation with its `WebSearch` abstract class, multiple search providers (Bing, DuckDuckGo, Serper, Google, Tavily), and MCP client infrastructure. The recommended approach is a **three-layer enhancement**:

```
Layer 1: Search (existing) → Enhanced with page scraping
Layer 2: Synthesis → New context assembly with citations
Layer 3: UI → Inline citations, source cards, follow-ups
```

### 6.2 Recommended Tools

**Primary Search** (choose one as default, allow user selection):

| Priority | Tool | Rationale |
|----------|------|-----------|
| 1st | **Tavily** | Already integrated in Chaeboxi. Best AI-optimized results. Add `searchContext` and raw content extraction. |
| 2nd | **Exa** | Add as new provider. Semantic search produces highest-quality results for knowledge queries. Free tier. Jan AI's default. |
| 3rd | **Serper** | Already integrated. Google-quality results. |

**Page Scraping** (for follow-up deep reads):

| Priority | Tool | Rationale |
|----------|------|-----------|
| 1st | **Jina Reader** | Simple `https://r.jina.ai/{url}` API. Clean markdown output. No MCP needed — just HTTP. Free tier. |
| 2nd | **Firecrawl MCP** | Via existing MCP infrastructure. Best for structured extraction. |
| 3rd | **Crawl4AI** | Self-hosted fallback, no API key needed. |

**MCP Enhancement** (optional power-user features):
- Expose Firecrawl, Jina, or Brave Search as MCP servers users can configure
- Chaeboxi's `mcpController` already handles stdio + HTTP MCP transports perfectly

### 6.3 Architecture Decision

**Option A: Enhanced Built-in Search (Recommended)**
- Extend existing `WebSearch` base class with a `scrape(url)` method
- Add Exa as a new search provider alongside existing ones
- Add Jina Reader for page scraping (simple HTTP, no MCP needed)
- Build citation tracking into the context assembly pipeline
- Minimal new dependencies, leverages existing infrastructure

**Option B: MCP-Only Approach**
- Add Firecrawl/Tavily/Brave as built-in MCP servers (like Jan does)
- Search happens through MCP tool calls from the LLM
- More flexible but adds complexity and latency
- User must configure MCP servers

**Option C: Hybrid (Best of Both)**
- Built-in search providers (Layer 1) for fast, zero-config search
- MCP servers (Layer 2) for power users wanting deep research
- Shared citation/synthesis UI (Layer 3) regardless of search source
- This is essentially what Jan AI does

**Recommendation: Option C (Hybrid)** — Start with Option A enhancements, then add MCP search servers as opt-in power features.

---

## 7. Implementation Sketch

### 7.1 New/Modified Files

```
src/
├── shared/
│   └── types/
│       └── session.ts                    # Extend SearchResultItem with citation fields
│
├── renderer/
│   ├── packages/
│   │   ├── web-search/
│   │   │   ├── base.ts                   # Add abstract scrape() method
│   │   │   ├── exa.ts                    # NEW: Exa search provider
│   │   │   ├── index.ts                  # Add Exa, add scrape support
│   │   │   └── jina-reader.ts            # NEW: Jina Reader for page scraping
│   │   │
│   │   ├── web-search-enhanced/          # NEW: Perplexity-like pipeline
│   │   │   ├── index.ts                  # Pipeline orchestrator
│   │   │   ├── query-classifier.ts       # Determine if search needed
│   │   │   ├── query-reformulator.ts     # Optimize query for search
│   │   │   ├── result-ranker.ts          # Rerank/deduplicate results
│   │   │   ├── page-scraper.ts           # Scrape top-N results for full content
│   │   │   ├── citation-tracker.ts       # Track source→citation mapping
│   │   │   └── followup-generator.ts     # Generate follow-up suggestions
│   │   │
│   │   └── model-context/                # MODIFY: Inject search context with citations
│   │       └── ...
│   │
│   ├── components/
│   │   ├── message-parts/
│   │   │   └── ToolCallPartUI.tsx        # MODIFY: Enhanced SearchResultCard
│   │   │
│   │   ├── search/                       # NEW: Search-specific UI components
│   │   │   ├── CitationBadge.tsx         # Inline [1][2] citation badge
│   │   │   ├── SourceCard.tsx            # Enhanced source card with favicon
│   │   │   ├── SourceCardList.tsx        # Horizontal scrollable source list
│   │   │   ├── SearchProgress.tsx        # Real-time search progress indicator
│   │   │   └── FollowUpSuggestions.tsx   # Suggested follow-up questions
│   │   │
│   │   └── Markdown.tsx                  # MODIFY: Add citation reference rendering
│   │
│   └── routes/
│       └── settings/
│           └── web-search.tsx            # MODIFY: Add Exa provider config
```

### 7.2 Key Implementation Details

#### A. Extended SearchResultItem Type

```typescript
// src/shared/types/session.ts
export const SearchResultItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  snippet: z.string(),
  rawContent: z.string().nullable().optional(),
  // NEW fields for citation support
  citationIndex: z.number().optional(),       // [1], [2], etc.
  favicon: z.string().nullable().optional(),  // Favicon URL
  domain: z.string().optional(),              // Extracted domain
  publishedDate: z.string().nullable().optional(),
  relevanceScore: z.number().optional(),      // For ranking
})
```

#### B. Exa Search Provider

```typescript
// src/renderer/packages/web-search/exa.ts
import WebSearch from './base'
import type { SearchResult } from '@shared/types'

export class ExaSearch extends WebSearch {
  private readonly EXA_SEARCH_URL = 'https://api.exa.ai/search'

  constructor(private apiKey: string) {
    super()
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResult> {
    const response = await this.fetch(this.EXA_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: {
        query,
        type: 'auto',           // neural or keyword, auto-detected
        numResults: 10,
        contents: {
          text: { maxCharacters: 1000 },
          highlights: true,
        },
      },
      signal,
    })

    return {
      items: response.results.map((r: any) => ({
        title: r.title,
        link: r.url,
        snippet: r.text || r.highlights?.[0] || '',
        publishedDate: r.publishedDate,
        domain: new URL(r.url).hostname,
      })),
    }
  }
}
```

#### C. Jina Reader (Page Scraping)

```typescript
// src/renderer/packages/web-search/jina-reader.ts
import { ofetch } from 'ofetch'

export async function scrapePageContent(
  url: string,
  signal?: AbortSignal
): Promise<{ content: string; title: string }> {
  // Jina Reader: prepend r.jina.ai/ to any URL for clean markdown
  const readerUrl = `https://r.jina.ai/${url}`

  const markdown = await ofetch(readerUrl, {
    headers: {
      Accept: 'text/markdown',
      'X-Return-Format': 'markdown',
    },
    signal,
    responseType: 'text',
  })

  // Extract title from first heading
  const titleMatch = markdown.match(/^#\s+(.+)$/m)
  return {
    content: markdown.slice(0, 5000), // Limit to ~5000 chars for context
    title: titleMatch?.[1] || '',
  }
}
```

#### D. Search Pipeline Orchestrator

```typescript
// src/renderer/packages/web-search-enhanced/index.ts
import { webSearchExecutor } from '../web-search'
import { scrapePageContent } from '../web-search/jina-reader'

export interface EnhancedSearchResult {
  query: string
  sources: Array<{
    citationIndex: number
    title: string
    link: string
    domain: string
    favicon: string
    snippet: string
    fullContent?: string
  }>
  followUpQuestions?: string[]
}

export async function enhancedSearch(
  query: string,
  options: {
    scrapeTopN?: number    // How many top results to scrape for full content
    signal?: AbortSignal
  } = {}
): Promise<EnhancedSearchResult> {
  const { scrapeTopN = 3, signal } = options

  // Step 1: Search
  const { searchResults } = await webSearchExecutor({ query }, { abortSignal: signal })

  // Step 2: Enrich with metadata
  const sources = searchResults.map((r, i) => {
    const domain = new URL(r.link).hostname.replace('www.', '')
    return {
      citationIndex: i + 1,
      title: r.title,
      link: r.link,
      domain,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
      snippet: r.snippet,
      fullContent: undefined as string | undefined,
    }
  })

  // Step 3: Scrape top-N results for full content (parallel)
  const scrapePromises = sources.slice(0, scrapeTopN).map(async (source) => {
    try {
      const { content } = await scrapePageContent(source.link, signal)
      source.fullContent = content
    } catch (err) {
      console.warn(`Failed to scrape ${source.link}:`, err)
    }
  })
  await Promise.allSettled(scrapePromises)

  return { query, sources }
}
```

#### E. Citation-Aware Context Assembly

When building the LLM context with search results, format sources with citation indices:

```typescript
// Added to model-context assembly
function buildSearchContext(sources: EnhancedSearchResult['sources']): string {
  return sources.map((s) => {
    const content = s.fullContent || s.snippet
    return `[${s.citationIndex}] ${s.title} (${s.domain})\n${content}\nSource: ${s.link}\n`
  }).join('\n---\n')
}

// System prompt addition for citation behavior:
const CITATION_INSTRUCTION = `
When answering, cite your sources using [N] notation where N corresponds to the source number.
Place citations inline immediately after the relevant claim. Example: "The population grew by 15% [1] while GDP declined [3]."
After your answer, suggest 2-3 follow-up questions the user might want to explore.
`
```

#### F. Inline Citation Rendering in Markdown

```tsx
// Modification to src/renderer/components/Markdown.tsx
// Add a custom remark/rehype plugin or post-process rendered HTML

// Detect patterns like [1], [2] in rendered markdown
// Replace with clickable CitationBadge components
const CitationBadge: FC<{ index: number; sources: SearchSource[] }> = ({ index, sources }) => {
  const source = sources[index - 1]
  if (!source) return <sup>[{index}]</sup>

  return (
    <Tooltip label={`${source.title} — ${source.domain}`}>
      <Badge
        component="a"
        href={source.link}
        target="_blank"
        size="xs"
        variant="light"
        className="cursor-pointer inline-flex align-super"
      >
        {index}
      </Badge>
    </Tooltip>
  )
}
```

### 7.3 Data Flow Summary

```
User Query
    │
    ▼
┌─────────────────────┐
│ Query Classifier     │  → Does this need web search?
│ (optional, LLM-based)│     - Factual questions → YES
│                      │     - Creative/code → NO
└──────────┬──────────┘
           │ YES
           ▼
┌─────────────────────┐
│ Search Providers     │  → Tavily / Exa / Serper / Bing / DDG
│ (existing infra)     │     Returns: title, link, snippet
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Page Scraper         │  → Jina Reader for top-3 results
│ (new, parallel)      │     Returns: full page markdown
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Context Assembly     │  → Format sources with [1][2] indices
│ (modified)           │     + citation instruction in system prompt
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ LLM Inference        │  → Generates response with inline [N] refs
│ (existing)           │     + follow-up suggestions
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ UI Rendering         │  → Source cards (top)
│ (enhanced)           │     Streaming response with citation badges
│                      │     Follow-up suggestion buttons (bottom)
└─────────────────────┘
```

### 7.4 MCP Power-User Extension

For users who want deeper research capabilities, provide pre-configured MCP server templates:

```typescript
// src/renderer/packages/mcp/builtin.ts — add search-focused presets
export const BUILTIN_MCP_PRESETS = {
  firecrawl: {
    name: 'Firecrawl',
    description: 'Deep web scraping, crawling, and structured extraction',
    transport: {
      type: 'stdio' as const,
      command: 'npx',
      args: ['-y', 'firecrawl-mcp'],
      env: { FIRECRAWL_API_KEY: '' }, // User provides
    },
  },
  'brave-search': {
    name: 'Brave Search',
    description: 'Privacy-focused web, news, image, and local search',
    transport: {
      type: 'stdio' as const,
      command: 'npx',
      args: ['-y', '@anthropic/brave-search-mcp-server'],
      env: { BRAVE_API_KEY: '' },
    },
  },
  'jina-ai': {
    name: 'Jina AI',
    description: 'Web reader, search, academic search, and reranking',
    transport: {
      type: 'http' as const,
      url: 'https://mcp.jina.ai/',
      headers: { Authorization: 'Bearer <key>' },
    },
  },
  exa: {
    name: 'Exa',
    description: 'Semantic AI-native web search',
    transport: {
      type: 'http' as const,
      url: 'https://mcp.exa.ai/mcp',
      headers: { 'x-api-key': '' },
    },
  },
}
```

### 7.5 Implementation Priority

| Phase | Feature | Effort | Impact |
|-------|---------|--------|--------|
| **Phase 1** | Add Exa search provider | Low | High — semantic search quality |
| **Phase 1** | Add Jina Reader page scraping | Low | High — full page content for better answers |
| **Phase 1** | Enhanced `SearchResultCard` with favicon/domain | Low | Medium — better visual experience |
| **Phase 2** | Citation-aware context assembly (`[N]` references) | Medium | High — Perplexity-like inline citations |
| **Phase 2** | `CitationBadge` rendering in Markdown | Medium | High — clickable source references |
| **Phase 2** | `SourceCardList` horizontal display above response | Low | Medium — visual source attribution |
| **Phase 3** | Follow-up question suggestions | Medium | Medium — engagement + discovery |
| **Phase 3** | Search progress streaming UI | Low | Medium — perceived performance |
| **Phase 3** | Query classifier (search vs no-search) | Medium | Medium — efficiency |
| **Phase 4** | MCP search server presets (Firecrawl, Brave, etc.) | Low | Medium — power user features |
| **Phase 4** | Deep Research mode (multi-iteration search) | High | High — competitive differentiator |

---

## Sources

- [Jan AI Deep Research](https://jan.ai/post/deepresearch)
- [Jan v1 for Research](https://jan.ai/post/jan-v1-for-research)
- [Jan AI QuickStart - Web Search](https://www.jan.ai/docs/desktop/quickstart)
- [Jan Browser MCP (v0.7.3)](https://jan.ai/changelog/2025-11-13-jan-browser-mcp)
- [Jan GitHub Issue #4694 - Perplexity/Exa API](https://github.com/janhq/jan/issues/4694)
- [Jan v1 Reddit Announcement](https://www.reddit.com/r/LocalLLaMA/comments/1mo2gg7/)
- [Firecrawl MCP Server](https://github.com/firecrawl/firecrawl-mcp-server)
- [Brave Search MCP Server](https://github.com/brave/brave-search-mcp-server)
- [Exa MCP Server](https://github.com/exa-labs/exa-mcp-server)
- [Jina AI MCP Server](https://github.com/jina-ai/MCP)
- [Tavily MCP Market](https://mcpmarket.com/server/tavily)
- [Crawl4AI MCP Server](https://github.com/MaitreyaM/WEB-SCRAPING-MCP)
- [MCP Omnisearch](https://mcpservers.org/servers/spences10/mcp-omnisearch)
- [Perplexica Architecture](https://mintlify.com/ItzCrazyKns/Perplexica/advanced/architecture)
- [Perplexica vs SearXNG](https://zenvanriel.com/ai-engineer-blog/perplexica-vs-searxng-self-hosted-search/)
- [Proxyway MCP Scraping Benchmark](https://proxyway.com/best/mcp-servers-for-web-scraping)
- [Firecrawl Best MCP Servers 2026](https://www.firecrawl.dev/blog/best-mcp-servers-for-developers)
- [Jan-v1 Tutorial (Codecademy)](https://www.codecademy.com/article/jan-v1)
