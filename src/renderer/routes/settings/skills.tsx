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
import type { SkillPackage } from '@shared/types'
import { IconDownload, IconPlus, IconRefresh, IconTrash, IconUpload } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AGENT_SKILL_ROOTS, isValidSkillName } from '@/packages/skills'
import { useSkills } from '@/stores/skillsStore'
import { add as addToast } from '@/stores/toastActions'
import platform from '@/platform'

export const Route = createFileRoute('/settings/skills')({
  component: RouteComponent,
})

export function RouteComponent() {
  const { t } = useTranslation()
  const {
    skills,
    agentRoots,
    agentSkillCount,
    upsertSkill,
    setSkillEnabled,
    removeSkill,
    importSkillMd,
    exportSkillMd,
    rescanAgentSkills,
  } = useSkills()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<SkillPackage> | null>(null)
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

  const openEdit = (skill: SkillPackage) => {
    if (skill.source === 'builtin' || skill.source === 'agent') {
      addToast(
        skill.source === 'agent'
          ? t('Agent skills are read from disk. Edit the SKILL.md in that folder, then rescan.')
          : t('Builtin skills can be enabled or disabled. Create a new skill to customize.')
      )
      return
    }
    setEditing({ ...skill })
    setEditorOpen(true)
  }

  const handleRescan = async () => {
    setRescanning(true)
    try {
      const result = await rescanAgentSkills()
      const foundRoots = result.roots.filter((r) => r.exists).length
      addToast(
        t('Found {{count}} skills from {{dirs}} agent folders', {
          count: result.count,
          dirs: foundRoots,
        })
      )
    } catch (e) {
      addToast((e as Error).message || t('Failed to scan agent skill folders'))
    } finally {
      setRescanning(false)
    }
  }

  const saveEditor = () => {
    if (!editing?.name || !editing.description) {
      addToast(t('Name and description are required'))
      return
    }
    if (!isValidSkillName(editing.name)) {
      addToast(t('Skill name must be lowercase letters, numbers, and hyphens'))
      return
    }
    try {
      upsertSkill({
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
      addToast(t('Skill saved'))
    } catch (e) {
      addToast((e as Error).message)
    }
  }

  const handleImportFile = async (file: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      importSkillMd(text, 'import')
      addToast(t('Skill imported'))
    } catch (e) {
      addToast((e as Error).message || t('Failed to import skill'))
    }
  }

  const handleImportPaste = () => {
    try {
      importSkillMd(importText, 'import')
      setImportOpen(false)
      setImportText('')
      addToast(t('Skill imported'))
    } catch (e) {
      addToast((e as Error).message || t('Failed to import skill'))
    }
  }

  const handleExport = (skillId: string, name: string) => {
    const md = exportSkillMd(skillId)
    if (!md) return
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}-SKILL.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Stack gap="lg" p="md">
      <Flex justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Stack gap={4}>
          <Title order={5}>{t('Skills')}</Title>
          <Text size="sm" c="chatbox-tertiary">
            {t(
              'Reusable procedures the AI can auto-select or you can tag with $skill-name. Desktop also loads skills from Claude, Codex, Cursor, agents, and Grok folders.'
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
                {t('Import SKILL.md')}
              </Button>
            )}
          </FileButton>
          <Button variant="default" onClick={() => setImportOpen(true)}>
            {t('Paste SKILL.md')}
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            {t('New skill')}
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
            {t('Agent skill folders')}
            {agentSkillCount > 0 ? ` · ${agentSkillCount}` : ''}
          </Text>
          <Text size="xs" c="chatbox-tertiary" mb="sm">
            {t('Shared with Claude Code, Codex, Cursor, and other agents. Project folders win over global ones when names collide.')}
          </Text>
          <Stack gap={4}>
            {(agentRoots.length ? agentRoots : AGENT_SKILL_ROOTS.map((r) => ({ path: r.path, origin: r.origin, exists: false }))).map(
              (root) => (
                <Text key={root.path} size="xs" c={root.exists ? 'chatbox-secondary' : 'chatbox-tertiary'} className="font-mono">
                  {root.exists ? '●' : '○'} {root.origin}: {root.path}
                </Text>
              )
            )}
          </Stack>
        </Box>
      )}

      <Stack gap="sm">
        {skills.map((skill) => (
          <Box
            key={skill.id}
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
                  <Text fw={600}>${skill.name}</Text>
                  {skill.displayName && skill.displayName !== skill.name && (
                    <Text size="xs" c="chatbox-tertiary">
                      ({skill.displayName})
                    </Text>
                  )}
                  <Badge size="xs" variant="light">
                    {skill.source === 'agent' && skill.origin ? skill.origin : skill.source}
                  </Badge>
                  {!skill.enabled && (
                    <Badge size="xs" color="gray">
                      {t('Disabled')}
                    </Badge>
                  )}
                </Flex>
                <Text size="sm" c="chatbox-secondary" lineClamp={2}>
                  {skill.description}
                </Text>
                {skill.originPath && (
                  <Text size="xs" c="chatbox-tertiary" lineClamp={1} className="font-mono">
                    {skill.originPath}
                  </Text>
                )}
              </Stack>
              <Flex gap="xs" align="center">
                <Switch
                  checked={skill.enabled}
                  onChange={(e) => setSkillEnabled(skill.id, e.currentTarget.checked)}
                  label={t('Enabled')}
                  labelPosition="left"
                />
                <Button variant="subtle" size="xs" leftSection={<IconDownload size={14} />} onClick={() => handleExport(skill.id, skill.name)}>
                  {t('Export')}
                </Button>
                {skill.source !== 'builtin' && skill.source !== 'agent' && (
                  <>
                    <Button variant="subtle" size="xs" onClick={() => openEdit(skill)}>
                      {t('Edit')}
                    </Button>
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => removeSkill(skill.id)}
                    >
                      {t('Delete')}
                    </Button>
                  </>
                )}
              </Flex>
            </Flex>
          </Box>
        ))}
      </Stack>

      <Modal opened={editorOpen} onClose={() => setEditorOpen(false)} title={editing?.id ? t('Edit skill') : t('New skill')} size="lg">
        <Stack gap="md">
          <TextInput
            label={t('Name')}
            description={t('Lowercase kebab-case, e.g. code-review')}
            value={editing?.name || ''}
            onChange={(e) => setEditing((prev) => ({ ...prev, name: e.currentTarget.value }))}
          />
          <Textarea
            label={t('Description')}
            description={t('What it does and when to use it (used for auto-select)')}
            minRows={2}
            value={editing?.description || ''}
            onChange={(e) => setEditing((prev) => ({ ...prev, description: e.currentTarget.value }))}
          />
          <Textarea
            label={t('Instructions')}
            description={t('Full skill body loaded when activated')}
            minRows={10}
            autosize
            maxRows={20}
            value={editing?.instructions || ''}
            onChange={(e) => setEditing((prev) => ({ ...prev, instructions: e.currentTarget.value }))}
          />
          <Flex justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setEditorOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={saveEditor}>{t('Save')}</Button>
          </Flex>
        </Stack>
      </Modal>

      <Modal opened={importOpen} onClose={() => setImportOpen(false)} title={t('Paste SKILL.md')} size="lg">
        <Stack gap="md">
          <Textarea
            minRows={12}
            autosize
            maxRows={24}
            placeholder={'---\nname: my-skill\ndescription: ...\n---\n\n# Instructions\n...'}
            value={importText}
            onChange={(e) => setImportText(e.currentTarget.value)}
          />
          <Flex justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setImportOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleImportPaste}>{t('Import')}</Button>
          </Flex>
        </Stack>
      </Modal>
    </Stack>
  )
}
