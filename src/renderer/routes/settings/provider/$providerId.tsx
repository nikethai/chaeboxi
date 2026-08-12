import NiceModal from '@ebay/nice-modal-react'
import {
  Badge,
  Button,
  Flex,
  Loader,
  NumberInput,
  PasswordInput,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { SystemProviders } from '@shared/defaults'
import { ModelProviderEnum, ModelProviderType, type ProviderModelInfo } from '@shared/types'
import {
  normalizeAzureEndpoint,
  normalizeClaudeHost,
  normalizeGeminiHost,
  normalizeOpenAIApiHostAndPath,
  normalizeOpenAIResponsesHostAndPath,
} from '@shared/utils'
import {
  IconCircleCheck,
  IconDiscount2,
  IconExternalLink,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { uniq } from 'lodash'
import { ofetch } from 'ofetch'
import { type ChangeEvent, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createModelDependencies } from '@/adapters'
import { AdaptiveSelect } from '@/components/AdaptiveSelect'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import PopoverConfirm from '@/components/common/PopoverConfirm'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { ModelList } from '@/components/ModelList'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader'
import { SettingsCollapsible } from '@/components/settings/SettingsCollapsible'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { getModelSettingUtil } from '@/packages/model-setting-utils'
import platform from '@/platform'
import { useProviderSettings, useSettingsStore } from '@/stores/settingsStore'
import { add as addToast } from '@/stores/toastActions'
import { type ModelTestState, testModelCapabilities } from '@/utils/model-tester'
import { useComfyUIInfo } from '@/hooks/useComfyUIInfo'
import { ComfyUIClient } from '@shared/providers/definitions/models/comfyui-client'
import type { ComfyUILoraConfig } from '@shared/providers/definitions/models/comfyui-types'
import { OpenClawGatewaySettings } from '@/components/settings/OpenClawGatewaySettings'
import {
  getQwenKeyLabel,
  getQwenKeyPlaceholder,
  getQwenPresetModels,
  QwenPlanSelector,
} from '@/components/settings/QwenPlanSelector'
import { GeminiAntigravityAuthSection } from '@/components/settings/GeminiAntigravityAuthSection'
import { OpenAICodexAuthSection } from '@/components/settings/OpenAICodexAuthSection'
import { XaiAuthSection } from '@/components/settings/XaiAuthSection'
import {
  isGeminiAntigravityOAuthSignedIn,
  isOpenAICodexOAuthSignedIn,
  isXaiOAuthSignedIn,
  resolveGeminiAuthMode,
  resolveGeminiCredential,
  resolveOpenAIAuthMode,
  resolveOpenAIBearer,
  resolveXaiAuthMode,
  resolveXaiBearer,
} from '@shared/providers/oauth'
import { ProviderUsageCard } from '@/components/usage'
import { useProviderUsageStatus } from '@/packages/usage-tracking'

export const Route = createFileRoute('/settings/provider/$providerId')({
  component: RouteComponent,
})

type ModelTestResult = ModelTestState & {
  modelId: string
  modelName: string
}

function ImagePromptPrependSection({
  providerSettings,
  setProviderSettings,
}: {
  providerSettings: any
  setProviderSettings: (val: any) => void
}) {
  const { t } = useTranslation()
  const hasValues = Boolean(
    providerSettings?.imagePromptCharacterPrepend?.trim() || providerSettings?.imagePromptPositiveTagsPrepend?.trim()
  )
  const [open, setOpen] = useState(hasValues)

  return (
    <SettingsSection
      title={t('Image Creator')}
      description={t('Optional prepends for Image Creator only — does not rewrite saved history prompts.')}
    >
      <SettingsCard>
        <button
          type="button"
          className="settings-collapsible-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span>{open ? t('Hide advanced defaults') : t('Show advanced defaults')}</span>
          <span className="settings-collapsible-chevron" data-open={open ? 'true' : undefined}>
            ›
          </span>
        </button>
        {open && (
          <div className="settings-card-fields" style={{ paddingTop: 0 }}>
            <div className="settings-field">
              <span className="settings-field-label">{t('Image Character Prepend')}</span>
              <Textarea
                autosize
                minRows={2}
                value={providerSettings?.imagePromptCharacterPrepend || ''}
                placeholder={String(t('Character name, traits, outfit, pose, and other reusable character tags'))}
                onChange={(e) =>
                  setProviderSettings({
                    imagePromptCharacterPrepend: e.currentTarget.value,
                  })
                }
              />
            </div>
            <div className="settings-field">
              <span className="settings-field-label">{t('Image Positive Tags Prepend')}</span>
              <Textarea
                autosize
                minRows={2}
                value={providerSettings?.imagePromptPositiveTagsPrepend || ''}
                placeholder={String(t('Reusable positive quality/style tags'))}
                onChange={(e) =>
                  setProviderSettings({
                    imagePromptPositiveTagsPrepend: e.currentTarget.value,
                  })
                }
              />
            </div>
          </div>
        )}
      </SettingsCard>
    </SettingsSection>
  )
}

function parseDomainList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

const DEFAULT_COMFYUI_LORA: ComfyUILoraConfig = {
  name: '',
  strengthModel: 1,
  strengthClip: 1,
}

function getComfyUILoras(providerSettings: any): ComfyUILoraConfig[] {
  if (Array.isArray(providerSettings?.comfyuiLoras) && providerSettings.comfyuiLoras.length > 0) {
    return providerSettings.comfyuiLoras.map((lora: ComfyUILoraConfig) => ({
      name: lora.name || '',
      strengthModel: lora.strengthModel ?? 1,
      strengthClip: lora.strengthClip ?? lora.strengthModel ?? 1,
    }))
  }

  if (providerSettings?.comfyuiLora && providerSettings.comfyuiLora !== 'none') {
    const strength = providerSettings.comfyuiLoraStrength ?? 1
    return [
      {
        name: providerSettings.comfyuiLora,
        strengthModel: strength,
        strengthClip: strength,
      },
    ]
  }

  return []
}

function DomainListTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (domains: string[]) => void
  placeholder?: string
}) {
  const [localValue, setLocalValue] = useState(value.join('\n'))
  const handleBlur = useCallback(() => {
    onChange(parseDomainList(localValue))
  }, [localValue, onChange])
  return (
    <Textarea
      autosize
      minRows={2}
      value={localValue}
      placeholder={placeholder}
      onChange={(e) => setLocalValue(e.currentTarget.value)}
      onBlur={handleBlur}
    />
  )
}

