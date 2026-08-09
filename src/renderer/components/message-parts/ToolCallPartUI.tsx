/**
 * Tool call chrome — quiet timeline steps, human-readable summaries first.
 * Raw JSON only under optional technical details (power users).
 */

import { Code, Collapse, Stack, Text, UnstyledButton } from '@mantine/core'
import { type MessageToolCallPart, MessageToolCallPartSchema } from '@shared/types'
import {
  IconChevronRight,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconCode,
  IconExternalLink,
  IconLink,
  IconLoader,
  IconMovie,
  IconSearch,
  IconTool,
  IconWorldWww,
} from '@tabler/icons-react'
import clsx from 'clsx'
import { type FC, type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import z from 'zod'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { getToolName } from '@/packages/tools'
import { isTaskTrackingTool } from '@/packages/tools/task-tools'
import { formatDurationForDisplay } from '@/packages/video'
import type { SearchResultItem } from '@/packages/web-search'
import { ScalableIcon } from '../common/ScalableIcon'
import { ImageInStorage } from '../Image'

export { ReasoningContentUI } from './ReasoningContentUI'

// ── Helpers ──────────────────────────────────────────────────────────────

const getSafeExternalHref = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null
  try {
    return new URL(trimmed).toString()
  } catch {
    try {
      return new URL(trimmed.replace(/%(?![0-9A-Fa-f]{2})/g, '%25')).toString()
    } catch {
      return null
    }
  }
}

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const previewText = (value: unknown, max = 140): string => {
  if (value == null) return ''
  if (typeof value === 'string') {
    const one = value.replace(/\s+/g, ' ').trim()
    return one.length > max ? `${one.slice(0, max)}…` : one
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const s = JSON.stringify(value)
    return s.length > max ? `${s.slice(0, max)}…` : s
  } catch {
    return ''
  }
}

const toolIconFor = (toolName: string) => {
  switch (toolName) {
    case 'web_search':
      return IconWorldWww
    case 'parse_link':
      return IconLink
    case 'read_video':
      return IconMovie
    case 'file_search':
    case 'code_search':
    case 'query_knowledge_base':
      return IconSearch
    case 'memory_lookup':
    case 'memory_recall':
    case 'memory_list':
    case 'memory_retain':
    case 'memory_reflect':
    case 'memory_update':
    case 'memory_forget':
      return IconSearch
    default:
      return IconTool
  }
}

// ── Header ───────────────────────────────────────────────────────────────

const ToolCallHeader: FC<{
  toolName: string
  state: MessageToolCallPart['state']
  summary?: string
  expanded: boolean
  onClick: () => void
  trailing?: ReactNode
}> = ({ toolName, state, summary, expanded, onClick, trailing }) => {
  const isSmallScreen = useIsSmallScreen()
  const Icon = toolIconFor(toolName)

  return (
    <button
      type="button"
      className={clsx('tool-step-header', expanded && 'is-open', isSmallScreen && 'is-mobile')}
      onClick={onClick}
      aria-expanded={expanded}
    >
      <span className="tool-step-icon" aria-hidden>
        <ScalableIcon icon={Icon} size={15} />
      </span>
      <span className="tool-step-main min-w-0 flex-1">
        <span className="tool-step-title">{getToolName(toolName)}</span>
        {summary && !expanded && <span className="tool-step-summary">{summary}</span>}
      </span>
      <span className="tool-step-meta shrink-0">
        {state === 'call' ? (
          <ScalableIcon icon={IconLoader} size={14} className="animate-spin" color="var(--chatbox-tint-brand)" />
        ) : state === 'error' ? (
          <ScalableIcon icon={IconCircleXFilled} size={14} color="var(--chatbox-tint-error)" />
        ) : (
          <ScalableIcon
            icon={IconCircleCheckFilled}
            size={14}
            className="opacity-85"
            color="var(--chatbox-tint-success)"
          />
        )}
        {trailing}
        <ScalableIcon icon={IconChevronRight} size={14} className={clsx('tool-step-chevron', expanded && 'is-open')} />
      </span>
    </button>
  )
}

// ── Shared body chrome ───────────────────────────────────────────────────

const ToolStepBody: FC<{ children: ReactNode }> = ({ children }) => <div className="tool-step-body">{children}</div>

const FieldLabel: FC<{ children: ReactNode }> = ({ children }) => (
  <Text size="xs" fw={600} c="chatbox-tertiary" tt="uppercase" className="tool-step-field-label" m={0}>
    {children}
  </Text>
)

