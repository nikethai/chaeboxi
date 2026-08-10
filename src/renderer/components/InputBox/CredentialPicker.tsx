import { Box, Text } from '@mantine/core'
import { getConnector } from '@shared/integrations'
import type { IntegrationAccount } from '@shared/types/integrations'
import { memo, type RefObject, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { navigateToSettings } from '@/modals/Settings'
import { fuzzyScoreCredential, slugifyCredentialLabel } from '@/packages/integrations/hash-tokens'
import ComposerPickerPanel from './ComposerPickerPanel'

export function filterCredentials(accounts: IntegrationAccount[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  return accounts
    .filter((a) => a.status !== 'disabled' && a.status !== 'revoked')
    .map((account) => {
      const connector = getConnector(account.connectorId)
      const haystack = [
        account.label,
        account.accountHint || '',
        account.connectorId,
        connector?.name || '',
        slugifyCredentialLabel(account.label),
      ].join(' ')
      return {
        account,
        score: fuzzyScoreCredential(haystack, normalizedQuery),
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.account.label.localeCompare(b.account.label))
    .map((item) => item.account)
}

export interface CredentialPickerProps {
  accounts: IntegrationAccount[]
  highlightedIndex: number
  onHighlightChange(index: number): void
  onSelect(account: IntegrationAccount): void
  query: string
  excludeIds?: string[]
  anchorRef: RefObject<HTMLElement | null>
}

function CredentialPicker({
  accounts,
  highlightedIndex,
  onHighlightChange,
  onSelect,
  query,
  excludeIds = [],
  anchorRef,
}: CredentialPickerProps) {
  const { t } = useTranslation()
  const available = useMemo(() => {
    const exclude = new Set(excludeIds)
    return accounts.filter(
      (a) => a.status !== 'disabled' && a.status !== 'revoked' && !exclude.has(a.id)
    )
  }, [accounts, excludeIds])

  const filtered = useMemo(
    () => filterCredentials(available, query).slice(0, 8),
    [available, query]
  )
  const catalogEmpty = available.length === 0
  const isEmpty = filtered.length === 0

  useEffect(() => {
    if (filtered.length === 0) return
    if (highlightedIndex >= filtered.length) {
      onHighlightChange(0)
    }
  }, [filtered.length, highlightedIndex, onHighlightChange])

  return (
    <ComposerPickerPanel
      anchorRef={anchorRef}
      open
      aria-label={t('Accounts')}
      header={
        <Text size="xs" fw={600} c="chatbox-secondary">
          {t('Accounts')}
        </Text>
      }
      isEmpty={isEmpty}
      empty={
        catalogEmpty
          ? {
              title: t('No accounts connected'),
              description: t('Connect Google, GitHub, Jira, or Asana in Settings, then mention them with #.'),
              action: {
                label: t('Open Integrations'),
                onClick: () => navigateToSettings('/integrations'),
              },
            }
          : {
              title: t('No match'),
            }
      }
    >
      {filtered.map((account, index) => {
        const selected = index === highlightedIndex
        const connector = getConnector(account.connectorId)
        const subtitle = [
          connector?.name ?? account.connectorId,
          account.accountHint,
          account.isDefault ? t('Default') : null,
          account.status !== 'active' ? account.status : null,
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <Box
            key={account.id}
            px="sm"
            py="xs"
            className="composer-picker-row cursor-pointer"
            data-selected={selected || undefined}
            bg={selected ? 'var(--chatbox-background-brand-secondary)' : undefined}
            onMouseEnter={() => onHighlightChange(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              onSelect(account)
            }}
          >
            <Text size="sm" fw={600} c={selected ? 'chatbox-brand' : 'chatbox-primary'} className="truncate">
              {account.label}
            </Text>
            {subtitle ? (
              <Text size="xs" c="chatbox-tertiary" lineClamp={1} className="mt-0.5">
                {subtitle}
              </Text>
            ) : null}
          </Box>
        )
      })}
    </ComposerPickerPanel>
  )
}

export default memo(CredentialPicker)
