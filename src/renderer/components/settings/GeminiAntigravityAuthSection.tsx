import { Alert, Button, Checkbox, Flex, Loader, SegmentedControl, Stack, Text, Textarea } from '@mantine/core'
import {
  enrichGeminiAntigravitySession,
  exchangeAuthorizationCode,
  fetchGeminiAntigravityModels,
  GEMINI_ANTIGRAVITY_DEFAULT_MODELS,
  GEMINI_ANTIGRAVITY_REDIRECT_URI,
  GeminiAntigravityOAuthError,
  humanizeGeminiAntigravityOAuthNetworkError,
  parseGeminiAntigravityRedirectUrl,
  resolveGeminiAuthMode,
  resolveModelsAfterAntigravityLogin,
  settingsPatchFromGeminiAntigravityTokens,
  settingsPatchSignOutGeminiAntigravityOAuth,
  startGeminiAntigravityPkceAuth,
  type GeminiAntigravityPkceSession,
  type GeminiAuthMode,
} from '@shared/providers/oauth'
import type { ProviderModelInfo, ProviderSettings } from '@shared/types'
import { IconExternalLink, IconInfoCircle, IconLogout, IconAlertTriangle } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import platform from '@/platform'
import { add as addToast } from '@/stores/toastActions'
import {
  cancelLocalOAuthCallback,
  canUseLocalOAuthCallback,
  waitForLocalOAuthCallback,
} from '@/utils/oauth-local-callback'

interface GeminiAntigravityAuthSectionProps {
  providerSettings?: ProviderSettings
  setProviderSettings: (val: Partial<ProviderSettings>) => void
}

type SignInPhase = 'idle' | 'starting' | 'waiting' | 'exchanging' | 'error'