const TechnicalDetails: FC<{ args: unknown; result?: unknown }> = ({ args, result }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <div className="tool-step-tech">
      <UnstyledButton type="button" className="tool-step-tech-toggle" onClick={() => setOpen((v) => !v)}>
        <ScalableIcon icon={IconCode} size={13} />
        <span>{t('Technical details')}</span>
        <ScalableIcon icon={IconChevronRight} size={12} className={clsx('tool-step-chevron', open && 'is-open')} />
      </UnstyledButton>
      <Collapse in={open}>
        <Stack gap="xs" mt={6}>
          <FieldLabel>{t('Arguments')}</FieldLabel>
          <Code block className="tool-step-code">
            {JSON.stringify(args, null, 2)}
          </Code>
          {result !== undefined && (
            <>
              <FieldLabel>{t('Result')}</FieldLabel>
              <Code block className="tool-step-code">
                {JSON.stringify(result, null, 2)}
              </Code>
            </>
          )}
        </Stack>
      </Collapse>
    </div>
  )
}

// ── Web search ───────────────────────────────────────────────────────────

const WebBrowsingToolCallPartSchema = MessageToolCallPartSchema.extend({
  toolName: z.literal('web_search'),
  args: z.object({
    query: z.string(),
  }),
  result: z
    .object({
      query: z.string(),
      searchResults: z.array(
        z.object({
          title: z.string(),
          snippet: z.string(),
          link: z.string(),
        })
      ),
    })
    .optional(),
})

type WebBrowsingToolCallPart = MessageToolCallPart<
  { query: string },
  { query: string; searchResults: SearchResultItem[] }
>

const SearchResultCard: FC<{ index: number; result: SearchResultItem }> = ({ index, result }) => {
  const href = getSafeExternalHref(result.link)
  const host = hostnameOf(result.link)
  const inner = (
    <div className="tool-search-card" title={result.title}>
      <div className="tool-search-card-top">
        <span className="tool-search-card-index tabular-nums">{index + 1}</span>
        <span className="tool-search-card-host">{host}</span>
        {href && <ScalableIcon icon={IconExternalLink} size={12} className="tool-search-card-ext" />}
      </div>
      <Text size="sm" fw={500} lineClamp={2} m={0} className="tool-search-card-title">
        {result.title}
      </Text>
      {result.snippet && (
        <Text size="xs" c="chatbox-tertiary" lineClamp={2} m={0} mt={4}>
          {result.snippet}
        </Text>
      )}
    </div>
  )

  if (!href) return inner
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="tool-search-card-link">
      {inner}
    </a>
  )
}

const WebSearchToolCallUI: FC<{ part: WebBrowsingToolCallPart }> = ({ part }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const count = part.result?.searchResults?.length ?? 0
  const summary = part.args.query
    ? count > 0
      ? `“${previewText(part.args.query, 48)}” · ${count}`
      : `“${previewText(part.args.query, 64)}”`
    : undefined

  return (
    <div className="tool-step">
      <ToolCallHeader
        toolName={part.toolName}
        state={part.state}
        summary={summary}
        expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      />
      {/* Collapsed: horizontal result strip when available */}
      {!expanded && part.result && count > 0 && (
        <div className="tool-search-strip">
          {part.result.searchResults.map((result, index) => (
            <SearchResultCard key={result.link} index={index} result={result} />
          ))}
        </div>
      )}
      <Collapse in={expanded}>
        <ToolStepBody>
          <Stack gap="sm">
            <div>
              <FieldLabel>{t('Search query')}</FieldLabel>
              <Text size="sm" fw={500} mt={4} m={0} className="tool-step-query">
                {part.args.query}
              </Text>
            </div>
            {part.result && count > 0 ? (
              <div className="tool-search-grid">
                {part.result.searchResults.map((result, index) => (
                  <SearchResultCard key={result.link} index={index} result={result} />
                ))}
              </div>
            ) : part.state !== 'call' ? (
              <Text size="sm" c="chatbox-tertiary" m={0}>
                {t('No results')}
              </Text>
            ) : null}
            <TechnicalDetails args={part.args} result={part.result} />
          </Stack>
        </ToolStepBody>
      </Collapse>
    </div>
  )
}

// ── Parse link ───────────────────────────────────────────────────────────

const ParseLinkResultSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  originalLength: z.number().optional(),
  truncated: z.boolean().optional(),
})

