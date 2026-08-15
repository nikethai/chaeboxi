import { ActionIcon, Box, Collapse, Group, Text } from '@mantine/core'
import type { Message, MessageContentParts, MessageReasoningPart, MessageToolCallPart } from '@shared/types'
import { IconCircleXFilled, IconCopy } from '@tabler/icons-react'
import clsx from 'clsx'
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Markdown from '@/components/Markdown'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { formatWorkedDuration, useThinkingTimer } from '@/hooks/useThinkingTimer'
import { copyToClipboard } from '@/packages/navigator'
import { isTaskTrackingTool } from '@/packages/tools/task-tools'
import * as toastActions from '@/stores/toastActions'
import { ScalableIcon } from '../common/ScalableIcon'
import { ToolCallPartUI } from './ToolCallPartUI'

interface ThinkingGroupUIProps {
  message: Message
  sessionId?: string
  parts: MessageContentParts
  /** Mid-turn assistant prose absorbed from between tools — only shown when expanded */
  monologueTexts?: string[]
  /** True while the model is still running tools/reasoning (not final answer yet) */
  isLastGroup: boolean
}

/**
 * Single product “Worked” strip for an assistant turn.
 * All tools + reasoning + monologue live here; final answer renders outside.
 * Collapsed by default when finished successfully.
 */
