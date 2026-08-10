import { Button, Flex } from '@mantine/core'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

export type MemoryTagFilterProps = {
  tags: string[]
  activeTag: string | null
  onTagChange: (tag: string | null) => void
}

export const MemoryTagFilter: FC<MemoryTagFilterProps> = ({ tags, activeTag, onTagChange }) => {
  const { t } = useTranslation()

  if (!tags.length) return null

  return (
    <Flex gap={4} wrap="wrap">
      <Button size="compact-xs" variant={activeTag === null ? 'filled' : 'default'} onClick={() => onTagChange(null)}>
        {t('All')}
      </Button>
      {tags.map((tag) => (
        <Button
          key={tag}
          size="compact-xs"
          variant={activeTag === tag ? 'filled' : 'default'}
          onClick={() => onTagChange(activeTag === tag ? null : tag)}
        >
          {tag}
        </Button>
      ))}
    </Flex>
  )
}
