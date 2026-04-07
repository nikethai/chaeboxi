import { Button as MantineButton, Flex, Stack, Switch as MantineSwitch, Text, Tooltip } from '@mantine/core'
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
import platform from '@/platform'
import { useUIStore } from '@/stores/uiStore'
import {
  COPILOT_MAX_STEPS_DEFAULT,
  COPILOT_MAX_STEPS_MAX,
  COPILOT_MAX_STEPS_MIN,
  type CopilotDetail,
} from '../../shared/types'

export const Route = createFileRoute('/copilots')({
  component: Copilots,
})

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