function normalizeAPIHost(
  providerSettings: any,
  providerType: ModelProviderType
): {
  apiHost: string
  apiPath: string
} {
  switch (providerType) {
    case ModelProviderType.Claude:
      return normalizeClaudeHost(providerSettings?.apiHost || '')
    case ModelProviderType.Gemini:
      return normalizeGeminiHost(providerSettings?.apiHost || '')
    case ModelProviderType.OpenAIResponses:
      return normalizeOpenAIResponsesHostAndPath({
        apiHost: providerSettings?.apiHost,
        apiPath: providerSettings?.apiPath,
      })
    case ModelProviderType.OpenAI:
    default:
      return normalizeOpenAIApiHostAndPath({
        apiHost: providerSettings?.apiHost,
        apiPath: providerSettings?.apiPath,
      })
  }
}

export function RouteComponent() {
  const { providerId } = Route.useParams()
  return <ProviderSettings key={providerId} providerId={providerId} />
}

function ProviderSettings({ providerId }: { providerId: string }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { setSettings, ...settings } = useSettingsStore((state) => state)

  const baseInfo = [...SystemProviders(), ...(settings.customProviders || [])].find((p) => p.id === providerId)

  const { providerSettings, setProviderSettings } = useProviderSettings(providerId)
  const { status: usageStatus, loading: usageLoading, refresh: refreshUsage } = useProviderUsageStatus(providerId)

  const displayModels = providerSettings?.models || baseInfo?.defaultSettings?.models || []
  const isNoApiKeyProvider = [
    ModelProviderEnum.Ollama,
    ModelProviderEnum.LMStudio,
    ModelProviderEnum.OpenClaw,
    ModelProviderEnum.ComfyUI,
  ].includes(baseInfo?.id as ModelProviderEnum)
  const isXaiOAuthMode =
    baseInfo?.id === ModelProviderEnum.XAI && resolveXaiAuthMode(providerSettings) === 'oauth'
  const isOpenAICodexOAuthMode =
    baseInfo?.id === ModelProviderEnum.OpenAI && resolveOpenAIAuthMode(providerSettings) === 'oauth'
  const isGeminiAntigravityOAuthMode =
    baseInfo?.id === ModelProviderEnum.Gemini && resolveGeminiAuthMode(providerSettings) === 'oauth'
  const isSubscriptionOAuthMode = isXaiOAuthMode || isOpenAICodexOAuthMode || isGeminiAntigravityOAuthMode
  const isSubscriptionOAuthSignedIn =
    (baseInfo?.id === ModelProviderEnum.XAI && isXaiOAuthSignedIn(providerSettings)) ||
    (baseInfo?.id === ModelProviderEnum.OpenAI && isOpenAICodexOAuthSignedIn(providerSettings)) ||
    (baseInfo?.id === ModelProviderEnum.Gemini && isGeminiAntigravityOAuthSignedIn(providerSettings))
  const isBuiltinOpenAICompatible =
    !!baseInfo &&
    !baseInfo.isCustom &&
    baseInfo.type === ModelProviderType.OpenAI &&
    baseInfo.id !== ModelProviderEnum.Azure
  const showBuiltinApiHostSection =
    (isBuiltinOpenAICompatible ||
      [ModelProviderEnum.OpenAIResponses, ModelProviderEnum.Claude, ModelProviderEnum.Gemini].includes(
        baseInfo?.id as ModelProviderEnum
      )) &&
    // Hide API Host for subscription OAuth paths (fixed backends)
    !isOpenAICodexOAuthMode &&
    !isGeminiAntigravityOAuthMode

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProviderSettings({
      apiKey: e.currentTarget.value,
    })
  }

  const handleApiHostChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProviderSettings({
      apiHost: e.currentTarget.value,
    })
  }

  const handleApiPathChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProviderSettings({
      apiPath: e.currentTarget.value,
    })
  }

  const handleCloudflareClientIdChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProviderSettings({
      cloudflareClientId: e.currentTarget.value,
    })
  }

  const handleCloudflareClientSecretChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProviderSettings({
      cloudflareClientSecret: e.currentTarget.value,
    })
  }

  const handleAddModel = async () => {
    const newModel: ProviderModelInfo = await NiceModal.show('model-edit', { providerId })
    if (!newModel?.modelId) {
      return
    }

    if (displayModels?.find((m) => m.modelId === newModel.modelId)) {
      addToast(t('already existed'))
      return
    }

    setProviderSettings({
      models: [...displayModels, newModel],
    })
  }

  const editModel = async (model: ProviderModelInfo) => {
    const newModel: ProviderModelInfo = await NiceModal.show('model-edit', { model, providerId })
    if (!newModel?.modelId) {
      return
    }

    setProviderSettings({
      models: displayModels.map((m) => (m.modelId === newModel.modelId ? newModel : m)),
    })
  }

  const deleteModel = (modelId: string) => {
    setProviderSettings({
      models: displayModels.filter((m) => m.modelId !== modelId),
    })
  }

  const resetModels = () => {
    const qwenPresetModels =
      baseInfo?.id === ModelProviderEnum.Qwen ? getQwenPresetModels(providerSettings) : undefined
    setProviderSettings({
      models: qwenPresetModels || baseInfo?.defaultSettings?.models,
    })
  }

  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<ProviderModelInfo[]>()

  const handleFetchModels = async () => {
    try {
      setFetchedModels(undefined)
      setFetchingModels(true)
      // Refresh OAuth tokens before catalog fetch when needed
      try {
        const { refreshXaiAuthIfNeeded } = await import('@/utils/xai-auth-refresh')
        const { refreshOpenAICodexAuthIfNeeded } = await import('@/utils/openai-codex-auth-refresh')
        const { refreshGeminiAntigravityAuthIfNeeded } = await import('@/utils/gemini-antigravity-auth-refresh')
        let refreshed = settings as any
        refreshed = await refreshXaiAuthIfNeeded(refreshed, baseInfo!.id)
        refreshed = await refreshOpenAICodexAuthIfNeeded(refreshed, baseInfo!.id)
        refreshed = await refreshGeminiAntigravityAuthIfNeeded(refreshed, baseInfo!.id)
      } catch (authErr) {
        console.warn('OAuth refresh before model fetch failed', authErr)
      }

      const { refreshProviderModels } = await import('@/utils/provider-model-refresh')
      const result = await refreshProviderModels({
        providerId: baseInfo!.id,
        providerSettings: {
          ...baseInfo?.defaultSettings,
          ...providerSettings,
        },
        isCustom: baseInfo!.isCustom,
        customProviderType: baseInfo!.isCustom ? baseInfo!.type : undefined,
      })

      if (result.ok && result.models.length) {
        setFetchedModels(result.models)
      } else if (result.models.length) {
        setFetchedModels(result.models)
        addToast(t('Model refresh used fallback list') + (result.ok ? '' : `: ${'error' in result ? result.error : ''}`))
      } else {
        addToast(t('Failed to fetch models') + ('error' in result && result.error ? `: ${result.error}` : ''))
      }
      setFetchingModels(false)
    } catch (error) {
      console.error('Failed to fetch models', error)
      setFetchedModels(undefined)
      setFetchingModels(false)
      addToast(t('Failed to fetch models'))
    }
  }
  const [selectedTestModel, setSelectedTestModel] = useState<string>()
  const [showTestModelSelector, setShowTestModelSelector] = useState(false)
  const [modelTestResult, setModelTestResult] = useState<ModelTestResult | null>(null)
  const [checkingOpenClawHealth, setCheckingOpenClawHealth] = useState(false)
  const [openClawHealthy, setOpenClawHealthy] = useState<boolean>()
  const checkModel =
    selectedTestModel || baseInfo?.defaultSettings?.models?.[0]?.modelId || providerSettings?.models?.[0]?.modelId

  const defaultApiHost = baseInfo?.defaultSettings?.apiHost

  const checkOpenClawHealth = useCallback(async () => {
    const apiHost = providerSettings?.apiHost || defaultApiHost
    if (!apiHost) {
      return
    }

    setCheckingOpenClawHealth(true)
    setOpenClawHealthy(undefined)
    try {
      await ofetch(`${apiHost.replace(/\/+$/, '')}/health`, {
        method: 'GET',
      })
      setOpenClawHealthy(true)
    } catch {
      setOpenClawHealthy(false)
    } finally {
      setCheckingOpenClawHealth(false)
    }
  }, [defaultApiHost, providerSettings?.apiHost])

  const handleCheckApiKey = async (modelId?: string) => {
    const testModel = modelId || checkModel
    if (!testModel) return

    // Find the model info
    const modelInfo = displayModels.find((m) => m.modelId === testModel)
    if (!modelInfo) return

    // Use the same testing modal as handleCheckModel
    await handleCheckModel(modelInfo)
  }

  const handleCheckModel = useCallback(
    async (model: ProviderModelInfo) => {
      // Initialize result with model info
      const result: ModelTestResult = {
        modelId: model.modelId,
        modelName: model.nickname || model.modelId,
        testing: true,
        basicTest: { status: 'pending' },
        visionTest: { status: 'pending' },
        toolTest: { status: 'pending' },
      }
      setModelTestResult(result)

      const configs = await platform.getConfig()
      const dependencies = await createModelDependencies()

      const finalState = await testModelCapabilities({
        providerId,
        modelId: model.modelId,
        settings,
        configs,
        dependencies,
        onStateChange: (state) => {
          setModelTestResult({
            ...result,
            ...state,
          })
        },
      })
      const visionSupported = finalState.visionTest?.status === 'success'
      const toolUseSupported = finalState.toolTest?.status === 'success'
      if (visionSupported || toolUseSupported) {
        const capabilitiesToAdd: ('vision' | 'tool_use')[] = []
        if (visionSupported) capabilitiesToAdd.push('vision')
        if (toolUseSupported) capabilitiesToAdd.push('tool_use')
        console.log('Auto-enable capabilities based on test results')
        setProviderSettings({
          models: displayModels.map((m) =>
            m.modelId === model.modelId
              ? { ...m, capabilities: uniq([...(m.capabilities || []), ...capabilitiesToAdd]) }
              : m
          ),
        })
      }
    },
    [displayModels, setProviderSettings, providerId]
  )

  if (!baseInfo) {
    return <Text>{t('Provider not found')}</Text>
  }

  return (
    <SettingsPage wide key={baseInfo.id} className="settings-provider-detail">
      <SettingsPageHeader
        title={t(baseInfo.name)}
        description={
          baseInfo.isCustom ? (
            <a href="https://github.com/nikethai/chaeboxi" target="_blank" rel="noopener">
              {t('Setup guide')}
            </a>
          ) : undefined
        }
        actions={
          <Flex gap="xs" align="center">
            {baseInfo.urls?.website && (
              <Button
                variant="default"
                size="compact-sm"
                leftSection={<ScalableIcon icon={IconExternalLink} size={16} />}
                onClick={() => platform.openLink(baseInfo.urls!.website!)}
              >
                {t('Website')}
              </Button>
            )}
            {baseInfo.isCustom && (
              <PopoverConfirm
                title={t('Confirm to delete this custom provider?')}
                confirmButtonColor="chatbox-error"
                onConfirm={() => {
                  setSettings({
                    customProviders: settings.customProviders?.filter((p) => p.id !== baseInfo.id),
                  })
                  navigate({ to: './..' as any, replace: true })
                }}
              >
                <Button
                  variant="default"
                  size="compact-sm"
                  leftSection={<ScalableIcon icon={IconTrash} size={16} />}
                  color="chatbox-error"
                >
                  {t('Delete')}
                </Button>
              </PopoverConfirm>
            )}
          </Flex>
        }
      />

      <Stack gap="md">
        {/* custom provider base info */}
        {baseInfo.isCustom && (
          <SettingsSection title={t('Provider')}>
            <SettingsCard>
              <div className="settings-card-fields">
                <div className="settings-field">
                  <span className="settings-field-label">{t('Name')}</span>
                  <TextInput
                    flex={1}
                    value={baseInfo.name}
                    onChange={(e) => {
                      setSettings({
                        customProviders: settings.customProviders?.map((p) =>
                          p.id === baseInfo.id ? { ...p, name: e.currentTarget.value } : p
                        ),
                      })
                    }}
                  />
                </div>
                <div className="settings-field">
                  <span className="settings-field-label">{t('API Mode')}</span>
                  <AdaptiveSelect
                    value={baseInfo.type}
                    onChange={(value) => {
                      setSettings({
                        customProviders: settings.customProviders?.map((p) =>
                          p.id === baseInfo.id ? { ...p, type: value as ModelProviderType } : p
                        ),
                      })
                    }}
                    data={[
                      {
                        value: ModelProviderType.OpenAI,
                        label: t('OpenAI API Compatible'),
                      },
                      {
                        value: ModelProviderType.OpenAIResponses,
                        label: t('OpenAI Responses API Compatible'),
                      },
                      {
                        value: ModelProviderType.Claude,
                        label: t('Claude API Compatible'),
                      },
                      {
                        value: ModelProviderType.Gemini,
                        label: t('Google Gemini API Compatible'),
                      },
                    ]}
                  />
                </div>
              </div>
            </SettingsCard>
          </SettingsSection>
        )}

        {/* Provider description — dual-auth providers have their own help copy */}
        {baseInfo.description &&
          baseInfo.id !== ModelProviderEnum.XAI &&
          baseInfo.id !== ModelProviderEnum.OpenAI &&
          baseInfo.id !== ModelProviderEnum.Gemini && (
          <Stack gap="xxs">
            <Text span size="xs" c="chatbox-tertiary">
              {t(baseInfo.description)}
            </Text>
          </Stack>
        )}

        <SettingsSection title={t('Connection')}>
          <SettingsCard>
            <div className="settings-card-fields">
              {/* xAI dual auth: SuperGrok/X Premium OAuth or developer API key */}
              {baseInfo.id === ModelProviderEnum.XAI && (
                <XaiAuthSection providerSettings={providerSettings} setProviderSettings={setProviderSettings} />
              )}

              {/* OpenAI dual auth: ChatGPT subscription (Codex) or Platform API key */}
              {baseInfo.id === ModelProviderEnum.OpenAI && (
                <OpenAICodexAuthSection
                  providerSettings={providerSettings}
                  setProviderSettings={setProviderSettings}
                />
              )}

              {/* Gemini dual auth: Antigravity Google OAuth or AI Studio API key */}
              {baseInfo.id === ModelProviderEnum.Gemini && (
                <GeminiAntigravityAuthSection
                  providerSettings={providerSettings}
                  setProviderSettings={setProviderSettings}
                />
              )}

              {/* QwenCloud plan presets (Token Plan, Coding Plan, Standard) */}
              {baseInfo.id === ModelProviderEnum.Qwen && (
                <QwenPlanSelector providerSettings={providerSettings} setProviderSettings={setProviderSettings} />
              )}

              {/* API Key — hidden for subscription OAuth mode */}
              {!isNoApiKeyProvider && !isSubscriptionOAuthMode && (
                <div className="settings-field">
                  <span className="settings-field-label">
                    {baseInfo.id === ModelProviderEnum.Qwen ? t(getQwenKeyLabel(providerSettings)) : t('API Key')}
                  </span>
                  <Flex gap="xs" align="center">
                    <PasswordInput
                      flex={1}
                      value={providerSettings?.apiKey || ''}
                      onChange={handleApiKeyChange}
                      placeholder={
                        baseInfo.id === ModelProviderEnum.Qwen ? getQwenKeyPlaceholder(providerSettings) : undefined
                      }
                    />
                    <Tooltip
                      disabled={(!!providerSettings?.apiKey || isSubscriptionOAuthSignedIn) && displayModels.length > 0}
                      label={
                        !providerSettings?.apiKey && !isSubscriptionOAuthSignedIn
                          ? t('API Key is required to check connection')
                          : displayModels.length === 0
                            ? t('Add at least one model to check connection')
                            : null
                      }
                    >
                      <Button
                        size="sm"
                        variant="default"
                        disabled={
                          (!providerSettings?.apiKey && !isSubscriptionOAuthSignedIn) || displayModels.length === 0
                        }
                        loading={modelTestResult?.testing || false}
                        onClick={() => setShowTestModelSelector(true)}
                      >
                        {t('Check')}
                      </Button>
                    </Tooltip>
                  </Flex>
                  {baseInfo.id === ModelProviderEnum.Qwen && (
                    <span className="settings-field-hint">
                      {t('Token Plan and Coding Plan keys start with sk-sp- and only work with the matching endpoint.')}
                    </span>
                  )}
                  {baseInfo.urls?.apiKey &&
                    baseInfo.id !== ModelProviderEnum.Qwen &&
                    baseInfo.id !== ModelProviderEnum.XAI &&
                    baseInfo.id !== ModelProviderEnum.OpenAI &&
                    baseInfo.id !== ModelProviderEnum.Gemini && (
                      <Button
                        variant="subtle"
                        size="compact-xs"
                        className="self-start"
                        leftSection={<ScalableIcon icon={IconExternalLink} size={14} />}
                        onClick={() => platform.openLink(baseInfo.urls!.apiKey!)}
                      >
                        {t('Get API Key')}
                      </Button>
                    )}
                </div>
              )}

              {/* Subscription OAuth: Check connection without API key field */}
              {isSubscriptionOAuthMode && (
                <div className="settings-field">
                  <span className="settings-field-label">{t('Connection')}</span>
                  <Flex gap="xs" align="center" wrap="wrap">
                    <Tooltip
                      disabled={isSubscriptionOAuthSignedIn && displayModels.length > 0}
                      label={
                        !isSubscriptionOAuthSignedIn
                          ? t('Sign in to check connection')
                          : displayModels.length === 0
                            ? t('Add at least one model to check connection')
                            : null
                      }
                    >
                      <Button
                        size="sm"
                        variant="default"
                        disabled={!isSubscriptionOAuthSignedIn || displayModels.length === 0}
                        loading={modelTestResult?.testing || false}
                        onClick={() => setShowTestModelSelector(true)}
                      >
                        {t('Check')}
                      </Button>
                    </Tooltip>
                    {isXaiOAuthMode && resolveXaiBearer(providerSettings) ? (
                      <Text size="xs" c="chatbox-tertiary">
                        {t('Uses your SuperGrok / X Premium session')}
                      </Text>
                    ) : null}
                    {isOpenAICodexOAuthMode && resolveOpenAIBearer(providerSettings) ? (
                      <Text size="xs" c="chatbox-tertiary">
                        {t('Uses your ChatGPT subscription')}
                      </Text>
                    ) : null}
                    {isGeminiAntigravityOAuthMode && resolveGeminiCredential(providerSettings) ? (
                      <Text size="xs" c="chatbox-tertiary">
                        {t('Uses your Google / Antigravity session')}
                      </Text>
                    ) : null}
                  </Flex>
                </div>
              )}
            </div>
          </SettingsCard>
        </SettingsSection>

        {usageStatus && (
          <SettingsSection
            title={t('Plan & usage')}
            description={t(
              'In this app usage is measured here. Provider plan remaining is best-effort and often unknown.'
            )}
          >
            <ProviderUsageCard
              status={usageStatus}
              onRefresh={() => void refreshUsage(true)}
              refreshing={usageLoading}
            />
          </SettingsSection>
        )}

        {((!isNoApiKeyProvider && !isSubscriptionOAuthMode) || showBuiltinApiHostSection) && (
          <SettingsCollapsible
            title={t('Advanced')}
            description={t('API host, Cloudflare Access, and other optional connection settings.')}
            badge={t('Advanced')}
            defaultOpen={Boolean(
              providerSettings?.cloudflareClientId ||
                providerSettings?.cloudflareClientSecret ||
                (showBuiltinApiHostSection &&
                  providerSettings?.apiHost &&
                  providerSettings.apiHost !== baseInfo.defaultSettings?.apiHost)
            )}
          >
            <SettingsCard>
              <div className="settings-card-fields">
                {showBuiltinApiHostSection && (
                  <div className="settings-field">
                    <span className="settings-field-label">{t('API Host')}</span>
                    <TextInput
                      value={providerSettings?.apiHost}
                      placeholder={baseInfo.defaultSettings?.apiHost}
                      onChange={handleApiHostChange}
                    />
                    <span className="settings-field-hint">
                      {isBuiltinOpenAICompatible
                        ? normalizeOpenAIApiHostAndPath({
                            apiHost: providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost,
                            apiPath:
                              baseInfo.id === ModelProviderEnum.OpenClaw
                                ? providerSettings?.apiPath || baseInfo.defaultSettings?.apiPath
                                : undefined,
                          }).apiHost +
                          normalizeOpenAIApiHostAndPath({
                            apiHost: providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost,
                            apiPath:
                              baseInfo.id === ModelProviderEnum.OpenClaw
                                ? providerSettings?.apiPath || baseInfo.defaultSettings?.apiPath
                                : undefined,
                          }).apiPath
                        : ''}
                      {baseInfo.id === ModelProviderEnum.OpenAIResponses
                        ? normalizeOpenAIResponsesHostAndPath({
                            apiHost: providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost,
                            apiPath: providerSettings?.apiPath || baseInfo.defaultSettings?.apiPath,
                          }).apiHost +
                          normalizeOpenAIResponsesHostAndPath({
                            apiHost: providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost,
                            apiPath: providerSettings?.apiPath || baseInfo.defaultSettings?.apiPath,
                          }).apiPath
                        : ''}
                      {baseInfo.id === ModelProviderEnum.Claude
                        ? normalizeClaudeHost(providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost || '')
                            .apiHost +
                          normalizeClaudeHost(providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost || '')
                            .apiPath
                        : ''}
                      {baseInfo.id === ModelProviderEnum.Gemini
                        ? normalizeGeminiHost(providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost || '')
                            .apiHost +
                          normalizeGeminiHost(providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost || '')
                            .apiPath
                        : ''}
                    </span>
                  </div>
                )}
                {!isNoApiKeyProvider && !isSubscriptionOAuthMode && (
                  <>
                    <div className="settings-field">
                      <span className="settings-field-label">{t('Cloudflare Client ID')}</span>
                      <TextInput
                        value={providerSettings?.cloudflareClientId || ''}
                        placeholder={t('Optional')}
                        onChange={handleCloudflareClientIdChange}
                      />
                    </div>
                    <div className="settings-field">
                      <span className="settings-field-label">{t('Cloudflare Client Secret')}</span>
                      <PasswordInput
                        value={providerSettings?.cloudflareClientSecret || ''}
                        placeholder={t('Optional')}
                        onChange={handleCloudflareClientSecretChange}
                      />
                    </div>
                  </>
                )}
              </div>
            </SettingsCard>
          </SettingsCollapsible>
        )}

        {baseInfo.id === ModelProviderEnum.OpenAI && !baseInfo.isCustom && (
          <ImagePromptPrependSection providerSettings={providerSettings} setProviderSettings={setProviderSettings} />
        )}

        {baseInfo.id === ModelProviderEnum.OpenClaw && (
          <Stack gap="xxs">
            <Text span fw="600">
              {t('OpenClaw Health Check')}
            </Text>
            <Flex gap="xs" align="center">
              <Button variant="light" onClick={checkOpenClawHealth} loading={checkingOpenClawHealth}>
                {t('Check Health')}
              </Button>
              {typeof openClawHealthy === 'boolean' ? (
                <Badge color={openClawHealthy ? 'green' : 'red'} variant="light">
                  {openClawHealthy ? t('Running') : t('Unavailable')}
                </Badge>
              ) : null}
            </Flex>
            <Text size="xs" c="chatbox-secondary">
              {t('Uses the local OpenClaw health endpoint at /health.')}
            </Text>
          </Stack>
        )}

        {baseInfo.id === ModelProviderEnum.OpenClaw && (
          <OpenClawGatewaySettings
            gatewayUrl={providerSettings?.apiHost?.replace(/\/v1$/, '') || 'http://127.0.0.1:18789'}
            authToken={providerSettings?.apiKey || ''}
            cloudflareClientId={providerSettings?.cloudflareClientId || ''}
            cloudflareClientSecret={providerSettings?.cloudflareClientSecret || ''}
            onGatewayUrlChange={(value) => setProviderSettings({ apiHost: value })}
            onAuthTokenChange={(value) => setProviderSettings({ apiKey: value })}
            onCloudflareClientIdChange={(value) => setProviderSettings({ cloudflareClientId: value })}
            onCloudflareClientSecretChange={(value) => setProviderSettings({ cloudflareClientSecret: value })}
          />
        )}

        {baseInfo.isCustom && (
          <>
            {/* custom provider api host & path */}
            <Stack gap="xs">
              <Flex gap="sm">
                <Stack gap="xxs" flex={3}>
                  <Flex justify="space-between" align="flex-end" gap="md">
                    <Text span fw="600" className=" whitespace-nowrap">
                      {t('API Host')}
                    </Text>
                  </Flex>
                  <Flex gap="xs" align="center">
                    <TextInput
                      flex={1}
                      value={providerSettings?.apiHost}
                      placeholder={baseInfo.defaultSettings?.apiHost}
                      onChange={handleApiHostChange}
                    />
                  </Flex>
                </Stack>

                <Stack gap="xxs" flex={2}>
                  <Flex justify="space-between" align="flex-end" gap="md">
                    <Text span fw="600" className=" whitespace-nowrap">
                      {t('API Path')}
                    </Text>
                  </Flex>
                  <Flex gap="xs" align="center">
                    <TextInput
                      flex={1}
                      value={providerSettings?.apiPath}
                      onChange={handleApiPathChange}
                      placeholder={normalizeAPIHost(providerSettings, baseInfo.type).apiPath}
                    />
                  </Flex>
                </Stack>
              </Flex>
              <Text span size="xs" flex="0 1 auto" c="chatbox-secondary">
                {normalizeAPIHost(providerSettings, baseInfo.type).apiHost +
                  normalizeAPIHost(providerSettings, baseInfo.type).apiPath}
              </Text>
              {providerSettings?.apiHost?.includes('aihubmix.com') && (
                <Flex align="center" gap={4}>
                  <ScalableIcon icon={IconDiscount2} size={14} color="var(--chatbox-tint-tertiary)" />
                  <Text span size="xs" c="chatbox-tertiary">
                    {t('AIHubMix integration in Chaeboxi offers 10% discount')}
                  </Text>
                </Flex>
              )}
            </Stack>

            <Switch
              label={t('Improve Network Compatibility')}
              checked={providerSettings?.useProxy || false}
              onChange={(e) =>
                setProviderSettings({
                  useProxy: e.currentTarget.checked,
                })
              }
            />

            <Stack gap="xs">
              <Text span fw="600" className=" whitespace-nowrap">
                {t('Improve Network Compatibility')}
              </Text>
            </Stack>
          </>
        )}

        {/* useProxy for Ollama */}
        {baseInfo.id === ModelProviderEnum.Ollama && (
          <Switch
            label={t('Improve Network Compatibility')}
            checked={providerSettings?.useProxy || false}
            onChange={(e) =>
              setProviderSettings({
                useProxy: e.currentTarget.checked,
              })
            }
          />
        )}

        {baseInfo.id === ModelProviderEnum.Azure && (
          <>
            {/* Azure Endpoint */}
            <Stack gap="xxs">
              <Text span fw="600">
                {t('Azure Endpoint')}
              </Text>
              <Flex gap="xs" align="center">
                <TextInput
                  flex={1}
                  value={providerSettings?.endpoint}
                  placeholder="https://<resource_name>.openai.azure.com/"
                  onChange={(e) =>
                    setProviderSettings({
                      endpoint: e.currentTarget.value,
                    })
                  }
                />
              </Flex>
              <Text span size="xs" flex="0 1 auto" c="chatbox-secondary">
                {baseInfo.id === ModelProviderEnum.Azure
                  ? normalizeAzureEndpoint(providerSettings?.endpoint || baseInfo.defaultSettings?.endpoint || '')
                      .endpoint +
                    normalizeAzureEndpoint(providerSettings?.endpoint || baseInfo.defaultSettings?.endpoint || '')
                      .apiPath
                  : ''}
              </Text>
            </Stack>
            {/* Azure API Version */}
            <Stack gap="xxs">
              <Text span fw="600">
                {t('Azure API Version')}
              </Text>
              <Flex gap="xs" align="center">
                <TextInput
                  flex={1}
                  value={providerSettings?.apiVersion}
                  placeholder="2024-05-01-preview"
                  onChange={(e) =>
                    setProviderSettings({
                      apiVersion: e.currentTarget.value,
                    })
                  }
                />
              </Flex>
            </Stack>
          </>
        )}

        {baseInfo.id === ModelProviderEnum.ComfyUI && (
          <ComfyUISettingsSection providerSettings={providerSettings} setProviderSettings={setProviderSettings} />
        )}

        {/* Models */}
        <SettingsSection title={t('Models')}>
          <SettingsCard>
            <div className="settings-card-fields">
              <div className="settings-actions" style={{ justifyContent: 'flex-end' }}>
                <Button
                  variant="default"
                  size="compact-sm"
                  onClick={handleAddModel}
                  leftSection={<ScalableIcon icon={IconPlus} size={14} />}
                >
                  {t('New')}
                </Button>
                <Button
                  variant="default"
                  size="compact-sm"
                  onClick={resetModels}
                  leftSection={<ScalableIcon icon={IconRestore} size={14} />}
                >
                  {t('Reset')}
                </Button>
                <Button
                  loading={fetchingModels}
                  variant="default"
                  size="compact-sm"
                  onClick={handleFetchModels}
                  leftSection={<ScalableIcon icon={IconRefresh} size={14} />}
                >
                  {t('Fetch')}
                </Button>
              </div>
              <ModelList
                models={displayModels}
                showActions={true}
                showSearch={false}
                onEditModel={editModel}
                onDeleteModel={deleteModel}
              />
            </div>
          </SettingsCard>
        </SettingsSection>

        <AdaptiveModal
          keepMounted={false}
          opened={!!fetchedModels}
          onClose={() => {
            setFetchedModels(undefined)
          }}
          title={t('Models')}
          centered={true}
        >
          <ModelList
            models={fetchedModels || []}
            showActions={true}
            showSearch={true}
            displayedModelIds={displayModels.map((m) => m.modelId)}
            onAddModel={(model) => setProviderSettings({ models: [...displayModels, model] })}
            onRemoveModel={(modelId) =>
              setProviderSettings({ models: displayModels.filter((m) => m.modelId !== modelId) })
            }
          />
        </AdaptiveModal>

        {/* Test Model Selector Modal */}
        <AdaptiveModal
          opened={showTestModelSelector}
          onClose={() => setShowTestModelSelector(false)}
          title={t('Select Test Model')}
          centered={true}
          size="md"
        >
          <Stack gap="xs">
            {displayModels.length > 0 ? (
              displayModels.map((model) => (
                <Button
                  key={model.modelId}
                  variant="light"
                  fullWidth
                  onClick={async () => {
                    setSelectedTestModel(model.modelId)
                    setShowTestModelSelector(false)
                    // (legacy comment removed)
                    await handleCheckApiKey(model.modelId)
                  }}
                  styles={{
                    root: {
                      justifyContent: 'flex-start',
                    },
                  }}
                >
                  {model.nickname || model.modelId}
                </Button>
              ))
            ) : (
              <Text c="chatbox-secondary" ta="center" py="md">
                {t('No models available')}
              </Text>
            )}
          </Stack>
        </AdaptiveModal>

        {/* Model Test Result Modal */}
        <AdaptiveModal
          opened={!!modelTestResult}
          onClose={() => setModelTestResult(null)}
          title={t('Model Test Results')}
          centered={true}
          size="md"
        >
          {modelTestResult && (
            <Stack gap="md">
              <Text size="lg" fw={500}>
                {modelTestResult.modelName}
              </Text>

              <Stack gap="sm">
                {/* Basic Test */}
                {modelTestResult.basicTest?.status === 'success' ? (
                  <>
                    <Text span c="chatbox-success">
                      {t('Connection successful!')}
                    </Text>
                    <Flex
                      direction="column"
                      gap="md"
                      bg="var(--chatbox-background-secondary)"
                      bd="1px solid var(--chatbox-border-primary)"
                      p="xs"
                    >
                      <Flex align="center" gap="xs">
                        <Text style={{ minWidth: '120px' }}>{t('Text Request')}:</Text>
                        <ScalableIcon icon={IconCircleCheck} color="var(--chatbox-tint-success)" />
                      </Flex>
                      {/* Vision Test */}
                      <Flex align="center" gap="xs">
                        <Text style={{ minWidth: '120px' }}>{t('Vision Request')}:</Text>
                        {modelTestResult.visionTest?.status === 'success' ? (
                          <ScalableIcon icon={IconCircleCheck} color="var(--chatbox-tint-success)" />
                        ) : modelTestResult.visionTest?.status === 'error' ? (
                          <Flex align="center" gap="xs" maw={400}>
                            <Tooltip label={modelTestResult.visionTest.error} multiline>
                              <ScalableIcon icon={IconX} className="cursor-help" color="var(--chatbox-tint-error)" />
                            </Tooltip>
                            <Text>{t('This model does not support vision')}</Text>
                          </Flex>
                        ) : (
                          <Flex align="center" gap="xs">
                            <Loader size="xs" />
                            <Text c="chatbox-tertiary" size="sm">
                              {t('Testing...')}
                            </Text>
                          </Flex>
                        )}
                      </Flex>

                      {/* Tool Use Test */}
                      <Flex align="center" gap="xs">
                        <Text style={{ minWidth: '120px' }}>{t('Tool Use Request')}:</Text>
                        {modelTestResult.toolTest?.status === 'success' ? (
                          <ScalableIcon icon={IconCircleCheck} color="var(--chatbox-tint-success)" />
                        ) : modelTestResult.toolTest?.status === 'error' ? (
                          <Flex align="center" gap="xs" maw={400}>
                            <Tooltip label={modelTestResult.toolTest.error} multiline>
                              <ScalableIcon icon={IconX} className="cursor-help" color="var(--chatbox-tint-error)" />
                            </Tooltip>
                            <Text>{t('This model does not support tool use')}</Text>
                          </Flex>
                        ) : (
                          <Flex align="center" gap="xs">
                            <Loader size="xs" />
                            <Text c="chatbox-tertiary" size="sm">
                              {t('Testing...')}
                            </Text>
                          </Flex>
                        )}
                      </Flex>
                    </Flex>
                  </>
                ) : modelTestResult.basicTest?.status === 'error' ? (
                  <Flex align="center" gap="xs" className="w-full">
                    <Text span c="chatbox-error" maw="100%">
                      {t('Connection failed!')}
                      <div className="bg-red-50 dark:bg-red-900/20 px-2 py-2">
                        <Text size="xs" c="chatbox-error">
                          {modelTestResult.basicTest.error}
                        </Text>
                      </div>
                    </Text>
                  </Flex>
                ) : (
                  <Flex align="center" gap="xs">
                    <Loader size="xs" />
                    <Text c="chatbox-tertiary" size="sm">
                      {t('Testing...')}
                    </Text>
                  </Flex>
                )}
              </Stack>
            </Stack>
          )}
          <AdaptiveModal.Actions>
            <Button mt="md" onClick={() => setModelTestResult(null)}>
              {t('Confirm')}
            </Button>
          </AdaptiveModal.Actions>
        </AdaptiveModal>
      </Stack>
    </SettingsPage>
  )
}

