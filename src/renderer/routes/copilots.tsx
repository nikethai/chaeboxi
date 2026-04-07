import { Button as MantineButton, Checkbox, Flex, MultiSelect, Radio, Select, Stack, Switch as MantineSwitch, Text, Tooltip } from '@mantine/core'
import EditIcon from '@mui/icons-material/Edit'
import MoreHorizOutlinedIcon from '@mui/icons-material/MoreHorizOutlined'
import StarIcon from '@mui/icons-material/Star'
import StarOutlineIcon from '@mui/icons-material/StarOutline'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import DeleteIcon from '@mui/icons-material/Delete'
import { IconInfoCircle, IconPlus } from '@tabler/icons-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { ConfirmDeleteMenuItem } from '@/components/common/ConfirmDeleteButton'
import Page from '@/components/layout/Page'
import LazyNumberInput from '@/components/common/LazyNumberInput'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import SliderWithInput from '@/components/common/SliderWithInput'
import StyledMenu from '@/components/StyledMenu'
import { useMyCopilots, useRemoteCopilots } from '@/hooks/useCopilots'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { trackingEvent } from '@/packages/event'
import * as remote from '@/packages/remote'
import { CopilotHookSchema } from '@/packages/copilot-hooks'
import platform from '@/platform'
import { useUIStore } from '@/stores/uiStore'
import {
  COPILOT_MAX_STEPS_DEFAULT,
  COPILOT_MAX_STEPS_MAX,
  COPILOT_MAX_STEPS_MIN,
  type CopilotDetail,
  type CopilotHook,
  type CopilotToolAccess,
} from '../../shared/types'

export const Route = createFileRoute('/copilots')({
  component: Copilots,
})

/** Built-in tool names available for tool access configuration. */
const BUILT_IN_TOOLS = [
  { value: 'web_search', label: 'Web Search' },
  { value: 'parse_link', label: 'Parse Link' },
  { value: 'file_read', label: 'File Read' },
  { value: 'file_write', label: 'File Write' },
  { value: 'query_knowledge_base', label: 'Knowledge Base Query' },
  { value: 'upload_file', label: 'Upload File' },
  { value: 'task_create', label: 'Task Create' },
  { value: 'task_update', label: 'Task Update' },
  { value: 'task_list', label: 'Task List' },
  { value: 'task_get', label: 'Task Get' },
  { value: 'task_delete', label: 'Task Delete' },
]

/** Available hook types for copilot configuration. */
const HOOK_TYPES = [
  { value: 'inject-context', label: 'Inject Context' },
  { value: 'inject-datetime', label: 'Inject DateTime' },
  { value: 'inject-system-info', label: 'Inject System Info' },
  { value: 'web-fetch', label: 'Web Fetch' },
  { value: 'validate-format', label: 'Validate Format' },
]

const FORMAT_OPTIONS = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
  { value: 'code', label: 'Code' },
]