const ParseLinkToolCallUI: FC<{ part: MessageToolCallPart }> = ({ part }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const args = (part.args ?? {}) as { url?: string }
  const url = typeof args.url === 'string' ? args.url : ''
  const parsed = useMemo(() => ParseLinkResultSchema.safeParse(part.result), [part.result])
  const result = parsed.success ? parsed.data : null
  const href = getSafeExternalHref(url || result?.url || '')
  const host = hostnameOf(url || result?.url || '')
  const contentPreview = result?.content ? previewText(result.content, 180) : ''
  const summary = part.state === 'call' ? host || t('Fetching…') : contentPreview || result?.title || host || undefined

  return (
    <div className="tool-step">
      <ToolCallHeader
        toolName={part.toolName}
        state={part.state}
        summary={summary}
        expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      />
      <Collapse in={expanded}>
        <ToolStepBody>
          <Stack gap="sm">
            {(href || url) && (
              <div>
                <FieldLabel>{t('URL')}</FieldLabel>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="tool-step-url">
                    <span className="truncate">{host || href}</span>
                    <ScalableIcon icon={IconExternalLink} size={13} className="shrink-0" />
                  </a>
                ) : (
                  <Text size="sm" m={0} mt={4} className="break-all">
                    {url}
                  </Text>
                )}
              </div>
            )}
            {result?.title && result.title !== result.url && (
              <div>
                <FieldLabel>{t('Title')}</FieldLabel>
                <Text size="sm" fw={500} m={0} mt={4}>
                  {result.title}
                </Text>
              </div>
            )}
            {result?.content && (
              <div>
                <FieldLabel>{t('Content')}</FieldLabel>
                <div className="tool-step-content-preview">{result.content}</div>
                {result.truncated && (
                  <Text size="xs" c="dimmed" m={0} mt={4}>
                    {t('Truncated')}
                    {result.originalLength != null ? ` · ${result.originalLength.toLocaleString()} chars` : ''}
                  </Text>
                )}
              </div>
            )}
            {part.state === 'error' && (
              <Text size="sm" c="var(--chatbox-tint-error)" m={0}>
                {previewText(part.result) || t('Failed')}
              </Text>
            )}
            <TechnicalDetails args={part.args} result={part.result} />
          </Stack>
        </ToolStepBody>
      </Collapse>
    </div>
  )
}

// ── Read video ───────────────────────────────────────────────────────────

