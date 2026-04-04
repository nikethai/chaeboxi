import { ActionIcon, Group, Paper, Portal, Tooltip } from '@mantine/core'
import { IconBulb, IconCopy, IconLanguage } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

type TextSelectionToolbarProps = {
  opened: boolean
  position: { x: number; y: number } | null
  onExplain: () => void
  onTranslate: () => void
  onCopy: () => void
  onClose: () => void
}

const TextSelectionToolbar = ({
  opened,
  position,
  onExplain,
  onTranslate,
  onCopy,
  onClose,
}: TextSelectionToolbarProps) => {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!opened) {
      return
    }

    const handleSelectionChange = () => {
      const nextSelection = window.getSelection()?.toString().trim()
      if (!nextSelection) {
        onClose()
      }
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [opened, onClose])

  if (!opened || !position) {
    return null
  }

  return (
    <Portal>
      <Paper
        ref={ref}
        shadow="md"
        radius="xl"
        p={4}
        withBorder
        className="z-[400] bg-chatbox-background-primary"
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          transform: 'translate(-50%, -100%)',
        }}
      >
        <Group gap={4} wrap="nowrap">
          <Tooltip label={t('Explain this')}>
            <ActionIcon variant="light" radius="xl" onClick={onExplain} aria-label={t('Explain this')}>
              <IconBulb size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Translate')}>
            <ActionIcon variant="light" radius="xl" onClick={onTranslate} aria-label={t('Translate')}>
              <IconLanguage size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Copy')}>
            <ActionIcon variant="light" radius="xl" onClick={onCopy} aria-label={t('Copy')}>
              <IconCopy size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>
    </Portal>
  )
}

export default TextSelectionToolbar