export const ThinkingGroupUI: FC<ThinkingGroupUIProps> = ({
  message,
  parts,
  monologueTexts = [],
  isLastGroup,
}) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()

  const reasoningParts = useMemo(() => parts.filter((p) => p.type === 'reasoning') as MessageReasoningPart[], [parts])
  const toolCallParts = useMemo(() => parts.filter((p) => p.type === 'tool-call') as MessageToolCallPart[], [parts])
  const visibleToolCallParts = useMemo(
    () =>
      toolCallParts.filter(
        (p) => !isTaskTrackingTool(p.toolName) && p.toolName !== 'memory_lookup'
      ),
    [toolCallParts]
  )
  const toolCount = visibleToolCallParts.length
  const toolStatusCounts = useMemo(() => {
    return visibleToolCallParts.reduce(
      (counts, part) => {
        if (part.state === 'error') {
          counts.failed += 1
          return counts
        }
        if (part.state === 'call') {
          counts.running += 1
          return counts
        }
        counts.succeeded += 1
        return counts
      },
      { failed: 0, running: 0, succeeded: 0 }
    )
  }, [visibleToolCallParts])
  // Live while parent says work is active OR any tool is still running OR generation
  // has not finished yet with this work strip present. Never flash "Worked" mid-turn.
  const isThinking = Boolean(
    message.generating && (isLastGroup || toolStatusCounts.running > 0)
  )

  // Product default: always collapsed during live generation (header-only).
  // Expanding tools mid-stream is the main scrollbar thrash source — only open on user click
  // or after the turn finishes with failures.
  const [isExpanded, setIsExpanded] = useState(false)
  const userToggledRef = useRef(false)

  useEffect(() => {
    if (message.generating) {
      // Force collapsed while streaming unless the user explicitly opened the strip.
      if (!userToggledRef.current && isExpanded) setIsExpanded(false)
      return
    }
    // Generation ended: collapse successful work; leave open if tools failed.
    userToggledRef.current = false
    if (toolStatusCounts.failed === 0) {
      setIsExpanded(false)
    } else {
      setIsExpanded(true)
    }
  }, [message.generating, toolStatusCounts.failed, isExpanded])

  const totalDuration = useMemo(() => {
    return reasoningParts.reduce((sum, p) => sum + (p.duration || 0), 0)
  }, [reasoningParts])

  const lastReasoningPart = reasoningParts[reasoningParts.length - 1]
  const elapsedTime = useThinkingTimer(lastReasoningPart?.startTime, isThinking || false)
  const shouldShowTimer = message.isStreamingMode === true

  const displayTime = totalDuration > 0 ? totalDuration : isThinking && elapsedTime > 0 ? elapsedTime : 0

  const allReasoningText = useMemo(() => {
    const fromParts = reasoningParts.map((p) => p.text).filter(Boolean)
    return [...fromParts, ...monologueTexts].join('\n\n')
  }, [reasoningParts, monologueTexts])

  const toggleExpanded = useCallback(() => {
    userToggledRef.current = true
    setIsExpanded((prev) => !prev)
  }, [])

  const onCopy = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      if (allReasoningText) {
        copyToClipboard(allReasoningText)
        toastActions.add(t('copied to clipboard'), 2000)
      }
    },
    [allReasoningText, t]
  )

  // Grok DNA: one calm phrase. Avoid "Using tools… / Thinking…" thrash + busy badges.
  const headerLabel = useMemo(() => {
    if (message.generating) {
      if (toolStatusCounts.running > 0) {
        return toolCount > 1 ? t('Using tools…') : t('Using tools…')
      }
      // After tools finish but before answer — still live, never "Worked".
      return t('Thinking…')
    }

    const hasDuration = shouldShowTimer && displayTime > 0
    const compact = hasDuration ? formatWorkedDuration(displayTime) : null

    // Finished: "Worked for 3s" (design contract). Tools are detail, not the headline.
    if (compact) {
      return t('Worked for {{duration}}', { duration: compact })
    }
    if (toolCount > 0) {
      return toolCount === 1 ? t('Worked · 1 tool') : t('Worked · {{count}} tools', { count: toolCount })
    }
    return t('Worked')
  }, [message.generating, toolStatusCounts.running, shouldShowTimer, displayTime, toolCount, t])

  const hasExpandableBody = toolCount > 0 || allReasoningText.length > 0
  // Always reserve timer width while live so 0s→1s does not shove chevron/layout.
  const showLiveTimer = Boolean(message.generating && shouldShowTimer)
  const liveSeconds =
    displayTime >= 1000
      ? formatWorkedDuration(displayTime)
      : elapsedTime >= 1000
        ? formatWorkedDuration(elapsedTime)
        : '0s'

  // One-shot enter animation — do not re-fire when label/timer updates mid-turn.
  const [enterSettled, setEnterSettled] = useState(false)
  useEffect(() => {
    if (!message.generating) {
      setEnterSettled(false)
      return
    }
    if (enterSettled) return
    const t = window.setTimeout(() => setEnterSettled(true), 260)
    return () => window.clearTimeout(t)
  }, [message.generating, enterSettled])

  return (
    <div
      className={clsx(
        'msg-worked',
        message.generating && 'is-live',
        message.generating && enterSettled && 'is-settled',
        isSmallScreen && 'mx-0.5'
      )}
    >
      <div className="msg-worked-row">
        <button
          type="button"
          className="msg-worked-toggle"
          onClick={hasExpandableBody ? toggleExpanded : undefined}
          aria-expanded={isExpanded}
          disabled={!hasExpandableBody}
        >
          <span className="msg-worked-label">
            {headerLabel}
          </span>
          {showLiveTimer && (
            <span className="msg-worked-live tabular-nums">{liveSeconds}</span>
          )}
          {toolStatusCounts.failed > 0 && !message.generating && (
            <Group gap={3} ml={4} wrap="nowrap" className="shrink-0">
              <ScalableIcon icon={IconCircleXFilled} size={12} color="var(--chatbox-tint-error)" />
              <Text size="xs" fw={500} className="tabular-nums" style={{ color: 'var(--chatbox-tint-error)' }}>
                {toolStatusCounts.failed}
              </Text>
            </Group>
          )}
          {hasExpandableBody && (
            <span className={clsx('msg-worked-chevron', isExpanded && 'is-open')} aria-hidden>
              ›
            </span>
          )}
        </button>
        {allReasoningText.length > 0 && !message.generating && (
          <ActionIcon
            variant="subtle"
            color="chatbox-secondary"
            size="sm"
            className="msg-worked-copy"
            onClick={onCopy}
            aria-label={t('Copy reasoning content')}
          >
            <ScalableIcon icon={IconCopy} size={14} />
          </ActionIcon>
        )}
      </div>

      {/* Expanded body only — live cue is this strip, not the composer. */}
      <Collapse in={isExpanded && hasExpandableBody}>
        <div className="msg-worked-body">
          {(() => {
            type RenderItem =
              | { kind: 'reasoning'; index: number; part: MessageReasoningPart }
              | { kind: 'tool'; part: MessageToolCallPart; runCount: number; key: string }

            const items: RenderItem[] = []
            for (let index = 0; index < parts.length; index++) {
              const part = parts[index]
              if (part.type === 'reasoning') {
                items.push({ kind: 'reasoning', index, part: part as MessageReasoningPart })
                continue
              }
              if (part.type !== 'tool-call' || isTaskTrackingTool(part.toolName)) continue
              const toolPart = part as MessageToolCallPart
              const sig = `${toolPart.toolName}::${JSON.stringify(toolPart.args ?? {})}`
              const prev = items[items.length - 1]
              if (
                prev?.kind === 'tool' &&
                prev.part.state !== 'call' &&
                toolPart.state !== 'call' &&
                prev.part.state === toolPart.state &&
                `${prev.part.toolName}::${JSON.stringify(prev.part.args ?? {})}` === sig
              ) {
                prev.runCount += 1
                continue
              }
              items.push({ kind: 'tool', part: toolPart, runCount: 1, key: toolPart.toolCallId })
            }

            return (
              <>
                {items.map((item) =>
                  item.kind === 'reasoning' ? (
                    <Box
                      key={`group-reasoning-${item.index}`}
                      className="reasoning-content msg-worked-reasoning"
                      mb={toolCount > 0 ? 'xs' : 0}
                    >
                      <Markdown
                        enableLaTeXRendering={false}
                        enableMermaidRendering={false}
                        hiddenCodeCopyButton={false}
                        className={isSmallScreen ? 'text-[13px]' : 'text-sm'}
                        generating={isThinking && item.index === parts.length - 1}
                      >
                        {item.part.text}
                      </Markdown>
                    </Box>
                  ) : (
                    <Box key={`group-tool-${item.key}`} className="tool-step-wrap">
                      <ToolCallPartUI part={item.part} runCount={item.runCount} />
                    </Box>
                  )
                )}
                {monologueTexts.length > 0 && (
                  <div className="msg-worked-monologue">
                    {monologueTexts.map((text, i) => (
                      <p key={`monologue-${i}`} className="msg-worked-monologue-line">
                        {text}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </Collapse>
    </div>
  )
}
