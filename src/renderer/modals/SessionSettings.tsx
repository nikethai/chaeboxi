import { Session, SessionSettings, createMessage, isChatSession, isPictureSession } from '@/../shared/types'
import { Accordion, AccordionDetails, AccordionSummary } from '@/components/Accordion'
import EditableAvatar from '@/components/EditableAvatar'
import { ImageInStorage, handleImageInputAndSave } from '@/components/Image'
import MaxContextMessageCountSlider from '@/components/MaxContextMessageCountSlider'
import SliderWithInput from '@/components/SliderWithInput'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { trackingEvent } from '@/packages/event'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import * as atoms from '@/stores/atoms'
import { getSession, saveSession } from '@/stores/sessionStorageMutations'
import { getMessageText } from '@/utils/message'
import NiceModal, { muiDialogV5, useModal } from '@ebay/nice-modal-react'
import { Flex, Stack, Text, Tooltip } from '@mantine/core'
import ImageIcon from '@mui/icons-material/Image'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import { useAtomValue } from 'jotai'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as sessionActions from '@/stores/sessionActions'
import ImageStyleSelect from '@/components/ImageStyleSelect'
import ImageCountSlider from '@/components/ImageCountSlider'
import { chatSessionSettings, pictureSessionSettings } from 'src/shared/defaults'
import { IconInfoCircle } from '@tabler/icons-react'

const SessionSettings = NiceModal.create(({ chatConfigDialogSessionId }: { chatConfigDialogSessionId: string }) => {
  const modal = useModal()
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const globalSettings = useAtomValue(atoms.settingsAtom)
  const theme = useTheme()

  const chatConfigDialogSession = getSession(chatConfigDialogSessionId || '')
  const [editingData, setEditingData] = React.useState<Session | null>(chatConfigDialogSession || null)
  useEffect(() => {
    if (!chatConfigDialogSession) {
      setEditingData(null)
    } else {
      setEditingData({
        ...chatConfigDialogSession,
        settings: chatConfigDialogSession.settings ? { ...chatConfigDialogSession.settings } : undefined,
      })
    }
  }, [chatConfigDialogSessionId])

  const [systemPrompt, setSystemPrompt] = React.useState('')
  useEffect(() => {
    if (!chatConfigDialogSession) {
      setSystemPrompt('')
    } else {
      const systemMessage = chatConfigDialogSession.messages.find((m) => m.role === 'system')
      setSystemPrompt(systemMessage ? getMessageText(systemMessage) : '')
    }
  }, [chatConfigDialogSessionId])

  const onReset = (event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    setEditingData((_editingData) =>
      _editingData
        ? {
            ..._editingData,
            settings: {
              ..._editingData.settings,
              maxContextMessageCount: undefined,
              temperature: undefined,
              dalleStyle: pictureSessionSettings().dalleStyle,
              imageGenerateNum: pictureSessionSettings().imageGenerateNum,
            },
          }
        : _editingData
    )
  }

  useEffect(() => {
    if (chatConfigDialogSession) {
      trackingEvent('chat_config_window', { event_category: 'screen_view' })
    }
  }, [chatConfigDialogSessionId])

  const onCancel = () => {
    if (chatConfigDialogSession) {
      setEditingData({
        ...chatConfigDialogSession,
      })
    }
    modal.resolve()
    modal.hide()
  }
  const onSave = () => {
    if (!chatConfigDialogSession || !editingData) {
      return
    }
    if (editingData.name === '') {
      editingData.name = chatConfigDialogSession.name
    }
    editingData.name = editingData.name.trim()
    if (systemPrompt === '') {
      editingData.messages = editingData.messages.filter((m) => m.role !== 'system')
    } else {
      const systemMessage = editingData.messages.find((m) => m.role === 'system')
      if (systemMessage) {
        systemMessage.contentParts = [{ type: 'text', text: systemPrompt.trim() }]
      } else {
        editingData.messages.unshift(createMessage('system', systemPrompt.trim()))
      }
    }
    saveSession(editingData)
    // setChatConfigDialogSessionId(null)
    modal.resolve()
    modal.hide()
  }

  if (!chatConfigDialogSession || !editingData) {
    return null
  }

  return (
    <Dialog
      {...muiDialogV5(modal)}
      onClose={() => {
        modal.resolve()
        modal.hide()
      }}
      fullWidth
    >
      <DialogTitle>{t('Conversation Settings')}</DialogTitle>
      <DialogContent>
        <DialogContentText></DialogContentText>
        <EditableAvatar
          onChange={(event) => {
            if (!event.target.files) {
              return
            }
            const file = event.target.files[0]
            if (file) {
              const key = StorageKeyGenerator.picture(`assistant-avatar:${chatConfigDialogSession?.id}`)
              handleImageInputAndSave(file, key, () => setEditingData({ ...editingData, assistantAvatarKey: key }))
            }
          }}
          onRemove={() => {
            setEditingData({ ...editingData, assistantAvatarKey: undefined })
          }}
          removable={!!editingData.assistantAvatarKey}
          sx={{
            backgroundColor:
              editingData.type === 'picture'
                ? theme.palette.secondary.main
                : editingData.picUrl
                ? theme.palette.background.default
                : theme.palette.primary.main,
          }}
        >
          {editingData.assistantAvatarKey ? (
            <ImageInStorage
              storageKey={editingData.assistantAvatarKey}
              className="object-cover object-center w-full h-full"
            />
          ) : editingData.picUrl ? (
            <img src={editingData.picUrl} className="object-cover object-center w-full h-full" />
          ) : editingData.type === 'picture' ? (
            <ImageIcon
              fontSize="large"
              sx={{
                width: '60px',
                height: '60px',
              }}
            />
          ) : globalSettings.defaultAssistantAvatarKey ? (
            <ImageInStorage
              storageKey={globalSettings.defaultAssistantAvatarKey}
              className="object-cover object-center w-full h-full"
            />
          ) : (
            <SmartToyIcon fontSize="large" />
          )}
        </EditableAvatar>
        <TextField
          autoFocus={!isSmallScreen}
          margin="dense"
          label={t('name')}
          type="text"
          fullWidth
          variant="outlined"
          value={editingData.name}
          onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
        />
        <div className="mt-1">
          <TextField
            margin="dense"
            label={t('Instruction (System Prompt)')}
            placeholder={t('Copilot Prompt Demo') || ''}
            fullWidth
            variant="outlined"
            multiline
            minRows={2}
            maxRows={8}
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
          />
        </div>
        <Accordion defaultExpanded={true} className="mt-2">
          <AccordionSummary aria-controls="panel1a-content">
            <div className="flex flex-row w-full justify-between items-center">
              <Typography>{t('Specific model settings')}</Typography>
            </div>
            {editingData.settings && (
              <Button size="small" variant="text" onClick={onReset}>
                {t('Reset')}
              </Button>
            )}
          </AccordionSummary>
          <AccordionDetails>
            {/* <Text>{JSON.stringify(editingData.settings)}</Text> */}
            {isChatSession(chatConfigDialogSession) && (
              <ChatConfig
                settings={editingData.settings}
                onSettingsChange={(d) =>
                  setEditingData((_data) => {
                    if (_data) {
                      return {
                        ..._data,
                        settings: {
                          ..._data?.settings,
                          ...d,
                        },
                      }
                    } else {
                      return null
                    }
                  })
                }
              />
            )}
            {isPictureSession(chatConfigDialogSession) && (
              <PictureConfig dataEdit={editingData} setDataEdit={setEditingData} />
            )}
          </AccordionDetails>
        </Accordion>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('cancel')}</Button>
        <Button onClick={onSave}>{t('save')}</Button>
      </DialogActions>
    </Dialog>
  )
})

