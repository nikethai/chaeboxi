import { HoverCard, Popover, UnstyledButton } from '@mantine/core'
import { IconQuote, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import type { QuoteDraft } from '@/stores/uiStore'
import { QuoteDetailPanel, quotePreviewText, quoteRoleLabel } from '../chat/QuoteDetailPanel'

export type QuoteChipProps = {
  quote: QuoteDraft
  onRemove: () => void
}

export function QuoteChip({ quote, onRemove }: QuoteChipProps) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const [mobileOpen, setMobileOpen] = useState(false)

  const roleLabel = quoteRoleLabel(quote.sourceRole, t)
  const preview = quotePreviewText(quote.text, 28)
  const chipLabel = quote.isPartial ? `${t('Quote')} · ${t('selection')}` : `${t('Quote')} · ${roleLabel}`
  const ariaLabel = quote.isPartial
    ? `${t('Quote')} (${t('selection')}): ${preview}`
    : `${t('Quote')} (${roleLabel}): ${preview}`

  const chip = (
    <span className="composer-skill-chip" aria-label={ariaLabel}>
      <IconQuote size={14} stroke={1.8} aria-hidden className="shrink-0 text-[var(--chatbox-tint-brand)]" />
      <span className="max-w-[160px] truncate">{chipLabel}</span>
      {!quote.isPartial && preview ? (
        <span className="max-w-[100px] truncate text-[var(--chatbox-tint-tertiary)]">{preview}</span>
      ) : null}
      <UnstyledButton
        className="composer-skill-chip-remove"
        aria-label={t('Remove quote')}
        onClick={(event) => {
          event.stopPropagation()
          setMobileOpen(false)
          onRemove()
        }}
      >
        <IconX size={12} stroke={2} />
      </UnstyledButton>
    </span>
  )

  if (isSmallScreen) {
    return (
      <Popover
        opened={mobileOpen}
        onChange={setMobileOpen}
        position="top-start"
        withArrow
        shadow="md"
        withinPortal
        radius="md"
      >
        <Popover.Target>
          <button
            type="button"
            className="appearance-none border-0 bg-transparent p-0 m-0 cursor-pointer"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {chip}
          </button>
        </Popover.Target>
        <Popover.Dropdown p={0} className="border-0 bg-transparent shadow-none">
          <QuoteDetailPanel quote={quote} />
        </Popover.Dropdown>
      </Popover>
    )
  }

  return (
    <HoverCard width="target" openDelay={220} closeDelay={120} position="top-start" shadow="md" withinPortal>
      <HoverCard.Target>{chip}</HoverCard.Target>
      <HoverCard.Dropdown p={0} className="border-0 bg-transparent shadow-none">
        <QuoteDetailPanel quote={quote} />
      </HoverCard.Dropdown>
    </HoverCard>
  )
}

export default QuoteChip