function Copilots() {
  const [open, setOpen] = useState(false)
  const showCopilotsInNewSession = useUIStore((s) => s.showCopilotsInNewSession)
  const setShowCopilotsInNewSession = useUIStore((s) => s.setShowCopilotsInNewSession)
  const navigate = useNavigate()

  const { t } = useTranslation()

  const store = useMyCopilots()
  const { copilots: remoteCopilots } = useRemoteCopilots()

  const handleClose = () => {
    setOpen(false)
  }

  const selectCopilot = (detail: CopilotDetail) => {
    const newDetail = { ...detail, usedCount: (detail.usedCount || 0) + 1 }
    if (newDetail.shared) {
      remote.recordCopilotShare(newDetail)
    }
    store.addOrUpdate(newDetail)

    navigate({
      to: '/',
      search: {
        copilotId: detail.id,
      },
    })
    handleClose()
  }

  const [copilotEdit, setCopilotEdit] = useState<CopilotDetail | null>(null)
  useEffect(() => {
    if (!open) {
      setCopilotEdit(null)
    } else {
      trackingEvent('copilot_window', { event_category: 'screen_view' })
    }
  }, [open])

  const list = [
    ...store.copilots.filter((item) => item.starred).sort((a, b) => b.usedCount - a.usedCount),
    ...store.copilots.filter((item) => !item.starred).sort((a, b) => b.usedCount - a.usedCount),
  ]

  return (
    <Page title={t('My Copilots')}>
      <div className="p-4 max-w-4xl mx-auto">
        {copilotEdit ? (
          <CopilotForm
            copilotDetail={copilotEdit}
            close={() => {
              setCopilotEdit(null)
            }}
            save={(detail) => {
              store.addOrUpdate(detail)
              setCopilotEdit(null)
            }}
          />
        ) : (
          <>
            {/* Setting Section */}
            <Box sx={{ mb: 3 }}>
              <Text size="md" fw={700} mb={2} c="chatbox-primary">
                {t('Settings')}
              </Text>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MantineSwitch
                  checked={showCopilotsInNewSession}
                  onChange={(event) => setShowCopilotsInNewSession(event.currentTarget.checked)}
                  label={t('Show Copilots in New Session')}
                />
              </Box>
            </Box>

            {/* My Copilots Section */}
            <Box sx={{ mb: 4 }}>
              <Text size="md" fw={700} mb={2} c="chatbox-primary">
                {t('My Copilots')}
              </Text>

              <MantineButton
                variant="light"
                color="blue"
                leftSection={<ScalableIcon icon={IconPlus} size={20} />}
                mb={16}
                onClick={() => {
                  getEmptyCopilot().then(setCopilotEdit)
                }}
              >
                {t('Create New Copilot')}
              </MantineButton>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 1.5,
                }}
              >
                {list.map((item, ix) => (
                  <MiniItem
                    key={`${item.id}_${ix}`}
                    mode="local"
                    detail={item}
                    canDelete={!item.builtIn}
                    selectMe={() => selectCopilot(item)}
                    switchStarred={() => {
                      store.addOrUpdate({
                        ...item,
                        starred: !item.starred,
                      })
                    }}
                    editMe={() => {
                      setCopilotEdit(item)
                    }}
                    deleteMe={() => {
                      store.remove(item.id)
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Chatbox Featured Section */}
            <Box>
              <Text size="md" fw={700} mb={2} c="chatbox-primary">
                {t('Chatbox Featured')}
              </Text>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 1.5,
                }}
              >
                {remoteCopilots?.map((item, ix) => (
                  <MiniItem key={`${item.id}_${ix}`} mode="remote" detail={item} selectMe={() => selectCopilot(item)} />
                ))}
              </Box>
            </Box>
          </>
        )}
      </div>
    </Page>
  )
}

type MiniItemProps =
  | {
      mode: 'local'
      detail: CopilotDetail
      canDelete?: boolean
      selectMe(): void
      switchStarred(): void
      editMe(): void
      deleteMe(): void
    }
  | {
      mode: 'remote'
      detail: CopilotDetail
      selectMe(): void
    }