/* ============================================
   ComfyUI Settings Section
   ============================================ */

function ComfyUISettingsSection({
  providerSettings,
  setProviderSettings,
}: {
  providerSettings: any
  setProviderSettings: (val: any) => void
}) {
  const { t } = useTranslation()
  const { checkpoints, loras, samplers, schedulers, isLoading, refetch } = useComfyUIInfo()
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null)
  const configuredLoras = getComfyUILoras(providerSettings)
  const availableLoras = loras.filter((lora) => lora !== 'none')

  const updateComfyUILoras = (nextLoras: ComfyUILoraConfig[]) => {
    setProviderSettings({
      comfyuiLoras: nextLoras,
      comfyuiLora: undefined,
      comfyuiLoraStrength: undefined,
    })
  }

  const handleTestConnection = async () => {
    const apiHost = providerSettings?.apiHost || 'http://127.0.0.1:8188'
    setTestingConnection(true)
    setConnectionStatus(null)
    try {
      const client = new ComfyUIClient(apiHost)
      const ok = await client.testConnection()
      setConnectionStatus(ok)
      if (ok) {
        refetch()
      }
    } catch {
      setConnectionStatus(false)
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <>
      {/* Server URL */}
      <Stack gap="xxs">
        <Text span fw="600">
          {t('ComfyUI Server URL')}
        </Text>
        <Flex gap="xs" align="center">
          <TextInput
            flex={1}
            value={providerSettings?.apiHost || ''}
            placeholder="http://192.168.1.100:8188"
            onChange={(e) => setProviderSettings({ apiHost: e.currentTarget.value })}
          />
          <Button size="sm" loading={testingConnection} onClick={handleTestConnection}>
            {t('Test Connection')}
          </Button>
        </Flex>
        <Flex align="center" gap="xs">
          {connectionStatus === true && (
            <Badge color="green" variant="light" size="sm">
              {t('Connected')}
            </Badge>
          )}
          {connectionStatus === false && (
            <Badge color="red" variant="light" size="sm">
              {t('Connection failed')}
            </Badge>
          )}
          <Text size="xs" c="chatbox-tertiary">
            {t('Web mode requires ComfyUI started with --enable-cors-header')}
          </Text>
        </Flex>
      </Stack>

      {/* Checkpoint */}
      <Stack gap="xxs">
        <Text span fw="600">
          {t('Checkpoint')}
        </Text>
        {checkpoints.length > 0 ? (
          <Select
            value={providerSettings?.comfyuiCheckpoint || ''}
            data={checkpoints}
            onChange={(val) => setProviderSettings({ comfyuiCheckpoint: val })}
            searchable
            placeholder={String(t('Select checkpoint'))}
          />
        ) : (
          <TextInput
            value={providerSettings?.comfyuiCheckpoint || ''}
            placeholder="waiNSFWIllustrious_v140.safetensors"
            onChange={(e) => setProviderSettings({ comfyuiCheckpoint: e.currentTarget.value })}
          />
        )}
        {isLoading && (
          <Text size="xs" c="chatbox-tertiary">
            {t('Loading available checkpoints from server...')}
          </Text>
        )}
      </Stack>

      {/* LoRA */}
      <Stack gap="xxs">
        <Text span fw="600">
          {t('LoRAs')}
        </Text>
        <Text size="xs" c="chatbox-tertiary">
          {t('LoRAs are chained in order from top to bottom.')}
        </Text>
        {configuredLoras.map((lora, index) => (
          <Flex key={`${lora.name || 'lora'}-${index}`} gap="sm" align="flex-end" wrap="wrap">
            <Stack gap="xxs" flex={3}>
              <Text size="xs" c="chatbox-tertiary">
                {t('LoRA')}
              </Text>
              {availableLoras.length > 0 ? (
                <Select
                  value={lora.name}
                  data={availableLoras}
                  onChange={(val) => {
                    const nextLoras = [...configuredLoras]
                    nextLoras[index] = { ...nextLoras[index], name: val || '' }
                    updateComfyUILoras(nextLoras)
                  }}
                  searchable
                  placeholder={String(t('Select LoRA'))}
                />
              ) : (
                <TextInput
                  value={lora.name}
                  placeholder="anime-detailer.safetensors"
                  onChange={(e) => {
                    const nextLoras = [...configuredLoras]
                    nextLoras[index] = { ...nextLoras[index], name: e.currentTarget.value }
                    updateComfyUILoras(nextLoras)
                  }}
                />
              )}
            </Stack>
            <NumberInput
              label={t('Model Strength')}
              min={0}
              max={2}
              step={0.05}
              decimalScale={2}
              value={lora.strengthModel ?? 1}
              onChange={(val) => {
                const nextLoras = [...configuredLoras]
                nextLoras[index] = {
                  ...nextLoras[index],
                  strengthModel: typeof val === 'number' ? val : 1,
                }
                updateComfyUILoras(nextLoras)
              }}
              styles={{ root: { flex: 1, minWidth: 140 } }}
            />
            <NumberInput
              label={t('CLIP Strength')}
              min={0}
              max={2}
              step={0.05}
              decimalScale={2}
              value={lora.strengthClip ?? 1}
              onChange={(val) => {
                const nextLoras = [...configuredLoras]
                nextLoras[index] = {
                  ...nextLoras[index],
                  strengthClip: typeof val === 'number' ? val : 1,
                }
                updateComfyUILoras(nextLoras)
              }}
              styles={{ root: { flex: 1, minWidth: 140 } }}
            />
            <Button
              variant="subtle"
              color="red"
              px="xs"
              onClick={() => updateComfyUILoras(configuredLoras.filter((_, itemIndex) => itemIndex !== index))}
            >
              <IconTrash size={16} />
            </Button>
          </Flex>
        ))}
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => updateComfyUILoras([...configuredLoras, { ...DEFAULT_COMFYUI_LORA }])}
        >
          {t('Add LoRA')}
        </Button>
      </Stack>

      <ImagePromptPrependSection providerSettings={providerSettings} setProviderSettings={setProviderSettings} />

      <Stack gap="sm">
        <Switch
          checked={providerSettings?.agentImageFlowEnabled || false}
          onChange={(event) =>
            setProviderSettings({
              agentImageFlowEnabled: event.currentTarget.checked,
            })
          }
          label={t('Enable agent research-to-ComfyUI flow')}
        />
        <Text size="xs" c="chatbox-secondary">
          {t('When enabled, agent mode can research allowed art sites, normalize tags, and auto-start ComfyUI.')}
        </Text>
      </Stack>

      <Stack gap="xxs">
        <Text span fw="600">
          {t('Agent Research Domains')}
        </Text>
        <DomainListTextarea
          value={providerSettings?.agentImageResearchDomains || []}
          onChange={(domains) => setProviderSettings({ agentImageResearchDomains: domains })}
          placeholder={'danbooru.donmai.us\npixiv.net'}
        />
        <Text size="xs" c="chatbox-secondary">
          {t('One domain per line or comma-separated. The agent will restrict research to these domains.')}
        </Text>
      </Stack>

      <Stack gap="xxs">
        <Text span fw="600">
          {t('Agent Tag Normalization Prompt')}
        </Text>
        <Textarea
          autosize
          minRows={4}
          maxRows={10}
          value={providerSettings?.agentImageNormalizationPrompt || ''}
          placeholder={String(t('Describe how the agent should convert research into reusable Danbooru-style tags.'))}
          onChange={(e) =>
            setProviderSettings({
              agentImageNormalizationPrompt: e.currentTarget.value,
            })
          }
        />
        <Text size="xs" c="chatbox-secondary">
          {t('This prompt is injected only for the opt-in agent image flow.')}
        </Text>
      </Stack>

      {/* Default Negative Prompt */}
      <Stack gap="xxs">
        <Text span fw="600">
          {t('Default Negative Prompt')}
        </Text>
        <Textarea
          value={providerSettings?.comfyuiNegativePrompt || ''}
          placeholder="worst quality, low quality, watermark..."
          onChange={(e) => setProviderSettings({ comfyuiNegativePrompt: e.currentTarget.value })}
          minRows={2}
          maxRows={4}
          autosize
        />
      </Stack>

      {/* Default Generation Params */}
      <Stack gap="xxs">
        <Text span fw="600">
          {t('Default Generation Settings')}
        </Text>
        <Flex gap="sm">
          <NumberInput
            label={t('Steps')}
            flex={1}
            min={1}
            max={100}
            value={providerSettings?.comfyuiDefaultSteps ?? 29}
            onChange={(val) => setProviderSettings({ comfyuiDefaultSteps: typeof val === 'number' ? val : 29 })}
          />
          <NumberInput
            label={t('CFG Scale')}
            flex={1}
            min={1}
            max={30}
            step={0.1}
            decimalScale={1}
            value={providerSettings?.comfyuiDefaultCfg ?? 4.9}
            onChange={(val) => setProviderSettings({ comfyuiDefaultCfg: typeof val === 'number' ? val : 4.9 })}
          />
        </Flex>
        <Flex gap="sm">
          {samplers.length > 0 ? (
            <Select
              label={t('Sampler')}
              flex={1}
              data={samplers}
              value={providerSettings?.comfyuiDefaultSampler || 'euler_ancestral'}
              onChange={(val) => setProviderSettings({ comfyuiDefaultSampler: val })}
              searchable
            />
          ) : (
            <TextInput
              label={t('Sampler')}
              flex={1}
              value={providerSettings?.comfyuiDefaultSampler || 'euler_ancestral'}
              onChange={(e) => setProviderSettings({ comfyuiDefaultSampler: e.currentTarget.value })}
            />
          )}
          {schedulers.length > 0 ? (
            <Select
              label={t('Scheduler')}
              flex={1}
              data={schedulers}
              value={providerSettings?.comfyuiDefaultScheduler || 'simple'}
              onChange={(val) => setProviderSettings({ comfyuiDefaultScheduler: val })}
              searchable
            />
          ) : (
            <TextInput
              label={t('Scheduler')}
              flex={1}
              value={providerSettings?.comfyuiDefaultScheduler || 'simple'}
              onChange={(e) => setProviderSettings({ comfyuiDefaultScheduler: e.currentTarget.value })}
            />
          )}
        </Flex>
      </Stack>
    </>
  )
}
