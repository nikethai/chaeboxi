import {
  Badge,
  Button,
  Flex,
  NumberInput,
  PasswordInput,
  Progress,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { IconCheck, IconDownload, IconExternalLink, IconRefresh } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { ofetch } from 'ofetch'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsPrefRow } from '@/components/settings/SettingsPrefRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { getOS } from '@/packages/navigator'
import {
  detectYtDlp,
  installerLabel,
  installYtDlp,
  type YtDlpDetectResult,
} from '@/packages/video-url/desktop/yt-dlp-install'
import { assertSafeHttpUrl, buildCapabilitySummary, type VideoUrlSettings } from '@/packages/video-url'
import platform from '@/platform'
import { settingsStore, useSettingsStore } from '@/stores/settingsStore'

export const Route = createFileRoute('/settings/video-url')({
  component: RouteComponent,
})

const defaultVideoUrl: VideoUrlSettings = {
  enabled: true,
  provider: 'none',
  apiKey: '',
  customEndpoint: '',
  sttProvider: 'none',
  sttApiKey: '',
  preferCaptions: true,
  maxTranscriptChars: 12_000,
  maxSttDurationSec: 1800,
  desktopExtractorEnabled: false,
  desktopExtractorPath: '',
}

const YT_DLP_GUIDE_URL = 'https://github.com/yt-dlp/yt-dlp/wiki/Installation'
const BREW_URL = 'https://brew.sh'

function getYtDlpFallbackHint(): string {
  const os = getOS()
  if (os === 'Mac') {
    return 'On Mac we install via Homebrew when available. If Homebrew is missing, install it first, then try again.'
  }
  if (os === 'Windows') {
    return 'On Windows we install via winget when available. You can also follow the full install guide.'
  }
  return 'On Linux we try pipx. You can also install yt-dlp with your package manager and leave the path empty if it is on PATH.'
}