export default SessionSettings

function ChatConfig({
  settings,
  onSettingsChange,
}: {
  settings: Session['settings']
  onSettingsChange: (data: Session['settings']) => void
}) {
  const { t } = useTranslation()

  return (
    <Stack gap="md">
      <MaxContextMessageCountSlider
        value={settings?.maxContextMessageCount ?? chatSessionSettings().maxContextMessageCount!}
        onChange={(v) => onSettingsChange({ maxContextMessageCount: v })}
      />
      <Stack gap="xs">
        <Flex align="center" gap="xs">
          <Text size="sm" fw="600">
            {t('Temperature')}
          </Text>
          <Tooltip
            label={t(
              'Modify the creativity of AI responses; the higher the value, the more random and intriguing the answers become, while a lower value ensures greater stability and reliability.'
            )}
            withArrow={true}
            maw={320}
            className="!whitespace-normal"
            zIndex={3000}
          >
            <IconInfoCircle size={20} className="text-[var(--mantine-color-chatbox-tertiary-text)]" />
          </Tooltip>
        </Flex>

        <SliderWithInput value={settings?.temperature} onChange={(v) => onSettingsChange({ temperature: v })} max={2} />
      </Stack>

      {/* <Stack gap="xs">
        <Text size="sm" fw="600">
          {t('Top P')}
        </Text>

        <SliderWithInput value={settings?.topP ?? 0} onChange={(v) => onSettingsChange({ topP: v })} />
      </Stack> */}
    </Stack>
  )
}

function PictureConfig(props: { dataEdit: Session; setDataEdit: (data: Session) => void }) {
  const { dataEdit, setDataEdit } = props
  const globalSettings = useAtomValue(atoms.settingsAtom)
  const sessionSettings = sessionActions.mergeSettings(globalSettings, dataEdit.settings || {}, dataEdit.type || 'chat')
  const updateSettingsEdit = (updated: Partial<SessionSettings>) => {
    setDataEdit({
      ...dataEdit,
      settings: {
        ...(dataEdit.settings || {}),
        ...updated,
      },
    })
  }
  return (
    <Stack gap="md" className="mt-8">
      <ImageStyleSelect
        value={sessionSettings.dalleStyle || pictureSessionSettings().dalleStyle!}
        onChange={(v) => updateSettingsEdit({ dalleStyle: v })}
        className={sessionSettings.dalleStyle === undefined ? 'opacity-50' : ''}
      />
      <ImageCountSlider
        value={sessionSettings.imageGenerateNum || pictureSessionSettings().imageGenerateNum!}
        onChange={(v) => updateSettingsEdit({ imageGenerateNum: v })}
        className={sessionSettings.imageGenerateNum === undefined ? 'opacity-50' : ''}
      />
    </Stack>
  )
}