function MiniItem(props: MiniItemProps) {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const selectCopilot = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    if (open) {
      return
    }
    props.selectMe()
  }
  const openMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    event.preventDefault()
    setAnchorEl(event.currentTarget)
  }
  const closeMenu = () => {
    setAnchorEl(null)
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '10px 16px',
        height: '49px',
        cursor: 'pointer',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#dee2e6'),
        backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#fff'),
        transition: 'all 0.2s',
        '.edit-icon': {
          opacity: 0,
        },
        '&:hover': {
          borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#adb5bd'),
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8f9fa'),
        },
        '&:hover .edit-icon': {
          opacity: 1,
        },
      }}
      onClick={selectCopilot}
    >
      <Avatar
        sx={{
          width: '28px',
          height: '28px',
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e9ecef'),
          fontSize: '16px',
        }}
        src={props.detail.emojiAvatar ? undefined : props.detail.picUrl}
      >
        {props.detail.emojiAvatar || undefined}
      </Avatar>
      <Box
        sx={{
          marginLeft: '12px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <Typography
          variant="body1"
          noWrap
          sx={{
            fontSize: '14px',
            fontWeight: 400,
            color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : '#212529'),
          }}
        >
          {props.detail.name}
        </Typography>
      </Box>

      {props.mode === 'local' && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: 'auto',
            }}
          >
            <IconButton
              onClick={openMenu}
              sx={{
                padding: '4px',
                color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : '#495057'),
              }}
            >
              {props.detail.starred ? (
                <StarIcon fontSize="small" sx={{ color: '#228be6' }} />
              ) : (
                <MoreHorizOutlinedIcon className="edit-icon" fontSize="small" />
              )}
            </IconButton>
          </Box>
          <StyledMenu
            MenuListProps={{
              'aria-labelledby': 'long-button',
            }}
            anchorEl={anchorEl}
            open={open}
            onClose={closeMenu}
          >
            <MenuItem
              key={'star'}
              onClick={() => {
                props.switchStarred()
                closeMenu()
              }}
              disableRipple
            >
              {props.detail.starred ? (
                <>
                  <StarOutlineIcon fontSize="small" />
                  {t('unstar')}
                </>
              ) : (
                <>
                  <StarIcon fontSize="small" />
                  {t('star')}
                </>
              )}
            </MenuItem>

            <MenuItem
              key={'edit'}
              onClick={() => {
                props.editMe()
                closeMenu()
              }}
              disableRipple
            >
              <EditIcon />
              {t('edit')}
            </MenuItem>

            <Divider sx={{ my: 0.5 }} />

            {props.canDelete !== false && (
              <ConfirmDeleteMenuItem
                onDelete={() => {
                  setAnchorEl(null)
                  closeMenu()
                  props.deleteMe()
                }}
              />
            )}
          </StyledMenu>
        </>
      )}
    </Box>
  )
}

interface CopilotFormProps {
  copilotDetail: CopilotDetail
  close(): void
  save(copilotDetail: CopilotDetail): void
  // premiumActivated: boolean
  // openPremiumPage(): void
}