export function RouteComponent() {
  const { t } = useTranslation()
  const setSettings = useSettingsStore((state) => state.setSettings)
  const extension = useSettingsStore((state) => state.extension)
  const videoUrl = useMemo<VideoUrlSettings>(
    () => ({
      ...defaultVideoUrl,
      ...(extension.videoUrl as Partial<VideoUrlSettings> | undefined),
    }),
    [extension.videoUrl]
  )

  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<boolean | undefined>()

  const [ytDetecting, setYtDetecting] = useState(false)
  const [ytInstalling, setYtInstalling] = useState(false)
  const [ytPhase, setYtPhase] = useState<string | null>(null)
  const [ytDetect, setYtDetect] = useState<YtDlpDetectResult | null>(null)
  const [ytInstallLog, setYtInstallLog] = useState<string | null>(null)

  const capability = useMemo(() => buildCapabilitySummary(videoUrl), [videoUrl])
  const fallbackHint = useMemo(() => getYtDlpFallbackHint(), [])

  const patch = (partial: Partial<VideoUrlSettings>) => {
    setSettings({
      extension: {
        ...extension,
        videoUrl: {
          ...videoUrl,
          ...partial,
        },
      },
    })
  }

  const refreshYtDlp = useCallback(async (opts?: { silent?: boolean; fillPath?: boolean }) => {
    if (platform.type !== 'desktop' || !platform.executeCommand) {
      setYtDetect({
        installed: false,
        installer: 'none',
        installerAvailable: false,
        error: 'Desktop only',
      })
      return
    }
    setYtDetecting(true)
    if (!opts?.silent) setYtInstallLog(null)
    try {
      const currentPath =
        (settingsStore.getState().extension?.videoUrl as Partial<VideoUrlSettings> | undefined)
          ?.desktopExtractorPath ||
        videoUrl.desktopExtractorPath ||
        ''
      const result = await detectYtDlp({ customPath: currentPath })
      setYtDetect(result)
      if (opts?.fillPath && result.installed && result.path && !String(currentPath).trim()) {
        setSettings((state) => {
          const prev = (state.extension?.videoUrl || {}) as Partial<VideoUrlSettings>
          state.extension = {
            ...state.extension,
            videoUrl: {
              ...defaultVideoUrl,
              ...prev,
              desktopExtractorPath: result.path,
            },
          }
        })
      }
    } catch (err) {
      setYtDetect({
        installed: false,
        installer: 'none',
        installerAvailable: false,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setYtDetecting(false)
    }
  }, [setSettings, videoUrl.desktopExtractorPath])

  // Auto-detect when the desktop extractor section is enabled.
  useEffect(() => {
    if (platform.type !== 'desktop') return
    if (!videoUrl.desktopExtractorEnabled) return
    void refreshYtDlp({ silent: true })
    // Intentionally only when the section is toggled on — manual Check for re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl.desktopExtractorEnabled])

  const handleInstallYtDlp = async () => {
    if (platform.type !== 'desktop' || !platform.executeCommand) {
      toast.error(t('Install is only available in the desktop app.'))
      return
    }
    setYtInstalling(true)
    setYtPhase(t('Starting…'))
    setYtInstallLog(null)
    try {
      const result = await installYtDlp({
        onPhase: (phase) => setYtPhase(t(phase)),
      })
      setYtInstallLog(result.log || null)
      if (result.ok) {
        setYtDetect({
          installed: true,
          path: result.path,
          version: result.version,
          installer: ytDetect?.installer || 'brew',
          installerAvailable: true,
        })
        if (result.path && !videoUrl.desktopExtractorPath?.trim()) {
          setSettings((state) => {
            const prev = (state.extension?.videoUrl || {}) as Partial<VideoUrlSettings>
            state.extension = {
              ...state.extension,
              videoUrl: {
                ...defaultVideoUrl,
                ...prev,
                desktopExtractorPath: result.path,
              },
            }
          })
        }
        toast.success(
          result.version
            ? t('yt-dlp is ready ({{version}})', { version: result.version })
            : t('yt-dlp is installed and ready')
        )
      } else {
        toast.error(result.error || t('Install failed'))
        await refreshYtDlp({ silent: true })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setYtInstallLog(message)
      toast.error(message)
    } finally {
      setYtInstalling(false)
      setYtPhase(null)
    }
  }

  const testProvider = async () => {
    setChecking(true)
    setCheckResult(undefined)
    try {
      if (videoUrl.provider === 'supadata') {
        if (!videoUrl.apiKey?.trim()) {
          setCheckResult(false)
          return
        }
        await ofetch('https://api.supadata.ai/v1/transcript', {
          method: 'GET',
          query: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', text: 'true' },
          headers: { 'x-api-key': videoUrl.apiKey.trim() },
          timeout: 20_000,
        })
        setCheckResult(true)
      } else if (videoUrl.provider === 'custom') {
        if (!videoUrl.customEndpoint?.trim()) {
          setCheckResult(false)
          return
        }
        const safeEndpoint = assertSafeHttpUrl(videoUrl.customEndpoint.trim())
        if (!safeEndpoint.ok) {
          setCheckResult(false)
          return
        }
        await ofetch(safeEndpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(videoUrl.apiKey?.trim() ? { Authorization: `Bearer ${videoUrl.apiKey.trim()}` } : {}),
          },
          body: {
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            mode: 'metadata',
          },
          timeout: 20_000,
        })
        setCheckResult(true)
      } else {
        setCheckResult(true)
      }
    } catch {
      setCheckResult(false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <SettingsPage>
      <SettingsPageHeader
        title={t('Video URL')}
        description={t('Let the assistant read public YouTube, Vimeo, TikTok, and Facebook video links.')}
      />

      <SettingsSection title={t('General')}>
        <SettingsCard divided>
          <SettingsPrefRow
            title={t('Enable video URL tool')}
            description={t(
              'Allow agents to read public YouTube, Vimeo, TikTok, and Facebook links (metadata + transcript).'
            )}
            control={
              <Switch checked={videoUrl.enabled} onChange={(e) => patch({ enabled: e.currentTarget.checked })} />
            }
          />

          <SettingsPrefRow
            title={t('Prefer captions')}
            description={t('Use free platform captions before paid providers or STT when available.')}
            control={
              <Switch
                checked={videoUrl.preferCaptions}
                onChange={(e) => patch({ preferCaptions: e.currentTarget.checked })}
              />
            }
          />

          <SettingsPrefRow
            title={t('Max transcript characters')}
            description={t('Default truncate budget for agent context.')}
            control={
              <NumberInput
                min={500}
                max={50_000}
                step={500}
                value={videoUrl.maxTranscriptChars}
                onChange={(v) => patch({ maxTranscriptChars: typeof v === 'number' ? v : 12_000 })}
                w={140}
              />
            }
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title={t('Multi-platform provider (BYOK)')}
        description={t(
          'Required for reliable TikTok/Facebook transcripts. Optional backup for YouTube/Vimeo. Keys stay on your device.'
        )}
      >
        <SettingsCard>
          <Stack gap="md">
            <SettingsPrefRow
              title={t('Provider')}
              control={
                <Select
                  data={[
                    { value: 'none', label: t('None (free captions only)') },
                    { value: 'supadata', label: 'Supadata' },
                    { value: 'custom', label: t('Custom HTTP') },
                  ]}
                  value={videoUrl.provider}
                  onChange={(v) => patch({ provider: (v as VideoUrlSettings['provider']) || 'none' })}
                  w={220}
                />
              }
            />

            {(videoUrl.provider === 'supadata' || videoUrl.provider === 'custom') && (
              <SettingsPrefRow
                title={t('API key')}
                control={
                  <PasswordInput
                    value={videoUrl.apiKey || ''}
                    onChange={(e) => patch({ apiKey: e.currentTarget.value })}
                    placeholder={t('Optional for some custom endpoints')}
                    w={320}
                  />
                }
              />
            )}

            {videoUrl.provider === 'custom' && (
              <SettingsPrefRow
                title={t('Custom endpoint')}
                description={t('POST JSON { url, language?, mode? } → { transcript|text|segments, title? }')}
                align="start"
                control={
                  <TextInput
                    value={videoUrl.customEndpoint || ''}
                    onChange={(e) => patch({ customEndpoint: e.currentTarget.value })}
                    placeholder="https://your-api.example.com/transcript"
                    w={360}
                  />
                }
              />
            )}

            <Flex gap="sm" align="center" wrap="wrap">
              {videoUrl.provider !== 'none' && (
                <Button size="xs" variant="light" loading={checking} onClick={() => void testProvider()}>
                  {t('Test connection')}
                </Button>
              )}
              {videoUrl.provider === 'supadata' && (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconExternalLink size={14} />}
                  onClick={() => void platform.openLink('https://supadata.ai')}
                >
                  {t('Get API key')}
                </Button>
              )}
              {checkResult === true && (
                <Text size="sm" c="teal">
                  {t('OK')}
                </Text>
              )}
              {checkResult === false && (
                <Text size="sm" c="red">
                  {t('Failed')}
                </Text>
              )}
            </Flex>
          </Stack>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title={t('Speech-to-text fallback')}
        description={t(
          'Used when captions and provider are unavailable and media can be extracted (desktop). Reuses OpenAI provider key if STT key is empty.'
        )}
      >
        <SettingsCard>
          <Stack gap="md">
            <SettingsPrefRow
              title={t('STT provider')}
              control={
                <Select
                  data={[
                    { value: 'none', label: t('None') },
                    { value: 'openai', label: 'OpenAI Whisper' },
                  ]}
                  value={videoUrl.sttProvider}
                  onChange={(v) => patch({ sttProvider: (v as VideoUrlSettings['sttProvider']) || 'none' })}
                  w={220}
                />
              }
            />

            {videoUrl.sttProvider === 'openai' && (
              <>
                <SettingsPrefRow
                  title={t('STT API key')}
                  control={
                    <PasswordInput
                      value={videoUrl.sttApiKey || ''}
                      onChange={(e) => patch({ sttApiKey: e.currentTarget.value })}
                      placeholder={t('Leave empty to reuse OpenAI provider key')}
                      w={320}
                    />
                  }
                />
                <SettingsPrefRow
                  title={t('Max STT duration (seconds)')}
                  control={
                    <NumberInput
                      min={60}
                      max={7200}
                      step={60}
                      value={videoUrl.maxSttDurationSec}
                      onChange={(v) => patch({ maxSttDurationSec: typeof v === 'number' ? v : 1800 })}
                      w={140}
                    />
                  }
                />
                <Flex gap="sm" wrap="wrap">
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconExternalLink size={14} />}
                    onClick={() => void platform.openLink('https://platform.openai.com/api-keys')}
                  >
                    {t('Get API key')}
                  </Button>
                </Flex>
              </>
            )}
          </Stack>
        </SettingsCard>
      </SettingsSection>

      {platform.type === 'desktop' && (
        <SettingsSection
          title={t('Desktop extractor')}
          description={t(
            'Optional helper for subtitles and audio when free captions are missing. Uses yt-dlp on your computer — off by default.'
          )}
        >
          <SettingsCard>
            <Stack gap="md">
              <SettingsPrefRow
                title={t('Enable desktop extractor')}
                control={
                  <Switch
                    checked={videoUrl.desktopExtractorEnabled}
                    onChange={(e) => patch({ desktopExtractorEnabled: e.currentTarget.checked })}
                  />
                }
              />

              {videoUrl.desktopExtractorEnabled && (
                <>
                  <div className="rounded-lg border border-[color-mix(in_srgb,var(--chatbox-tint-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--chatbox-background-primary)_55%,transparent)] px-3 py-3">
                    <Flex align="center" justify="space-between" gap="sm" mb={6} wrap="wrap">
                      <Text size="sm" fw={600}>
                        {t('yt-dlp helper')}
                      </Text>
                      {ytDetecting && !ytInstalling ? (
                        <Badge size="sm" variant="light" color="gray">
                          {t('Checking…')}
                        </Badge>
                      ) : ytDetect?.installed ? (
                        <Badge size="sm" color="green" leftSection={<IconCheck size={12} />}>
                          {ytDetect.version
                            ? t('Installed · {{version}}', { version: ytDetect.version })
                            : t('Installed')}
                        </Badge>
                      ) : ytDetect ? (
                        <Badge size="sm" color="orange" variant="light">
                          {t('Not installed')}
                        </Badge>
                      ) : null}
                    </Flex>

                    <Text size="sm" c="dimmed" mb="sm">
                      {ytDetect?.installed && ytDetect.path
                        ? t('Found at {{path}}. You can leave the path field empty if this binary is on PATH.', {
                            path: ytDetect.path,
                          })
                        : t(fallbackHint)}
                    </Text>

                    {ytDetect && !ytDetect.installed && ytDetect.installer !== 'none' && (
                      <Text size="xs" c="dimmed" mb="sm">
                        {ytDetect.installerAvailable
                          ? t('One-click install uses {{manager}} on this computer.', {
                              manager: installerLabel(ytDetect.installer),
                            })
                          : t('{{manager}} was not found. Install it first, or use the full guide.', {
                              manager: installerLabel(ytDetect.installer),
                            })}
                      </Text>
                    )}

                    {ytInstalling && (
                      <Stack gap={6} mb="sm">
                        <Text size="xs" c="dimmed">
                          {ytPhase || t('Installing…')}
                        </Text>
                        <Progress value={100} animated striped size="sm" />
                      </Stack>
                    )}

                    {ytInstallLog && !ytInstalling && (
                      <Text
                        size="xs"
                        c="dimmed"
                        mb="sm"
                        className="max-h-24 overflow-auto whitespace-pre-wrap font-mono rounded-md border border-[var(--chatbox-border-primary)] p-2"
                      >
                        {ytInstallLog.slice(0, 1200)}
                      </Text>
                    )}

                    <Flex gap="sm" wrap="wrap">
                      <Button
                        size="xs"
                        variant="filled"
                        leftSection={<IconDownload size={14} />}
                        loading={ytInstalling}
                        disabled={ytDetecting || (ytDetect?.installed === true && !ytInstalling)}
                        onClick={() => void handleInstallYtDlp()}
                      >
                        {ytDetect?.installed ? t('Already installed') : t('Install yt-dlp')}
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconRefresh size={14} />}
                        loading={ytDetecting && !ytInstalling}
                        disabled={ytInstalling}
                        onClick={() => void refreshYtDlp({ fillPath: true })}
                      >
                        {t('Check status')}
                      </Button>
                      {getOS() === 'Mac' && ytDetect && !ytDetect.installerAvailable && (
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconExternalLink size={14} />}
                          onClick={() => void platform.openLink(BREW_URL)}
                        >
                          {t('Install Homebrew')}
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconExternalLink size={14} />}
                        onClick={() => void platform.openLink(YT_DLP_GUIDE_URL)}
                      >
                        {t('Full install guide')}
                      </Button>
                    </Flex>
                  </div>

                  <SettingsPrefRow
                    title={t('yt-dlp path (optional)')}
                    description={t(
                      'Most people can leave this empty after installing. Only set if yt-dlp is not on PATH.'
                    )}
                    align="start"
                    control={
                      <TextInput
                        value={videoUrl.desktopExtractorPath || ''}
                        onChange={(e) => patch({ desktopExtractorPath: e.currentTarget.value })}
                        onBlur={() => {
                          if (videoUrl.desktopExtractorPath?.trim()) {
                            void refreshYtDlp({ silent: true })
                          }
                        }}
                        placeholder={ytDetect?.path || '/opt/homebrew/bin/yt-dlp'}
                        w={360}
                      />
                    }
                  />
                </>
              )}
            </Stack>
          </SettingsCard>
        </SettingsSection>
      )}

      <SettingsSection title={t('Capability with current settings')}>
        <SettingsCard>
          <Stack gap="sm">
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} className="font-mono">
              {capability}
            </Text>
            <Text size="xs" c="dimmed">
              {t(
                'Public URLs only. You are responsible for having rights to process the linked content. Chaeboxi does not bypass logins or DRM.'
              )}
            </Text>
          </Stack>
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  )
}
