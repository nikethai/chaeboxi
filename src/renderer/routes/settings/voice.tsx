import { Alert, Select, Switch, Text, TextInput } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsPrefRow } from '@/components/settings/SettingsPrefRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  DEFAULT_VOICE_COPILOT,
  mergeVoiceConfig,
  VOICE_STT_PROVIDERS,
  VOICE_TTS_PROVIDERS,
  type VoiceCopilotConfig,
} from '@shared/voice-copilot'

export const Route = createFileRoute('/settings/voice')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const setSettings = useSettingsStore((s) => s.setSettings)
  const extension = useSettingsStore((s) => s.extension)
  const voice = useMemo(() => mergeVoiceConfig(extension.voiceCopilot), [extension.voiceCopilot])

  const patch = (partial: Partial<VoiceCopilotConfig>) => {
    setSettings({
      extension: {
        ...extension,
        voiceCopilot: { ...voice, ...partial },
      },
    })
  }

  return (
    <SettingsPage>
      <SettingsPageHeader
        title={t('Voice')}
        description={t(
          'Hold-to-talk speech-to-text and optional spoken replies. Uses your OpenAI or Groq keys, or a local Whisper server. No product cloud.'
        )}
      />

      <Alert icon={<IconInfoCircle size={16} />} color="gray" mb="md">
        {t(
          'API keys come from Settings → Model Provider (OpenAI / Groq). Local Whisper needs no key. There is no wake-word listener.'
        )}
      </Alert>

      <SettingsSection title={t('General')}>
        <SettingsCard divided>
          <SettingsPrefRow
            title={t('Enable voice copilot')}
            description={t('Master switch. Shows a hold-to-talk mic on the composer toolbar.')}
            control={
              <Switch
                checked={voice.enabled}
                onChange={(e) => patch({ enabled: e.currentTarget.checked })}
                aria-label={t('Enable voice copilot')}
              />
            }
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('Speech to text')}>
        <SettingsCard divided>
          <SettingsPrefRow
            title={t('STT provider')}
            description={t('OpenAI and Groq use your saved provider keys. Local Whisper is OpenAI-compatible.')}
            control={
              <Select
                size="sm"
                w={180}
                allowDeselect={false}
                data={VOICE_STT_PROVIDERS.map((value) => ({
                  value,
                  label:
                    value === 'local-whisper' ? t('Local Whisper') : value === 'openai' ? 'OpenAI' : 'Groq',
                }))}
                value={voice.sttProvider}
                disabled={!voice.enabled}
                onChange={(value) => {
                  if (value === 'local-whisper' || value === 'openai' || value === 'groq') {
                    patch({ sttProvider: value })
                  }
                }}
                aria-label={t('STT provider')}
              />
            }
          />
          <SettingsPrefRow
            title={t('STT model')}
            description={t('Default whisper-1. Groq remaps whisper-1 to whisper-large-v3.')}
            control={
              <TextInput
                size="sm"
                w={180}
                value={voice.sttModel}
                disabled={!voice.enabled}
                onChange={(e) => patch({ sttModel: e.currentTarget.value })}
                placeholder={DEFAULT_VOICE_COPILOT.sttModel}
                aria-label={t('STT model')}
              />
            }
          />
          {voice.sttProvider === 'local-whisper' && (
            <SettingsPrefRow
              title={t('Local Whisper URL')}
              description={t('OpenAI-compatible transcriptions endpoint on this machine.')}
              control={
                <TextInput
                  size="sm"
                  w={280}
                  value={voice.localWhisperUrl}
                  disabled={!voice.enabled}
                  onChange={(e) => patch({ localWhisperUrl: e.currentTarget.value })}
                  placeholder={DEFAULT_VOICE_COPILOT.localWhisperUrl}
                  aria-label={t('Local Whisper URL')}
                />
              }
            />
          )}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('Text to speech')}>
        <SettingsCard divided>
          <SettingsPrefRow
            title={t('TTS provider')}
            description={t('Off by default. When set, the last assistant reply is spoken after a voice send.')}
            control={
              <Select
                size="sm"
                w={180}
                allowDeselect={false}
                data={VOICE_TTS_PROVIDERS.map((value) => ({
                  value,
                  label: value === 'off' ? t('Off') : value === 'openai' ? 'OpenAI' : 'Groq',
                }))}
                value={voice.ttsProvider}
                disabled={!voice.enabled}
                onChange={(value) => {
                  if (value === 'off' || value === 'openai' || value === 'groq') {
                    patch({ ttsProvider: value })
                  }
                }}
                aria-label={t('TTS provider')}
              />
            }
          />
          <SettingsPrefRow
            title={t('TTS model')}
            control={
              <TextInput
                size="sm"
                w={180}
                value={voice.ttsModel}
                disabled={!voice.enabled || voice.ttsProvider === 'off'}
                onChange={(e) => patch({ ttsModel: e.currentTarget.value })}
                placeholder={DEFAULT_VOICE_COPILOT.ttsModel}
                aria-label={t('TTS model')}
              />
            }
          />
          <SettingsPrefRow
            title={t('TTS voice')}
            control={
              <TextInput
                size="sm"
                w={180}
                value={voice.ttsVoice}
                disabled={!voice.enabled || voice.ttsProvider === 'off'}
                onChange={(e) => patch({ ttsVoice: e.currentTarget.value })}
                placeholder={DEFAULT_VOICE_COPILOT.ttsVoice}
                aria-label={t('TTS voice')}
              />
            }
          />
        </SettingsCard>
      </SettingsSection>

      <Text size="xs" c="dimmed" px={4}>
        {t('Default hold-to-talk shortcut is Alt+Shift+M. Change it in Keyboard Shortcuts.')}
      </Text>
    </SettingsPage>
  )
}