function CopilotForm(props: CopilotFormProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const isSmallScreen = useIsSmallScreen()
  const [copilotEdit, setCopilotEdit] = useState<CopilotDetail>(props.copilotDetail)
  useEffect(() => {
    setCopilotEdit(props.copilotDetail)
  }, [props.copilotDetail])
  const [helperTexts, setHelperTexts] = useState({
    name: <></>,
    prompt: <></>,
  })
  const inputHandler = (field: keyof CopilotDetail) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setHelperTexts({ name: <></>, prompt: <></> })
      setCopilotEdit({ ...copilotEdit, [field]: event.target.value })
    }
  }
  const save = () => {
    copilotEdit.name = copilotEdit.name.trim()
    copilotEdit.prompt = copilotEdit.prompt.trim()
    if (copilotEdit.picUrl) {
      copilotEdit.picUrl = copilotEdit.picUrl.trim()
    }
    if (copilotEdit.emojiAvatar) {
      copilotEdit.emojiAvatar = copilotEdit.emojiAvatar.trim()
    }
    if (copilotEdit.name.length === 0) {
      setHelperTexts({
        ...helperTexts,
        name: <p style={{ color: 'red' }}>{t('cannot be empty')}</p>,
      })
      return
    }
    if (copilotEdit.prompt.length === 0) {
      setHelperTexts({
        ...helperTexts,
        prompt: <p style={{ color: 'red' }}>{t('cannot be empty')}</p>,
      })
      return
    }
    props.save(copilotEdit)
    trackingEvent('create_copilot', { event_category: 'user' })
  }

  const updateModelSettings = (patch: Partial<CopilotDetail['modelSettings'] & object>) => {
    setCopilotEdit((prev) => ({
      ...prev,
      modelSettings: {
        ...prev.modelSettings,
        ...patch,
      },
    }))
  }

  return (
    <Box
      sx={{
        marginBottom: '20px',
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[50],
        padding: '8px',
      }}
    >
      <TextField
        autoFocus={!isSmallScreen}
        margin="dense"
        label={t('Copilot Name')}
        fullWidth
        variant="outlined"
        placeholder={t('My Assistant') || ''}
        value={copilotEdit.name}
        onChange={inputHandler('name')}
        helperText={helperTexts.name}
      />
      <TextField
        margin="dense"
        label={t('Copilot Prompt')}
        placeholder={t('Copilot Prompt Demo') || ''}
        fullWidth
        variant="outlined"
        multiline
        minRows={4}
        maxRows={10}
        value={copilotEdit.prompt}
        onChange={inputHandler('prompt')}
        helperText={helperTexts.prompt}
      />

      {/* Avatar section: emoji avatar + URL */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 1 }}>
        <TextField
          margin="dense"
          label={t('Emoji Avatar')}
          placeholder="🔬"
          variant="outlined"
          sx={{ width: '120px', flexShrink: 0 }}
          value={copilotEdit.emojiAvatar ?? ''}
          onChange={inputHandler('emojiAvatar')}
          inputProps={{ maxLength: 4 }}
        />
        <TextField
          margin="dense"
          label={t('Copilot Avatar URL')}
          placeholder="http://xxxxx/xxx.png"
          fullWidth
          variant="outlined"
          value={copilotEdit.picUrl ?? ''}
          onChange={inputHandler('picUrl')}
          helperText={copilotEdit.emojiAvatar ? t('Emoji avatar takes priority over URL') : undefined}
        />
      </Box>

      {/* Model Settings section */}
      <Box
        sx={{
          mt: 2,
          mb: 1,
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#dee2e6',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#dee2e6',
          }}
        >
          <Typography variant="body2" fontWeight={700}>
            {t('Model Settings Override')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('Leave blank to use session defaults')}
          </Typography>
        </Box>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack gap="md">
            {/* Temperature */}
            <Stack gap="xs">
              <Flex align="center" gap="xs">
                <Text size="sm" fw="600">
                  {t('Temperature')}
                </Text>
                <Tooltip
                  label={t(
                    'Modify the creativity of AI responses; the higher the value, the more random and intriguing the answers become, while a lower value ensures greater stability and reliability.'
                  )}
                  withArrow
                  maw={320}
                  className="!whitespace-normal"
                  zIndex={3000}
                  events={{ hover: true, focus: true, touch: true }}
                >
                  <ScalableIcon icon={IconInfoCircle} size={18} className="text-chatbox-tint-tertiary" />
                </Tooltip>
              </Flex>
              <SliderWithInput
                value={copilotEdit.modelSettings?.temperature}
                onChange={(v) => updateModelSettings({ temperature: v })}
                max={2}
                step={0.1}
              />
            </Stack>

            {/* Top P */}
            <Stack gap="xs">
              <Flex align="center" gap="xs">
                <Text size="sm" fw="600">
                  Top P
                </Text>
                <Tooltip
                  label={t(
                    'The topP parameter controls the diversity of AI responses: lower values make the output more focused and predictable, while higher values allow for more varied and creative replies.'
                  )}
                  withArrow
                  maw={320}
                  className="!whitespace-normal"
                  zIndex={3000}
                  events={{ hover: true, focus: true, touch: true }}
                >
                  <ScalableIcon icon={IconInfoCircle} size={18} className="text-chatbox-tint-tertiary" />
                </Tooltip>
              </Flex>
              <SliderWithInput
                value={copilotEdit.modelSettings?.topP}
                onChange={(v) => updateModelSettings({ topP: v })}
                max={1}
                step={0.05}
              />
            </Stack>

            {/* Max Tokens */}
            <Flex justify="space-between" align="center">
              <Flex align="center" gap="xs">
                <Text size="sm" fw="600">
                  {t('Max Output Tokens')}
                </Text>
                <Tooltip
                  label={t(
                    'Set the maximum number of tokens for model output. Please set it within the acceptable range of the model, otherwise errors may occur.'
                  )}
                  withArrow
                  maw={320}
                  className="!whitespace-normal"
                  zIndex={3000}
                  events={{ hover: true, focus: true, touch: true }}
                >
                  <ScalableIcon icon={IconInfoCircle} size={18} className="text-chatbox-tint-tertiary" />
                </Tooltip>
              </Flex>
              <LazyNumberInput
                width={96}
                value={copilotEdit.modelSettings?.maxTokens}
                onChange={(v) => updateModelSettings({ maxTokens: typeof v === 'number' ? v : undefined })}
                min={0}
                step={1024}
                allowDecimal={false}
                placeholder={t('Not set') || ''}
              />
            </Flex>
          </Stack>
        </Box>
      </Box>

      {/* Agent Settings section */}
      <Box
        sx={{
          mt: 2,
          mb: 1,
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#dee2e6',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#dee2e6',
          }}
        >
          <Typography variant="body2" fontWeight={700}>
            {t('Agent Settings')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('Configure agent mode behavior')}
          </Typography>
        </Box>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack gap="xs">
            <Flex align="center" gap="xs">
              <Text size="sm" fw="600">
                {t('Max Steps')}
              </Text>
              <Tooltip
                label={t(
                  'Maximum number of autonomous tool-use steps the agent can take per message. Higher values allow more complex tasks but use more tokens.'
                )}
                withArrow
                maw={320}
                className="!whitespace-normal"
                zIndex={3000}
                events={{ hover: true, focus: true, touch: true }}
              >
                <ScalableIcon icon={IconInfoCircle} size={18} className="text-chatbox-tint-tertiary" />
              </Tooltip>
            </Flex>
            <SliderWithInput
              value={copilotEdit.maxSteps ?? COPILOT_MAX_STEPS_DEFAULT}
              onChange={(v) =>
                setCopilotEdit((prev) => ({
                  ...prev,
                  maxSteps: v ?? COPILOT_MAX_STEPS_DEFAULT,
                }))
              }
              min={COPILOT_MAX_STEPS_MIN}
              max={COPILOT_MAX_STEPS_MAX}
              step={1}
            />
          </Stack>
        </Box>
      </Box>

      {/* Tool Access Settings section */}
      <Box
        sx={{
          mt: 2,
          mb: 1,
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#dee2e6',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#dee2e6',
          }}
        >
          <Typography variant="body2" fontWeight={700}>
            {t('Tool Access')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('Control which tools this copilot can use')}
          </Typography>
        </Box>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack gap="md">
            {/* Mode selection */}
            <Stack gap="xs">
              <Text size="sm" fw="600">
                {t('Access Mode')}
              </Text>
              <Radio.Group
                value={copilotEdit.toolAccess?.mode ?? 'allowlist'}
                onChange={(value) =>
                  setCopilotEdit((prev) => ({
                    ...prev,
                    toolAccess: {
                      mode: value as 'allowlist' | 'denylist',
                      tools: prev.toolAccess?.tools ?? [],
                      includeMcp: prev.toolAccess?.includeMcp ?? true,
                    },
                  }))
                }
              >
                <Stack gap="xs" mt="xs">
                  <Radio value="allowlist" label={t('Allowlist - only use selected tools')} />
                  <Radio value="denylist" label={t('Denylist - use all except selected tools')} />
                </Stack>
              </Radio.Group>
            </Stack>

            {/* Include MCP tools checkbox */}
            <Checkbox
              checked={copilotEdit.toolAccess?.includeMcp ?? true}
              onChange={(event) =>
                setCopilotEdit((prev) => ({
                  ...prev,
                  toolAccess: {
                    mode: prev.toolAccess?.mode ?? 'allowlist',
                    tools: prev.toolAccess?.tools ?? [],
                    includeMcp: event.currentTarget.checked,
                  },
                }))
              }
              label={t('Include MCP tools')}
            />

            {/* Tool selection */}
            <Stack gap="xs">
              <Text size="sm" fw="600">
                {t('Select Tools')}
              </Text>
              <MultiSelect
                data={BUILT_IN_TOOLS}
                value={copilotEdit.toolAccess?.tools ?? []}
                onChange={(value) =>
                  setCopilotEdit((prev) => ({
                    ...prev,
                    toolAccess: {
                      mode: prev.toolAccess?.mode ?? 'allowlist',
                      tools: value,
                      includeMcp: prev.toolAccess?.includeMcp ?? true,
                    },
                  }))
                }
                placeholder={t('Select tools...')}
                searchable
                clearable
              />
              <Text size="xs" c="dimmed">
                {t('For MCP tools, enter tool names manually (e.g., mcp__server__tool_name)')}
              </Text>
            </Stack>
          </Stack>
        </Box>
      </Box>

      {/* Hooks Settings section */}
      <Box
        sx={{
          mt: 2,
          mb: 1,
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#dee2e6',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#dee2e6',
          }}
        >
          <Typography variant="body2" fontWeight={700}>
            {t('Hooks')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('Configure pre-turn and post-turn hook actions')}
          </Typography>
        </Box>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack gap="md">
            {/* Pre-turn hooks */}
            <Stack gap="xs">
              <Text size="sm" fw="600">
                {t('Pre-Turn Hooks')}
              </Text>
              <Text size="xs" c="dimmed">
                {t('Run before each generation to inject context or fetch data')}
              </Text>
              <HookList
                hooks={copilotEdit.hooks?.preTurn ?? []}
                onChange={(hooks) =>
                  setCopilotEdit((prev) => ({
                    ...prev,
                    hooks: { ...prev.hooks, preTurn: hooks },
                  }))
                }
              />
            </Stack>

            {/* Post-turn hooks */}
            <Stack gap="xs">
              <Text size="sm" fw="600">
                {t('Post-Turn Hooks')}
              </Text>
              <Text size="xs" c="dimmed">
                {t('Run after each generation to validate or process output')}
              </Text>
              <HookList
                hooks={copilotEdit.hooks?.postTurn ?? []}
                onChange={(hooks) =>
                  setCopilotEdit((prev) => ({
                    ...prev,
                    hooks: { ...prev.hooks, postTurn: hooks },
                  }))
                }
              />
            </Stack>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
        <FormGroup row>
          <FormControlLabel
            control={<Switch />}
            label={t('Share with Chatbox')}
            checked={copilotEdit.shared}
            onChange={(_e, checked) => setCopilotEdit({ ...copilotEdit, shared: checked })}
          />
        </FormGroup>
        <ButtonGroup>
          <Button variant="outlined" onClick={() => props.close()}>
            {t('cancel')}
          </Button>
          <Button variant="contained" onClick={save}>
            {t('save')}
          </Button>
        </ButtonGroup>
      </Box>
    </Box>
  )
}

