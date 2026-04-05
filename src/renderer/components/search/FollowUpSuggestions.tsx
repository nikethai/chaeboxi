import { Button, Group } from '@mantine/core'
import { IconSparkles } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { SearchCitation } from '@shared/types'
import { createMessage } from '@shared/utils/message'
import { submitNewUserMessage } from '@/stores/session/messages'

interface FollowUpSuggestionsProps {
  sessionId: string
  citations?: SearchCitation[]
  searchQuery?: string
}

/**
 * Generate follow-up suggestion text based on search context.
 * Lightweight — no LLM calls, just template-based suggestions.
 */
function generateSuggestions(searchQuery?: string, citations?: SearchCitation[]): string[] {
  const suggestions: string[] = []

  if (searchQuery) {
    suggestions.push(`Tell me more about ${searchQuery}`)
    suggestions.push(`What are the pros and cons?`)
    suggestions.push(`Compare with alternatives`)
  }

  if (citations?.length) {
    const topDomains = Array.from(
      new Set(
        citations
          .slice(0, 3)
          .map((c) => {
            try {
              return new URL(c.url).hostname.replace('www.', '')
            } catch {
              return null
            }
          })
          .filter(Boolean)
      )
    )
    if (topDomains.length > 0) {
      suggestions.push(`Summarize the key findings`)
    }
  }

  if (suggestions.length === 0) {
    suggestions.push('Explain in more detail', 'Give me practical examples')
  }

  return suggestions.slice(0, 3)
}

export default function FollowUpSuggestions({ sessionId, citations, searchQuery }: FollowUpSuggestionsProps) {
  const { t } = useTranslation()

  const suggestions = generateSuggestions(searchQuery, citations)

  if (suggestions.length === 0) {
    return null
  }

  const handleSuggestionClick = (suggestion: string) => {
    const msg = createMessage('user', suggestion)
    void submitNewUserMessage(sessionId, {
      newUserMsg: msg,
      needGenerating: true,
    })
  }

  return (
    <Group gap="xs" mt="xs" wrap="wrap">
      <IconSparkles size={14} className="text-[var(--chatbox-tint-brand)] shrink-0" />
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion}
          variant="light"
          size="compact-xs"
          radius="xl"
          color="chatbox-brand"
          className="font-normal"
          onClick={() => handleSuggestionClick(suggestion)}
        >
          {t(suggestion)}
        </Button>
      ))}
    </Group>
  )
}
