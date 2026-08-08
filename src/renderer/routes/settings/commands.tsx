import {
  Badge,
  Box,
  Button,
  FileButton,
  Flex,
  Modal,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import type { CommandPackage } from '@shared/types'
import { IconDownload, IconPlus, IconRefresh, IconTrash, IconUpload } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AGENT_COMMAND_ROOTS, isValidCommandName } from '@/packages/commands'
import platform from '@/platform'
import { useCommands } from '@/stores/commandsStore'
import { add as addToast } from '@/stores/toastActions'

export const Route = createFileRoute('/settings/commands')({
  component: RouteComponent,
})

export function RouteComponent() {
  const { t } = useTranslation()
  const {
    commands,
    agentRoots,
    agentCommandCount,
    upsertCommand,
    setCommandEnabled,
    removeCommand,
    importCommandMd,
    exportCommandMd,
    rescanAgentCommands,
  } = useCommands()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<CommandPackage> | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [rescanning, setRescanning] = useState(false)
  const isDesktop = platform.type === 'desktop'

  const openCreate = () => {
    setEditing({
      name: '',
      description: '',
      instructions: '',
      enabled: true,
      source: 'user',
    })
    setEditorOpen(true)
  }

  const openEdit = (cmd: CommandPackage) => {
    if (cmd.source === 'agent') {
      addToast(t('Agent commands are read from disk. Edit the file in that folder, then rescan.'))
      return
    }
    setEditing({ ...cmd })
    setEditorOpen(true)
  }

  const handleRescan = async () => {
    setRescanning(true)
    try {
      const result = await rescanAgentCommands()
      const foundRoots = result.roots.filter((r) => r.exists).length
      addToast(
        t('Found {{count}} commands from {{dirs}} agent folders', {
          count: result.count,
          dirs: foundRoots,
        })
      )
    } catch (e) {
      addToast((e as Error).message || t('Failed to scan agent command folders'))
    } finally {
      setRescanning(false)
    }
  }

  const saveEditor = () => {
    if (!editing?.name || !editing.description) {
      addToast(t('Name and description are required'))
      return
    }
    if (!isValidCommandName(editing.name)) {
      addToast(t('Command name must be lowercase letters, numbers, and hyphens'))
      return
    }
    try {
      upsertCommand({
        id: editing.id,
        name: editing.name.toLowerCase(),
        description: editing.description,
        instructions: editing.instructions || '',
        enabled: editing.enabled ?? true,
        source: editing.source === 'import' ? 'import' : 'user',
        version: editing.version,
        tags: editing.tags,
      })
      setEditorOpen(false)
      setEditing(null)
      addToast(t('Command saved'))
    } catch (e) {
      addToast((e as Error).message)
    }
  }

  const handleImportFile = async (file: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      importCommandMd(text, 'import')
      addToast(t('Command imported'))
    } catch (e) {
      addToast((e as Error).message || t('Import failed'))
    }
  }

  const handleExport = (commandId: string, name: string) => {
    const md = exportCommandMd(commandId)
    if (!md) return
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Stack gap="lg" p="md">
      <Flex justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Stack gap={4}>
          <Title order={5}>{t('Commands')}</Title>
          <Text size="sm" c="chatbox-tertiary">
            {t(
              'User-invoked workflows you tag with /command-name in chat. Never auto-selected. Desktop loads from Claude and Cursor command folders.'
            )}
          </Text>
        </Stack>
        <Flex gap="xs" wrap="wrap">
          {isDesktop && (
            <Button
              variant="default"
              leftSection={<IconRefresh size={16} />}
              loading={rescanning}
              onClick={() => void handleRescan()}
            >
              {t('Rescan agent folders')}
            </Button>
          )}
          <FileButton onChange={handleImportFile} accept=".md,text/markdown,text/plain">
            {(props) => (
              <Button {...props} variant="default" leftSection={<IconUpload size={16} />}>
                {t('Import')}
              </Button>
            )}
          </FileButton>
          <Button variant="default" onClick={() => setImportOpen(true)}>
            {t('Paste markdown')}
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            {t('New command')}
          </Button>
        </Flex>
      </Flex>

      {isDesktop && (
        <Box
          p="md"
          style={{
            borderRadius: 12,
            background: 'var(--chatbox-background-secondary)',
            border: '1px solid var(--chatbox-border-primary)',
          }}
        >
          <Text size="sm" fw={600} mb={6}>
            {t('Agent command folders')}
            {agentCommandCount > 0 ? ` · ${agentCommandCount}` : ''}
          </Text>
          <Text size="xs" c="chatbox-tertiary" mb="sm">
            {t('Project folders use the session workspace root when set. Project wins over global when names collide.')}
          </Text>
          <Stack gap={4}>
            {(agentRoots.length
              ? agentRoots
              : AGENT_COMMAND_ROOTS.map((r) => ({ path: r.path, origin: r.origin, exists: false }))
            ).map((root) => (
              <Text key={root.path} size="xs" c={root.exists ? 'chatbox-secondary' : 'chatbox-tertiary'} className="font-mono">
                {root.exists ? '●' : '○'} {root.origin}: {root.path}
              </Text>
            ))}
          </Stack>
        </Box>
      )}

      <Stack gap="sm">
        {commands.map((cmd) => (
          <Box
            key={cmd.id}
            p="md"
            style={{
              border: '1px solid var(--chatbox-border-primary)',
              borderRadius: 12,
              background: 'var(--chatbox-background-secondary)',
            }}
          >
            <Flex justify="space-between" align="flex-start" gap="md">
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Flex gap="xs" align="center" wrap="wrap">
                  <Text fw={600}>/{cmd.name}</Text>
                  <Badge size="xs" variant="light">
                    {cmd.source === 'agent' && cmd.origin ? cmd.origin : cmd.source}
                  </Badge>
                  {!cmd.enabled && (
                    <Badge size="xs" color="gray">
                      {t('Disabled')}
                    </Badge>
                  )}
                </Flex>
                <Text size="sm" c="chatbox-secondary" lineClamp={2}>
                  {cmd.description}
                </Text>
                {cmd.originPath && (
                  <Text size="xs" c="chatbox-tertiary" lineClamp={1} className="font-mono">
                    {cmd.originPath}
                  </Text>
                )}
              </Stack>
              <Flex gap="xs" align="center">
                <Switch
                  checked={cmd.enabled}
                  onChange={(e) => setCommandEnabled(cmd.id, e.currentTarget.checked)}
                  label={t('Enabled')}
                  labelPosition="left"
                />
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconDownload size={14} />}
                  onClick={() => handleExport(cmd.id, cmd.name)}
                >
                  {t('Export')}
                </Button>
                {cmd.source !== 'agent' && (
                  <>
                    <Button variant="subtle" size="xs" onClick={() => openEdit(cmd)}>
                      {t('Edit')}
                    </Button>
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => removeCommand(cmd.id)}
                    >
                      {t('Delete')}
                    </Button>
                  </>
                )}
              </Flex>
            </Flex>
          </Box>
        ))}
        {commands.length === 0 && (
          <Text size="sm" c="chatbox-tertiary">
            {t('No commands yet. Create one or rescan agent folders on desktop.')}
          </Text>
        )}
      </Stack>

      <Modal
        opened={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing?.id ? t('Edit command') : t('New command')}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label={t('Name')}
            description={t('Lowercase kebab-case — used as /name in chat')}
            value={editing?.name || ''}
            onChange={(e) => setEditing((prev) => ({ ...prev, name: e.currentTarget.value }))}
          />
          <TextInput
            label={t('Description')}
            value={editing?.description || ''}
            onChange={(e) => setEditing((prev) => ({ ...prev, description: e.currentTarget.value }))}
          />
          <Textarea
            label={t('Instructions')}
            minRows={8}
            value={editing?.instructions || ''}
            onChange={(e) => setEditing((prev) => ({ ...prev, instructions: e.currentTarget.value }))}
          />
          <Flex justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setEditorOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={saveEditor}>{t('Save')}</Button>
          </Flex>
        </Stack>
      </Modal>

      <Modal opened={importOpen} onClose={() => setImportOpen(false)} title={t('Paste command markdown')} size="lg">
        <Stack gap="md">
          <Textarea
            minRows={12}
            value={importText}
            onChange={(e) => setImportText(e.currentTarget.value)}
            placeholder={'---\nname: review\ndescription: Review changes\n---\n\nReview the diff…'}
          />
          <Flex justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setImportOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={() => {
                try {
                  importCommandMd(importText, 'import')
                  setImportOpen(false)
                  setImportText('')
                  addToast(t('Command imported'))
                } catch (e) {
                  addToast((e as Error).message)
                }
              }}
            >
              {t('Import')}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Stack>
  )
}
