import { Alert, Button, Flex, Loader, SegmentedControl, Stack, Text } from '@mantine/core'
import {
  fetchXaiModels,
  humanizeOAuthNetworkError,
  mergeXaiModels,
  pollDeviceAuth,
  resolveXaiAuthMode,
  settingsPatchFromOAuthTokens,
  settingsPatchSignOutOAuth,
  startDeviceAuth,
  XaiOAuthError,
  type XaiAuthMode,
} from '@shared/providers/oauth'
import type { ProviderSettings } from '@shared/types'
import { IconCopy, IconExternalLink, IconLogout } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { SettingsCallout } from '@/components/settings/SettingsCallout'
import { SettingsPrefRow } from '@/components/settings/SettingsPrefRow'
import platform from '@/platform'
import { add as addToast } from '@/stores/toastActions'

interface XaiAuthSectionProps {
  providerSettings?: ProviderSettings
  setProviderSettings: (val: Partial<ProviderSettings>) => void
}

type SignInPhase = 'idle' | 'starting' | 'waiting' | 'error'

export function XaiAuthSection({ providerSettings, setProviderSettings }: XaiAuthSectionProps) {
  const { t } = useTranslation()
  const authMode = resolveXaiAuthMode(providerSettings)
  const signedIn = Boolean(providerSettings?.oauth?.accessToken)

  const [phase, setPhase] = useState<SignInPhase>('idle')
  const [userCode, setUserCode] = useState<string | null>(null)
  const [verificationUri, setVerificationUri] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancelSignIn = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setPhase('idle')
    setUserCode(null)
    setVerificationUri(null)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleModeChange = (value: string) => {
    if (value !== 'oauth' && value !== 'api_key') return
    cancelSignIn()
    setProviderSettings({ authMode: value as XaiAuthMode })
  }

  const handleSignIn = async () => {
    cancelSignIn()
    const ac = new AbortController()
    abortRef.current = ac
    setPhase('starting')
    setErrorMessage(null)
    setUserCode(null)
    setVerificationUri(null)

    try {
      const device = await startDeviceAuth()
      if (ac.signal.aborted) return

      setUserCode(device.user_code)
      setVerificationUri(device.verification_uri_complete || device.verification_uri)
      setPhase('waiting')

      const openUrl = device.verification_uri_complete || device.verification_uri
      try {
        await platform.openLink(openUrl)
      } catch {
        // User can open manually
      }

      const tokens = await pollDeviceAuth(device, { signal: ac.signal })
      if (ac.signal.aborted) return

      const authPatch = settingsPatchFromOAuthTokens(tokens)
      // Pull live catalog so SuperGrok users see current Grok models, not only seeds
      let nextModels = providerSettings?.models
      try {
        const remoteModels = await fetchXaiModels(tokens.accessToken)
        if (remoteModels.length > 0) {
          nextModels = mergeXaiModels(providerSettings?.models, remoteModels, { replaceAll: true })
        }
      } catch (modelErr) {
        console.warn('[xAI] post-auth model list failed', modelErr)
      }

      setProviderSettings({
        ...authPatch,
        ...(nextModels ? { models: nextModels } : {}),
      })
      setPhase('idle')
      setUserCode(null)
      setVerificationUri(null)
      const modelCount = nextModels?.length
      addToast(
        modelCount && nextModels !== providerSettings?.models
          ? t('Signed in to xAI · {{count}} models loaded', { count: modelCount })
          : t('Signed in to xAI')
      )
    } catch (err) {
      if (ac.signal.aborted) return
      const message =
        err instanceof XaiOAuthError
          ? err.message
          : err instanceof Error
            ? humanizeOAuthNetworkError(err)
            : t('Sign-in failed. Please try again.')
      setErrorMessage(message)
      setPhase('error')
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null
      }
    }
  }

  const handleSignOut = () => {
    cancelSignIn()
    setProviderSettings(settingsPatchSignOutOAuth())
    addToast(t('Signed out of xAI'))
  }

  const handleCopyCode = async () => {
    if (!userCode) return
    try {
      await navigator.clipboard.writeText(userCode)
      addToast(t('Copied'))
    } catch {
      addToast(t('Copy failed'))
    }
  }

  const handleOpenAgain = () => {
    if (verificationUri) {
      void platform.openLink(verificationUri)
    }
  }

  return (
    <div className="settings-card-fields">
      <SettingsPrefRow
        title={t('How do you connect?')}
        description={
          authMode === 'oauth'
            ? t(
                'Sign in with SuperGrok or X Premium — subscription quota, no console.x.ai key. If you get 403, use an API key instead.'
              )
            : t('API keys from console.x.ai are billed separately from SuperGrok / X Premium.')
        }
        align="start"
        control={
          <SegmentedControl
            className="settings-segmented"
            value={authMode}
            onChange={handleModeChange}
            data={[
              { label: t('Subscription'), value: 'oauth' },
              { label: t('API Key'), value: 'api_key' },
            ]}
          />
        }
      />

      {authMode === 'oauth' && (
        <>
          <SettingsPrefRow
            title={t('Account')}
            description={!signedIn ? t('Not signed in') : undefined}
            align="start"
            control={
              <div className="settings-actions">
                {signedIn ? (
                  <>
                    <span className="settings-status-pill settings-status-pill-ok">{t('Signed in')}</span>
                    <Button
                      variant="default"
                      size="compact-sm"
                      leftSection={<ScalableIcon icon={IconLogout} size={14} />}
                      onClick={handleSignOut}
                    >
                      {t('Sign out')}
                    </Button>
                    <Button variant="subtle" size="compact-sm" onClick={() => void handleSignIn()}>
                      {t('Re-authenticate')}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    loading={phase === 'starting'}
                    disabled={phase === 'waiting'}
                    onClick={() => void handleSignIn()}
                  >
                    {t('Sign in with SuperGrok / X Premium')}
                  </Button>
                )}
              </div>
            }
          />

          {(phase === 'waiting' || phase === 'starting') && (
            <div className="settings-device-code-panel">
              <Flex gap="xs" align="center">
                <Loader size="sm" />
                <Text size="sm" fw={600}>
                  {t('Waiting for browser approval…')}
                </Text>
              </Flex>
              {userCode && (
                <Stack gap="xs" align="center">
                  <Text size="xs" c="chatbox-tertiary" ta="center">
                    {t('Your one-time code')}
                  </Text>
                  <Text
                    ff="monospace"
                    fw={700}
                    className="settings-device-code"
                    style={{
                      fontSize: 26,
                      letterSpacing: '0.16em',
                      lineHeight: 1.2,
                      userSelect: 'all',
                    }}
                  >
                    {userCode}
                  </Text>
                  <div className="settings-actions" style={{ justifyContent: 'center' }}>
                    <Button
                      variant="default"
                      size="sm"
                      leftSection={<ScalableIcon icon={IconCopy} size={16} />}
                      onClick={() => void handleCopyCode()}
                    >
                      {t('Copy code')}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      leftSection={<ScalableIcon icon={IconExternalLink} size={16} />}
                      onClick={handleOpenAgain}
                    >
                      {t('Open login page')}
                    </Button>
                    <Button variant="subtle" size="sm" onClick={cancelSignIn}>
                      {t('Cancel')}
                    </Button>
                  </div>
                </Stack>
              )}
              {!userCode && (
                <Button variant="default" size="compact-sm" className="self-start" onClick={cancelSignIn}>
                  {t('Cancel')}
                </Button>
              )}
            </div>
          )}

          {phase === 'error' && errorMessage && (
            <Alert color="red" title={t('Sign-in failed')} radius="md">
              <Stack gap="xs">
                <Text size="sm">{errorMessage}</Text>
                <Button size="compact-sm" className="self-start" onClick={() => void handleSignIn()}>
                  {t('Try again')}
                </Button>
              </Stack>
            </Alert>
          )}

          <div className="settings-actions">
            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<ScalableIcon icon={IconExternalLink} size={14} />}
              onClick={() => platform.openLink('https://x.ai/grok')}
            >
              {t('SuperGrok')}
            </Button>
            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<ScalableIcon icon={IconExternalLink} size={14} />}
              onClick={() => platform.openLink('https://x.com/i/premium')}
            >
              {t('X Premium')}
            </Button>
          </div>
        </>
      )}

      {authMode === 'api_key' && (
        <SettingsCallout title={t('Developer API')} tone="warning">
          <Text size="sm" c="inherit" component="div">
            {t(
              'API keys from console.x.ai are billed separately from SuperGrok / X Premium. Switch to SuperGrok / X Premium to use your subscription.'
            )}
          </Text>
          <Button
            mt="xs"
            variant="default"
            size="compact-sm"
            leftSection={<ScalableIcon icon={IconExternalLink} size={14} />}
            onClick={() => platform.openLink('https://console.x.ai/')}
          >
            {t('Get API Key')}
          </Button>
        </SettingsCallout>
      )}
    </div>
  )
}