export function GeminiAntigravityAuthSection({
  providerSettings,
  setProviderSettings,
}: GeminiAntigravityAuthSectionProps) {
  const { t } = useTranslation()
  const authMode = resolveGeminiAuthMode(providerSettings)
  const signedIn = Boolean(providerSettings?.oauth?.accessToken)
  const email = providerSettings?.oauth?.email
  const planType = providerSettings?.oauth?.planType
  const riskAccepted = Boolean(providerSettings?.oauth?.riskAcceptedAt)
  const desktopCallback = canUseLocalOAuthCallback()

  const [phase, setPhase] = useState<SignInPhase>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [redirectPaste, setRedirectPaste] = useState('')
  const [riskChecked, setRiskChecked] = useState(riskAccepted)
  /** True when local server failed and user must paste */
  const [forcePasteMode, setForcePasteMode] = useState(false)
  const pkceRef = useRef<GeminiAntigravityPkceSession | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancelSignIn = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    pkceRef.current = null
    void cancelLocalOAuthCallback()
    setPhase('idle')
    setRedirectPaste('')
    setForcePasteMode(false)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      void cancelLocalOAuthCallback()
    }
  }, [])

  const finishWithRedirectUrl = useCallback(
    async (redirectUrl: string, session: GeminiAntigravityPkceSession, signal: AbortSignal) => {
      setPhase('exchanging')
      setErrorMessage(null)

      const { code, state } = parseGeminiAntigravityRedirectUrl(redirectUrl)
      if (state && state !== session.state) {
        throw new GeminiAntigravityOAuthError(
          'OAuth state mismatch. Cancel and start sign-in again.',
          'state_mismatch'
        )
      }
      if (signal.aborted) return

      let tokens = await exchangeAuthorizationCode({
        code,
        verifier: session.verifier,
        redirectUri: session.redirectUri,
      })
      if (signal.aborted) return

      tokens = await enrichGeminiAntigravitySession(tokens)
      if (signal.aborted) return

      const riskAcceptedAt = providerSettings?.oauth?.riskAcceptedAt || Date.now()
      const authPatch = settingsPatchFromGeminiAntigravityTokens(tokens, { riskAcceptedAt })

      // Always replace Studio catalog after oauth login — Studio IDs 404 on cloudcode-pa
      let remoteModels: ProviderModelInfo[] | undefined
      try {
        if (tokens.projectId) {
          remoteModels = await fetchGeminiAntigravityModels(tokens.accessToken, tokens.projectId)
        }
      } catch (modelErr) {
        console.warn('[Gemini Antigravity] post-auth model list failed', modelErr)
      }
      const nextModels = resolveModelsAfterAntigravityLogin(remoteModels, providerSettings?.models)

      if (signal.aborted) return

      setProviderSettings({
        ...authPatch,
        models: nextModels,
      })
      setPhase('idle')
      setRedirectPaste('')
      setForcePasteMode(false)
      pkceRef.current = null
      addToast(
        remoteModels && remoteModels.length > 0
          ? t('Signed in to Google · {{count}} models loaded', { count: nextModels.length })
          : t('Signed in to Google · using Antigravity model list')
      )
    },
    [providerSettings?.models, providerSettings?.oauth?.riskAcceptedAt, setProviderSettings, t]
  )

  const handleModeChange = (value: string) => {
    if (value !== 'oauth' && value !== 'api_key') return
    cancelSignIn()
    if (value === 'oauth') {
      // Seed Cloud Code Assist model ids (never keep AI Studio catalog in oauth mode)
      setProviderSettings({
        authMode: 'oauth',
        models: GEMINI_ANTIGRAVITY_DEFAULT_MODELS.map((m) => ({ ...m })),
      })
      return
    }
    setProviderSettings({ authMode: value as GeminiAuthMode })
  }

  const handleStartSignIn = async () => {
    if (!riskChecked && !riskAccepted) {
      setErrorMessage(
        t('You must acknowledge the experimental risk notice before signing in with Google.')
      )
      setPhase('error')
      return
    }

    cancelSignIn()
    const ac = new AbortController()
    abortRef.current = ac
    setPhase('starting')
    setErrorMessage(null)
    setRedirectPaste('')
    setForcePasteMode(false)

    try {
      const session = await startGeminiAntigravityPkceAuth()
      if (ac.signal.aborted) return
      pkceRef.current = session
      setPhase('waiting')

      // Desktop: start local listener BEFORE opening browser so redirect is captured
      if (desktopCallback) {
        const waitPromise = waitForLocalOAuthCallback({
          port: 51121,
          timeoutMs: 5 * 60 * 1000,
          signal: ac.signal,
        })

        try {
          await platform.openLink(session.authUrl)
        } catch {
          // User can open manually
        }

        let redirectUrl: string
        try {
          ;({ redirectUrl } = await waitPromise)
        } catch (waitErr) {
          if (ac.signal.aborted) return
          // Port busy / timeout → fall back to paste mode instead of hard fail
          const msg = waitErr instanceof Error ? waitErr.message : String(waitErr)
          if (/cancelled/i.test(msg)) return
          console.warn('[Gemini Antigravity] local callback failed, paste fallback', waitErr)
          setForcePasteMode(true)
          setErrorMessage(
            t(
              'Automatic callback failed ({{detail}}). Paste the full redirect URL from the browser address bar below.',
              { detail: msg }
            )
          )
          // Keep waiting phase so paste UI stays visible
          return
        }

        if (ac.signal.aborted) return
        try {
          await finishWithRedirectUrl(redirectUrl, session, ac.signal)
          return
        } catch (finishErr) {
          if (ac.signal.aborted) return
          const message =
            finishErr instanceof GeminiAntigravityOAuthError
              ? finishErr.message
              : finishErr instanceof Error
                ? humanizeGeminiAntigravityOAuthNetworkError(finishErr)
                : t('Sign-in failed. Please try again.')
          setErrorMessage(message)
          setPhase('error')
          return
        }
      }

      // Web / no desktop IPC: open browser + paste flow
      try {
        await platform.openLink(session.authUrl)
      } catch {
        // User can open manually
      }
      setForcePasteMode(true)
    } catch (err) {
      if (ac.signal.aborted) return
      const message =
        err instanceof GeminiAntigravityOAuthError
          ? err.message
          : err instanceof Error
            ? humanizeGeminiAntigravityOAuthNetworkError(err)
            : t('Sign-in failed. Please try again.')
      setErrorMessage(message)
      setPhase('error')
      pkceRef.current = null
    }
  }

  const handleCompleteSignIn = async () => {
    const session = pkceRef.current
    if (!session) {
      setErrorMessage(t('Start sign-in first, then paste the redirect URL.'))
      setPhase('error')
      return
    }

    const ac = new AbortController()
    abortRef.current = ac

    try {
      await finishWithRedirectUrl(redirectPaste, session, ac.signal)
    } catch (err) {
      if (ac.signal.aborted) return
      const message =
        err instanceof GeminiAntigravityOAuthError
          ? err.message
          : err instanceof Error
            ? humanizeGeminiAntigravityOAuthNetworkError(err)
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
    setProviderSettings(settingsPatchSignOutGeminiAntigravityOAuth())
    addToast(t('Signed out of Google'))
  }

  const handleOpenAgain = () => {
    if (pkceRef.current?.authUrl) {
      void platform.openLink(pkceRef.current.authUrl)
    }
  }

  const showPasteUi =
    phase === 'waiting' ||
    phase === 'exchanging' ||
    phase === 'starting' ||
    (phase === 'error' && forcePasteMode)

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
            { label: t('Google sign-in (experimental)'), value: 'oauth' },
            { label: t('API Key'), value: 'api_key' },
          ]}
        />
      </Stack>

      {authMode === 'oauth' && (
        <Stack gap="sm">
          <Alert
            variant="light"
            color="orange"
            icon={<IconAlertTriangle />}
            title={t('Experimental · account risk')}
          >
            <Text size="sm">
              {t(
                'Sign in with Google uses the unofficial Antigravity / Cloud Code Assist path (similar to some TUIs). It is not an official Google product integration. Your Google account may be restricted or banned. Prefer an AI Studio API key for production use.'
              )}
            </Text>
            {!signedIn && (
              <Checkbox
                mt="sm"
                checked={riskChecked || riskAccepted}
                onChange={(e) => setRiskChecked(e.currentTarget.checked)}
                label={t('I understand the risk and want to continue')}
              />
            )}
          </Alert>

          <Alert variant="light" color="blue" icon={<IconInfoCircle />} title={t('Subscription-style login')}>
            <Text size="sm">
              {desktopCallback
                ? t(
                    'Uses Google OAuth (PKCE). After you click sign-in, approve Google in the browser — Chaeboxi listens on localhost and finishes automatically. Quota is separate from AI Studio API keys.'
                  )
                : t(
                    'Uses Google OAuth (PKCE). After the browser opens, sign in, then paste the full redirect URL from the address bar (the page may fail to load on localhost — that is OK). Quota is separate from AI Studio API keys.'
                  )}
            </Text>
          </Alert>

          <Flex gap="xs" align="center" wrap="wrap">
            <Text size="sm" c={signedIn ? 'teal' : 'chatbox-secondary'}>
              {signedIn
                ? email
                  ? planType
                    ? t('Signed in as {{email}} ({{plan}})', { email, plan: planType })
                    : t('Signed in as {{email}}', { email })
                  : planType
                    ? t('Signed in ({{plan}})', { plan: planType })
                    : t('Signed in')
                : t('Not signed in')}
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
                loading={phase === 'starting' || phase === 'exchanging'}
                disabled={phase === 'waiting'}
                onClick={() => void handleStartSignIn()}
              >
                {t('Sign in with Google')}
              </Button>
            )}
            {signedIn && (
              <Button variant="subtle" size="compact-sm" onClick={() => void handleStartSignIn()}>
                {t('Re-authenticate')}
              </Button>
            )}
          </Flex>

          {showPasteUi && (
            <Stack
              gap="sm"
              p="md"
              className="rounded-md border-2 border-[var(--mantine-color-blue-filled)] bg-[var(--mantine-color-blue-light)]"
            >
              <Flex gap="xs" align="center">
                <Loader size="sm" />
                <Text size="sm" fw={600}>
                  {phase === 'exchanging'
                    ? t('Completing sign-in…')
                    : desktopCallback && !forcePasteMode
                      ? t('Waiting for Google in the browser…')
                      : t('Complete Google sign-in in the browser, then paste the redirect URL')}
                </Text>
              </Flex>

              {desktopCallback && !forcePasteMode && phase === 'waiting' && (
                <Text size="sm" c="chatbox-secondary">
                  {t(
                    'Approve access in the browser. This window will finish automatically when Google redirects to {{uri}}.',
                    { uri: GEMINI_ANTIGRAVITY_REDIRECT_URI }
                  )}
                </Text>
              )}

              {(forcePasteMode || !desktopCallback) && (
                <>
                  <Textarea
                    label={t('Redirect URL')}
                    placeholder="http://localhost:51121/oauth-callback?code=...&state=..."
                    value={redirectPaste}
                    onChange={(e) => setRedirectPaste(e.currentTarget.value)}
                    minRows={2}
                    autosize
                  />
                  <Flex gap="xs" wrap="wrap">
                    <Button
                      size="sm"
                      disabled={!redirectPaste.trim() || phase === 'exchanging'}
                      loading={phase === 'exchanging'}
                      onClick={() => void handleCompleteSignIn()}
                    >
                      {t('Complete sign-in')}
                    </Button>
                    <Button
                      variant="light"
                      size="sm"
                      leftSection={<ScalableIcon icon={IconExternalLink} size={16} />}
                      onClick={handleOpenAgain}
                    >
                      {t('Open login page')}
                    </Button>
                    <Button variant="default" size="sm" onClick={cancelSignIn}>
                      {t('Cancel')}
                    </Button>
                  </Flex>
                  <Text size="xs" c="chatbox-secondary">
                    {t(
                      'If the browser shows a connection error on localhost, copy the full URL from the address bar anyway — it still contains the code.'
                    )}
                  </Text>
                </>
              )}

              {desktopCallback && !forcePasteMode && (
                <Flex gap="xs" wrap="wrap">
                  <Button
                    variant="light"
                    size="sm"
                    leftSection={<ScalableIcon icon={IconExternalLink} size={16} />}
                    onClick={handleOpenAgain}
                  >
                    {t('Open login page')}
                  </Button>
                  <Button variant="default" size="sm" onClick={cancelSignIn}>
                    {t('Cancel')}
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => {
                      setForcePasteMode(true)
                      setErrorMessage(null)
                    }}
                  >
                    {t('Paste URL instead')}
                  </Button>
                </Flex>
              )}
            </Stack>
          )}

          {phase === 'error' && errorMessage && (
            <Alert color="red" title={t('Sign-in failed')}>
              <Stack gap="xs">
                <Text size="sm">{errorMessage}</Text>
                <Button size="compact-sm" className="self-start" onClick={() => void handleStartSignIn()}>
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
              onClick={() => platform.openLink('https://antigravity.google/')}
            >
              {t('Antigravity')}
            </Button>
            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<ScalableIcon icon={IconExternalLink} size={14} />}
              onClick={() => platform.openLink('https://aistudio.google.com/apikey')}
            >
              {t('AI Studio API keys')}
            </Button>
          </Flex>
        </Stack>
      )}

      {authMode === 'api_key' && (
        <Alert variant="light" color="yellow" icon={<IconInfoCircle />} title={t('Developer API')}>
          <Text size="sm">
            {t(
              'API keys from Google AI Studio are billed separately from Google AI / Antigravity quotas. Switch to Google sign-in (experimental) to try subscription-style access.'
            )}
          </Text>
          <Button
            mt="xs"
            variant="light"
            size="compact-sm"
            leftSection={<ScalableIcon icon={IconExternalLink} size={14} />}
            onClick={() => platform.openLink('https://aistudio.google.com/apikey')}
          >
            {t('Get API Key')}
          </Button>
        </Alert>
      )}
    </Stack>
  )
}