/**
 * Hook list editor component
 */
interface HookListProps {
  hooks: CopilotHook[]
  onChange(hooks: CopilotHook[]): void
}

function HookList({ hooks, onChange }: HookListProps) {
  const { t } = useTranslation()

  const addHook = () => {
    const newHook: CopilotHook = { type: 'inject-context', content: '' }
    onChange([...hooks, newHook])
  }

  const updateHook = (index: number, updates: Partial<CopilotHook>) => {
    const updated = hooks.map((h, i) => (i === index ? { ...h, ...updates } : h))
    onChange(updated)
  }

  const removeHook = (index: number) => {
    onChange(hooks.filter((_, i) => i !== index))
  }

  return (
    <Stack gap="xs">
      {hooks.map((hook, index) => (
        <HookEditor
          key={index}
          hook={hook}
          onChange={(updates) => updateHook(index, updates)}
          onRemove={() => removeHook(index)}
        />
      ))}
      <MantineButton
        variant="light"
        color="blue"
        size="xs"
        leftSection={<ScalableIcon icon={IconPlus} size={14} />}
        onClick={addHook}
      >
        {t('Add Hook')}
      </MantineButton>
    </Stack>
  )
}

/**
 * Single hook editor component
 */
interface HookEditorProps {
  hook: CopilotHook
  onChange(updates: Partial<CopilotHook>): void
  onRemove(): void
}

