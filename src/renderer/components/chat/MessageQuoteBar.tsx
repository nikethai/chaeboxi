import { HoverCard, Popover, Text } from '@mantine/core'
import type { MessageQuoteAttachment } from '@shared/types'
import { IconQuote } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import { QuoteDetailPanel, quotePreviewText, quoteRoleLabel } from './QuoteDetailPanel'

export type MessageQuoteBarProps = {
  quote: MessageQuoteAttachment
  className?: string
}

/** Compact reply-style quote bar on a sent user message. */
export function MessageQuoteBar({ quote, className }: MessageQuoteBarProps) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const [mobileOpen, setMobileOpen] = useState(false)

  const roleLabel = quoteRoleLabel(quote.sourceRole, t)
  const preview = quotePreviewText(quote.text, 72)
  const title = quote.isPartial ? t('Partial quote') : t('Quoted message')

  const bar = (
    <button
      type="button"
      className={cn(
        'group flex w-full max-w-full items-start gap-2 rounded-lg border border-solid border-[var(--chatbox-border-primary)]',
        'bg-[var(--chatbox-background-secondary)] px-2.5 py-1.5 text-left',
        'border-l-[3px] border-l-[var(--chatbox-tint-brand)]',
        'transition-colors hover:bg-[var(--chatbox-background-tertiary)]',
        'cursor-pointer appearance-none',
        className
      )}
      aria-label={`${title}: ${preview}`}
      onClick={isSmallScreen ? () => setMobileOpen((open) => !open) : undefined}
    >
      <IconQuote size={14} stroke={1.8} className="mt-0.5 shrink-0 text-[var(--chatbox-tint-brand)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Text size="xs" className="font-medium text-[var(--chatbox-tint-secondary)]">
            {title}
          </Text>
          <Text size="xs" c="dimmed">
            · {roleLabel}
          </Text>
        </div>
        <Text size="xs" className="mt-0.5 line-clamp-2 text-[var(--chatbox-tint-primary)] leading-snug">
          {preview}
        </Text>
      </div>
    </button>
  )

  if (isSmallScreen) {
    return (
      <Popover
        opened={mobileOpen}
        onChange={setMobileOpen}
        position="bottom-start"
        withArrow
        shadow="md"
        withinPortal
        radius="md"
      >
        <Popover.Target>{bar}</Popover.Target>
        <Popover.Dropdown p={0} className="border-0 bg-transparent shadow-none">
          <QuoteDetailPanel quote={quote} />
        </Popover.Dropdown>
      </Popover>
    )
  }

  return (
    <HoverCard openDelay={200} closeDelay={100} position="top-start" shadow="md" withinPortal>
      <HoverCard.Target>{bar}</HoverCard.Target>
      <HoverCard.Dropdown p={0} className="border-0 bg-transparent shadow-none">
        <QuoteDetailPanel quote={quote} />
      </HoverCard.Dropdown>
    </HoverCard>
  )
}

export default MessageQuoteBar