const ReadVideoToolCallPartSchema = MessageToolCallPartSchema.extend({
  toolName: z.literal('read_video'),
  args: z
    .object({
      fileKey: z.string().optional(),
      mode: z.string().optional(),
      maxFrames: z.number().optional(),
      timestamps: z.array(z.number()).optional(),
      intervalSec: z.number().optional(),
      startSec: z.number().optional(),
      endSec: z.number().optional(),
    })
    .passthrough()
    .optional(),
  result: z
    .object({
      fileKey: z.string().optional(),
      durationSec: z.number().optional(),
      frames: z
        .array(
          z.object({
            timestampSec: z.number(),
            storageKey: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
        )
        .optional(),
      remainingBudget: z.number().optional(),
      error: z.string().optional(),
    })
    .passthrough()
    .optional(),
})

type ReadVideoToolCallPart = MessageToolCallPart<
  {
    fileKey?: string
    mode?: string
    maxFrames?: number
    timestamps?: number[]
    intervalSec?: number
    startSec?: number
    endSec?: number
  },
  {
    fileKey?: string
    durationSec?: number
    frames?: Array<{ timestampSec: number; storageKey: string; width?: number; height?: number }>
    remainingBudget?: number
    error?: string
  }
>

function readVideoSummary(
  part: ReadVideoToolCallPart,
  t: (key: string, opts?: Record<string, unknown>) => string
): string | undefined {
  if (part.state === 'call') return t('Reading video…')
  if (part.state === 'error') return t('Failed')
  const result = part.result
  if (result?.error) return previewText(result.error, 72)
  const frames = result?.frames ?? []
  if (frames.length === 0) return t('No frames')
  const times = frames.map((f) => f.timestampSec)
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  if (frames.length === 1) {
    return t('{{count}} frame · {{time}}', {
      count: 1,
      time: formatDurationForDisplay(minT),
    })
  }
  return t('{{count}} frames · {{start}}–{{end}}', {
    count: frames.length,
    start: formatDurationForDisplay(minT),
    end: formatDurationForDisplay(maxT),
  })
}

const ReadVideoToolCallUI: FC<{ part: ReadVideoToolCallPart }> = ({ part }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const summary = useMemo(() => readVideoSummary(part, t), [part, t])
  const frames = part.result?.frames ?? []
  const remainingBudget = part.result?.remainingBudget

  return (
    <div className="tool-step">
      <ToolCallHeader
        toolName={part.toolName}
        state={part.state}
        summary={summary}
        expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      />
      <Collapse in={expanded}>
        <ToolStepBody>
          <Stack gap="sm">
            {part.state === 'error' || part.result?.error ? (
              <Text size="sm" c="var(--chatbox-tint-error)" m={0}>
                {previewText(part.result?.error || part.result) || t('Failed')}
              </Text>
            ) : frames.length > 0 ? (
              <div>
                <FieldLabel>{t('Frames')}</FieldLabel>
                <div className="tool-video-filmstrip" role="list">
                  {frames.map((frame, index) => (
                    <div
                      key={`${frame.storageKey}-${frame.timestampSec}`}
                      className="tool-video-filmstrip-item"
                      role="listitem"
                      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                    >
                      <div className="tool-video-filmstrip-thumb">
                        <ImageInStorage storageKey={frame.storageKey} className="size-full object-cover" />
                      </div>
                      <span className="tool-video-filmstrip-time font-mono tabular-nums">
                        {formatDurationForDisplay(frame.timestampSec)}
                      </span>
                    </div>
                  ))}
                </div>
                {remainingBudget !== undefined && (
                  <Text size="xs" c="chatbox-tertiary" mt={6} className="font-mono tabular-nums" m={0}>
                    {t('Remaining frame budget: {{count}}', { count: remainingBudget })}
                  </Text>
                )}
              </div>
            ) : part.state === 'result' ? (
              <Text size="sm" c="chatbox-tertiary" m={0}>
                {t('No frames')}
              </Text>
            ) : null}
            <TechnicalDetails args={part.args} result={part.result} />
          </Stack>
        </ToolStepBody>
      </Collapse>
    </div>
  )
}

// ── Generic tools ────────────────────────────────────────────────────────

const GeneralToolCallUI: FC<{ part: MessageToolCallPart }> = ({ part }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const summary = useMemo(() => {
    if (part.state === 'call') return t('Running…')
    if (part.state === 'error') return t('Failed')
    // Prefer a short human line from common arg/result keys
    const args = part.args as Record<string, unknown> | undefined
    for (const key of ['query', 'path', 'file', 'name', 'command', 'url', 'id']) {
      if (args?.[key] != null) return previewText(args[key], 72)
    }
    if (part.result != null) return previewText(part.result, 72)
    return undefined
  }, [part, t])

  const argEntries = useMemo(() => {
    if (!part.args || typeof part.args !== 'object') return []
    return Object.entries(part.args as Record<string, unknown>).slice(0, 8)
  }, [part.args])

  return (
    <div className="tool-step">
      <ToolCallHeader
        toolName={part.toolName}
        state={part.state}
        summary={summary}
        expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      />
      <Collapse in={expanded}>
        <ToolStepBody>
          <Stack gap="sm">
            {argEntries.length > 0 && (
              <div className="tool-kv">
                {argEntries.map(([key, value]) => (
                  <div key={key} className="tool-kv-row">
                    <span className="tool-kv-key">{key}</span>
                    <span className="tool-kv-val">{previewText(value, 200)}</span>
                  </div>
                ))}
              </div>
            )}
            {part.result != null && part.state !== 'error' && (
              <div>
                <FieldLabel>{t('Result')}</FieldLabel>
                <div className="tool-step-content-preview">{previewText(part.result, 600)}</div>
              </div>
            )}
            {part.state === 'error' && (
              <Text size="sm" c="var(--chatbox-tint-error)" m={0}>
                {previewText(part.result) || t('Failed')}
              </Text>
            )}
            <TechnicalDetails args={part.args} result={part.result} />
          </Stack>
        </ToolStepBody>
      </Collapse>
    </div>
  )
}

// ── Router ───────────────────────────────────────────────────────────────

export const ToolCallPartUI: FC<{ part: MessageToolCallPart }> = ({ part }) => {
  // Task tools render as TodoAppCard (coalesced) — hide raw steps to avoid noise.
  if (isTaskTrackingTool(part.toolName)) {
    return null
  }
  if (part.toolName === 'web_search') {
    const parsedPart = WebBrowsingToolCallPartSchema.safeParse(part)
    if (parsedPart.success) {
      return <WebSearchToolCallUI part={parsedPart.data as WebBrowsingToolCallPart} />
    }
  }
  if (part.toolName === 'parse_link') {
    return <ParseLinkToolCallUI part={part} />
  }
  if (part.toolName === 'read_video') {
    const parsedPart = ReadVideoToolCallPartSchema.safeParse(part)
    if (parsedPart.success) {
      return <ReadVideoToolCallUI part={parsedPart.data as ReadVideoToolCallPart} />
    }
  }
  return <GeneralToolCallUI part={part} />
}
