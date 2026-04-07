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
  Title,
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
  IconHelpCircle,
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
import { getModelSettingUtil } from '@/packages/model-setting-utils'
import platform from '@/platform'
import { useLanguage, useProviderSettings, useSettingsStore } from '@/stores/settingsStore'
import { add as addToast } from '@/stores/toastActions'
import { type ModelTestState, testModelCapabilities } from '@/utils/model-tester'
import { useComfyUIInfo } from '@/hooks/useComfyUIInfo'
import { ComfyUIClient } from '@shared/providers/definitions/models/comfyui-client'

export const Route = createFileRoute('/settings/provider/$providerId')({
  component: RouteComponent,
})

type ModelTestResult = ModelTestState & {
  modelId: string
  modelName: string
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

  const language = useLanguage()

  const baseInfo = [...SystemProviders(), ...(settings.customProviders || [])].find((p) => p.id === providerId)

  const { providerSettings, setProviderSettings } = useProviderSettings(providerId)

  const displayModels = providerSettings?.models || baseInfo?.defaultSettings?.models || []
  const isNoApiKeyProvider = [ModelProviderEnum.Ollama, ModelProviderEnum.LMStudio, ModelProviderEnum.OpenClaw, ModelProviderEnum.ComfyUI].includes(
    baseInfo?.id as ModelProviderEnum
  )
  const isBuiltinOpenAICompatible =
    !!baseInfo && !baseInfo.isCustom && baseInfo.type === ModelProviderType.OpenAI && baseInfo.id !== ModelProviderEnum.Azure
  const showBuiltinApiHostSection =
    isBuiltinOpenAICompatible ||
    [ModelProviderEnum.OpenAIResponses, ModelProviderEnum.Claude, ModelProviderEnum.Gemini].includes(
      baseInfo?.id as ModelProviderEnum
    )

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
    setProviderSettings({
      models: baseInfo?.defaultSettings?.models,
    })
  }

  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<ProviderModelInfo[]>()

  const handleFetchModels = async () => {
    try {
      setFetchedModels(undefined)
      setFetchingModels(true)
      const modelConfig = getModelSettingUtil(baseInfo!.id, baseInfo!.isCustom ? baseInfo!.type : undefined)
      const modelList = await modelConfig.getMergeOptionGroups({
        ...baseInfo?.defaultSettings,
        ...providerSettings,
      })

      if (modelList.length) {
        setFetchedModels(modelList)
      } else {
        addToast(t('Failed to fetch models'))
      }
      setFetchingModels(false)
    } catch (error) {
      console.error('Failed to fetch models', error)
      setFetchedModels(undefined)
      setFetchingModels(false)
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
    <Stack key={baseInfo.id} gap="xxl">
      <Flex gap="xs" align="center">
        <Title order={3} c="chatbox-secondary">
          {t(baseInfo.name)}
        </Title>
        {baseInfo.urls?.website && (
          <Button
            variant="transparent"
            c="chatbox-tertiary"
            px={0}
            h={24}
            onClick={() => platform.openLink(baseInfo.urls!.website!)}
          >
            <ScalableIcon icon={IconExternalLink} size={24} />
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
              variant="transparent"
              size="compact-xs"
              leftSection={<ScalableIcon icon={IconTrash} size={24} />}
              color="chatbox-error"
            ></Button>
          </PopoverConfirm>
        )}
      </Flex>
      {baseInfo.isCustom && language === 'zh-Hans' && (
        <Flex>
          <ScalableIcon icon={IconHelpCircle} />
          <Text span size="xs" c="chatbox-tertiary">
            <a href="https://docs.chatboxai.app/guides/providers" target="_blank" rel="noopener">
              {t('Setup guide')}
            </a>
          </Text>
        </Flex>
      )}

      <Stack gap="xl">
        {/* custom provider base info */}
        {baseInfo.isCustom && (
          <>
            <Stack gap="xxs">
              <Text span fw="600">
                {t('Name')}
              </Text>
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
            </Stack>

            <Stack gap="xxs">
              <Text span fw="600">
                {t('API Mode')}
              </Text>
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
            </Stack>
          </>
        )}

        {/* Provider description */}
        {baseInfo.description && (
          <Stack gap="xxs">
            <Text span size="xs" c="chatbox-tertiary">
              {t(baseInfo.description)}
            </Text>
          </Stack>
        )}

        {/* API Key */}
        {!isNoApiKeyProvider && (
          <Stack gap="xxs">
            <Text span fw="600">
              {t('API Key')}
            </Text>
            <Flex gap="xs" align="center">
              <PasswordInput flex={1} value={providerSettings?.apiKey || ''} onChange={handleApiKeyChange} />
              <Tooltip
                disabled={!!providerSettings?.apiKey && displayModels.length > 0}
                label={
                  !providerSettings?.apiKey
                    ? t('API Key is required to check connection')
                    : displayModels.length === 0
                      ? t('Add at least one model to check connection')
                      : null
                }
              >
                <Button
                  size="sm"
                  disabled={!providerSettings?.apiKey || displayModels.length === 0}
                  loading={modelTestResult?.testing || false}
                  onClick={() => setShowTestModelSelector(true)}
                >
                  {t('Check')}
                </Button>
              </Tooltip>
            </Flex>
          </Stack>
        )}

        {!isNoApiKeyProvider && (
          <Stack gap="xxs">
            <Text span fw="600">
              {t('Cloudflare Client ID')}
            </Text>
            <TextInput
              flex={1}
              value={providerSettings?.cloudflareClientId || ''}
              placeholder="Optional"
              onChange={handleCloudflareClientIdChange}
            />
          </Stack>
        )}

        {!isNoApiKeyProvider && (
          <Stack gap="xxs">
            <Text span fw="600">
              {t('Cloudflare Client Secret')}
            </Text>
            <PasswordInput
              flex={1}
              value={providerSettings?.cloudflareClientSecret || ''}
              placeholder="Optional"
              onChange={handleCloudflareClientSecretChange}
            />
          </Stack>
        )}

        {/* API Host */}
        {showBuiltinApiHostSection && (
          <Stack gap="xxs">
            <Flex justify="space-between" align="flex-end" gap="md">
              <Text span fw="600" className=" whitespace-nowrap">
                {t('API Host')}
              </Text>
              {/* <Text span size="xs" flex="0 1 auto" c="chatbox-secondary" lineClamp={1}>
                {t('Ending with / ignores v1, ending with # forces use of input address')}
              </Text> */}
            </Flex>
            <Flex gap="xs" align="center">
              <TextInput
                flex={1}
                value={providerSettings?.apiHost}
                placeholder={baseInfo.defaultSettings?.apiHost}
                onChange={handleApiHostChange}
              />
            </Flex>
            <Text span size="xs" flex="0 1 auto" c="chatbox-secondary">
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
                ? normalizeClaudeHost(providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost || '').apiHost +
                  normalizeClaudeHost(providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost || '').apiPath
                : ''}
              {baseInfo.id === ModelProviderEnum.Gemini
                ? normalizeGeminiHost(providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost || '').apiHost +
                  normalizeGeminiHost(providerSettings?.apiHost || baseInfo.defaultSettings?.apiHost || '').apiPath
                : ''}
            </Text>
          </Stack>
        )}

        {baseInfo.id === ModelProviderEnum.OpenAI && !baseInfo.isCustom && (
          <Stack gap="md">
            <Stack gap="xxs">
              <Text span fw="600">
                {t('Image Character Prepend')}
              </Text>
              <Textarea
                autosize
                minRows={2}
                value={providerSettings?.imagePromptCharacterPrepend || ''}
                placeholder={t('Character name, traits, outfit, pose, and other reusable character tags')}
                onChange={(e) =>
                  setProviderSettings({
                    imagePromptCharacterPrepend: e.currentTarget.value,
                  })
                }
              />
            </Stack>

            <Stack gap="xxs">
              <Text span fw="600">
                {t('Image Positive Tags Prepend')}
              </Text>
              <Textarea
                autosize
                minRows={2}
                value={providerSettings?.imagePromptPositiveTagsPrepend || ''}
                placeholder={t('Reusable positive quality/style tags')}
                onChange={(e) =>
                  setProviderSettings({
                    imagePromptPositiveTagsPrepend: e.currentTarget.value,
                  })
                }
              />
            </Stack>

            <Text size="xs" c="chatbox-secondary">
              {t('These values are prepended only for Image Creator requests and do not rewrite saved history prompts.')}
            </Text>
          </Stack>
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
                    {t('AIHubMix integration in Chatbox offers 10% discount')}
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
          <ComfyUISettingsSection
            providerSettings={providerSettings}
            setProviderSettings={setProviderSettings}
          />
        )}

        {/* Models */}
        <Stack gap="xxs">
          <Flex justify="space-between" align="center">
            <Text span fw="600">
              {t('Model')}
            </Text>
            <Flex gap="sm" align="center" justify="flex-end">
              <Button
                variant="light"
                size="compact-xs"
                px="sm"
                onClick={handleAddModel}
                leftSection={<ScalableIcon icon={IconPlus} size={12} />}
              >
                {t('New')}
              </Button>

              <Button
                variant="light"
                color="chatbox-gray"
                c="chatbox-secondary"
                size="compact-xs"
                px="sm"
                onClick={resetModels}
                leftSection={<ScalableIcon icon={IconRestore} size={12} />}
              >
                {t('Reset')}
              </Button>

              <Button
                loading={fetchingModels}
                variant="light"
                color="chatbox-gray"
                c="chatbox-secondary"
                size="compact-xs"
                px="sm"
                onClick={handleFetchModels}
                leftSection={<ScalableIcon icon={IconRefresh} size={12} />}
              >
                {t('Fetch')}
              </Button>
            </Flex>
          </Flex>

          <ModelList
            models={displayModels}
            showActions={true}
            showSearch={false}
            onEditModel={editModel}
            onDeleteModel={deleteModel}
          />
        </Stack>

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
                    // 执行检查
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
    </Stack>
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
          <Button
            size="sm"
            loading={testingConnection}
            onClick={handleTestConnection}
          >
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
            placeholder={t('Select checkpoint')}
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
          {t('LoRA')}
        </Text>
        <Flex gap="sm" align="flex-end">
          <Stack gap="xxs" flex={3}>
            {loras.length > 1 ? (
              <Select
                value={providerSettings?.comfyuiLora || 'none'}
                data={loras}
                onChange={(val) => setProviderSettings({ comfyuiLora: val })}
                searchable
                placeholder={t('Select LoRA')}
              />
            ) : (
              <TextInput
                value={providerSettings?.comfyuiLora || ''}
                placeholder="none"
                onChange={(e) => setProviderSettings({ comfyuiLora: e.currentTarget.value })}
              />
            )}
          </Stack>
          <Stack gap="xxs" flex={2}>
            <Text size="xs" c="chatbox-tertiary">
              {t('LoRA Strength')}
            </Text>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={providerSettings?.comfyuiLoraStrength ?? 1}
              onChange={(val) => setProviderSettings({ comfyuiLoraStrength: val })}
              marks={[
                { value: 0, label: '0' },
                { value: 1, label: '1' },
                { value: 2, label: '2' },
              ]}
              label={(v) => v.toFixed(2)}
              style={{ paddingBottom: 16 }}
            />
          </Stack>
        </Flex>
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
            onChange={(val) =>
              setProviderSettings({ comfyuiDefaultSteps: typeof val === 'number' ? val : 29 })
            }
          />
          <NumberInput
            label={t('CFG Scale')}
            flex={1}
            min={1}
            max={30}
            step={0.1}
            decimalScale={1}
            value={providerSettings?.comfyuiDefaultCfg ?? 4.9}
            onChange={(val) =>
              setProviderSettings({ comfyuiDefaultCfg: typeof val === 'number' ? val : 4.9 })
            }
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
