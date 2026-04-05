import { Tooltip, UnstyledButton } from '@mantine/core'
import type { SearchCitation } from '@shared/types'
import { memo } from 'react'
import platform from '@/platform'

export const CitationBadge = memo(({ citation }: { citation: SearchCitation }) => {
  const domain = (() => {
    try {
      return new URL(citation.url).hostname
    } catch {
      return citation.url
    }
  })()

  return (
    <Tooltip
      label={
        <div className="max-w-72">
          <div className="font-medium">{citation.title || citation.url}</div>
          <div className="text-xs opacity-80">
            {citation.source} · {domain}
          </div>
        </div>
      }
      multiline
      withArrow
    >
      <UnstyledButton
        component="sup"
        className="mx-0.5 cursor-pointer rounded-sm px-0.5 align-super text-[0.75em] font-semibold text-chatbox-brand hover:bg-chatbox-background-brand-secondary"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          platform.openLink(citation.url)
        }}
      >
        [{citation.index}]
      </UnstyledButton>
    </Tooltip>
  )
})

CitationBadge.displayName = 'CitationBadge'
