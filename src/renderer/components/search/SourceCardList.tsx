import { Group, ScrollArea } from '@mantine/core'
import type { SearchCitation } from '@shared/types'
import { memo } from 'react'
import { SourceCard } from './SourceCard'

export const SourceCardList = memo(({ citations }: { citations: SearchCitation[] }) => {
  if (!citations.length) {
    return null
  }

  return (
    <ScrollArea type="never" className="mb-3" offsetScrollbars="x" onClick={(event) => event.stopPropagation()}>
      <Group gap="sm" wrap="nowrap">
        {citations.map((citation) => (
          <SourceCard key={`${citation.index}-${citation.url}`} citation={citation} />
        ))}
      </Group>
    </ScrollArea>
  )
})

SourceCardList.displayName = 'SourceCardList'