function HookEditor({ hook, onChange, onRemove }: HookEditorProps) {
  const { t } = useTranslation()
  const theme = useTheme()

  const handleTypeChange = (type: string) => {
    // Reset hook data when type changes
    switch (type) {
      case 'inject-context':
        onChange({ type: 'inject-context' as const, content: '' })
        break
      case 'inject-datetime':
        onChange({ type: 'inject-datetime' as const })
        break
      case 'inject-system-info':
        onChange({ type: 'inject-system-info' as const })
        break
      case 'web-fetch':
        onChange({ type: 'web-fetch' as const, url: '', extractAs: 'text' as const })
        break
      case 'validate-format':
        onChange({ type: 'validate-format' as const, format: 'markdown' as const })
        break
      default:
        break
    }
  }

  return (
    <Box
      sx={{
        p: 1.5,
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#dee2e6',
        borderRadius: '6px',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : '#f8f9fa',
      }}
    >
      <Flex gap="xs" align="flex-start">
        <Select
          size="xs"
          style={{ width: 140 }}
          data={HOOK_TYPES}
          value={hook.type}
          onChange={(value) => value && handleTypeChange(value)}
        />
        <IconButton size="small" onClick={onRemove} sx={{ mt: 0.5 }}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Flex>

      {hook.type === 'inject-context' && (
        <TextField
          size="small"
          fullWidth
          placeholder={t('Context content to inject...')}
          value={(hook as { content: string }).content}
          onChange={(e) => onChange({ content: e.target.value })}
          multiline
          minRows={2}
          maxRows={4}
          sx={{ mt: 1 }}
        />
      )}

      {hook.type === 'web-fetch' && (
        <Stack gap="xs" mt={1}>
          <TextField
            size="small"
            fullWidth
            placeholder={t('URL to fetch...')}
            value={(hook as { url: string }).url}
            onChange={(e) => onChange({ url: e.target.value })}
          />
          <Select
            size="xs"
            label={t('Extract as')}
            data={[
              { value: 'text', label: 'Text' },
              { value: 'json', label: 'JSON' },
            ]}
            value={(hook as { extractAs: string }).extractAs}
            onChange={(value) => value && onChange({ extractAs: value as 'text' | 'json' })}
          />
        </Stack>
      )}

      {hook.type === 'validate-format' && (
        <Select
          size="xs"
          label={t('Format')}
          data={FORMAT_OPTIONS}
          value={(hook as { format: string }).format}
          onChange={(value) => value && onChange({ format: value as 'markdown' | 'json' | 'code' })}
          mt={1}
        />
      )}

      {hook.type === 'inject-datetime' && (
        <Typography variant="caption" c="dimmed" sx={{ mt: 1 }}>
          {t('Injects current datetime (ISO 8601 format)')}
        </Typography>
      )}

      {hook.type === 'inject-system-info' && (
        <Typography variant="caption" c="dimmed" sx={{ mt: 1 }}>
          {t('Injects OS and platform information')}
        </Typography>
      )}
    </Box>
  )
}

export async function getEmptyCopilot(): Promise<CopilotDetail> {
  const conf = await platform.getConfig()
  return {
    id: `${conf.uuid}:${uuidv4()}`,
    name: '',
    picUrl: '',
    prompt: '',
    starred: false,
    usedCount: 0,
    shared: true,
  }
}
