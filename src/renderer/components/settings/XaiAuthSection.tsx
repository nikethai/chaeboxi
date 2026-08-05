import { Alert, Button, Flex, Loader, SegmentedControl, Stack, Text, TextInput } from '@mantine/core'
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
import { IconCopy, IconExternalLink, IconInfoCircle, IconLogout } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
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
    <Stack gap="sm">
      <Stack gap="xxs">
        <Text span fw="600">
          {t('How do you connect?')}
        </Text>
        <SegmentedControl
          fullWidth
          value={authMode}
          onChange={handleModeChange}
          data={[
            { label: t('SuperGrok / X Premium'), value: 'oauth' },
            { label: t('API Key'), value: 'api_key' },
          ]}
        />
      </Stack>

      {authMode === 'oauth' && (
        <Stack gap="sm">
          <Alert variant="light" color="blue" icon={<IconInfoCircle />} title={t('Subscription login')}>
            <Text size="sm">
              {t(
                'Sign in with your SuperGrok or X Premium account. Uses your subscription quota — no console.x.ai API key required. Some tiers may be restricted by xAI; if you get 403, use an API key instead.'
              )}
            </Text>
          </Alert>

          <Flex gap="xs" align="center" wrap="wrap">
            <Text size="sm" c={signedIn ? 'teal' : 'chatbox-secondary'}>
              {signedIn ? t('Signed in') : t('Not signed in')}
            </Text>
            {signedIn ? (
              <Button
                variant="light"
                color="gray"
                size="compact-sm"
                leftSection={<ScalableIcon icon={IconLogout} size={14} />}
                onClick={handleSignOut}
              >
                {t('Sign out')}
              </Button>
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
            {signedIn && (
              <Button variant="subtle" size="compact-sm" onClick={() => void handleSignIn()}>
                {t('Re-authenticate')}
              </Button>
            )}
          </Flex>

          {(phase === 'waiting' || phase === 'starting') && (
            <Stack gap="xs" p="sm" className="rounded-md border border-[var(--mantine-color-default-border)]">
              <Flex gap="xs" align="center">
                <Loader size="sm" />
                <Text size="sm">{t('Waiting for browser approval…')}</Text>
              </Flex>
              {userCode && (
                <Flex gap="xs" align="center" wrap="wrap">
                  <Text size="sm" fw={600}>
                    {t('Code')}:
                  </Text>
                  <TextInput value={userCode} readOnly w={140} size="sm" />
                  <Button
                    variant="light"
                    size="compact-sm"
                    leftSection={<ScalableIcon icon={IconCopy} size={14} />}
                    onClick={() => void handleCopyCode()}
                  >
                    {t('Copy')}
                  </Button>
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    leftSection={<ScalableIcon icon={IconExternalLink} size={14} />}
                    onClick={handleOpenAgain}
                  >
                    {t('Open again')}
                  </Button>
                </Flex>
              )}
              <Button variant="default" size="compact-sm" className="self-start" onClick={cancelSignIn}>
                {t('Cancel')}
              </Button>
            </Stack>
          )}

          {phase === 'error' && errorMessage && (
            <Alert color="red" title={t('Sign-in failed')}>
              <Stack gap="xs">
                <Text size="sm">{errorMessage}</Text>
                <Button size="compact-sm" className="self-start" onClick={() => void handleSignIn()}>
                  {t('Try again')}
                </Button>
              </Stack>
            </Alert>
          )}

          <Flex gap="sm" wrap="wrap">
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
          </Flex>
        </Stack>
      )}

      {authMode === 'api_key' && (
        <Alert variant="light" color="yellow" icon={<IconInfoCircle />} title={t('Developer API')}>
          <Text size="sm">
            {t(
              'API keys from console.x.ai are billed separately from SuperGrok / X Premium. Switch to SuperGrok / X Premium to use your subscription.'
            )}
          </Text>
          <Button
            mt="xs"
            variant="light"
            size="compact-sm"
            leftSection={<ScalableIcon icon={IconExternalLink} size={14} />}
            onClick={() => platform.openLink('https://console.x.ai/')}
          >
            {t('Get API Key')}
          </Button>
        </Alert>
      )}
    </Stack>
  )
}
