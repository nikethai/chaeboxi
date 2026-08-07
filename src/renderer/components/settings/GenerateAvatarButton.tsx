/**
 * AI avatar generation — uses configured image-capable providers
 * (Gemini image models, OpenAI gpt-image, xAI Grok Imagine).
 */

import { Button, Flex, Image, Select, Stack, Text, Textarea } from '@mantine/core'
import { getModel } from '@shared/models'
import { IconSparkles } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createModelDependencies } from '@/adapters'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { useProviders } from '@/hooks/useProviders'
import storage from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import { settingsStore } from '@/stores/settingsStore'
import { add as addToast } from '@/stores/toastActions'
import { listAvailableImageModels, parseImageModelValue } from '@/utils/available-image-models'
import { composeImageGenerationPrompt } from '@/utils/imagePrompt'

const DEFAULT_PROMPTS: Record<'user' | 'assistant', string> = {
  user: 'Minimal flat vector avatar icon for a human user, soft rounded face silhouette, calm friendly style, solid background, no text, square composition',
  assistant:
    'Minimal flat vector avatar icon for an AI assistant robot, soft geometric face, friendly modern style, solid background, no text, square composition',
}

function toDataUrl(pic: string): string {
  if (pic.startsWith('data:image/')) return pic
  if (pic.startsWith('data:')) return pic
  return `data:image/png;base64,${pic}`
}

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return fallback
  }
}

export type GenerateAvatarButtonProps = {
  kind: 'user' | 'assistant'
  onSaved: (storageKey: string) => void
}

export const GenerateAvatarButton: FC<GenerateAvatarButtonProps> = ({ kind, onSaved }) => {
  const { t } = useTranslation()
  const { providers } = useProviders()
  const imageModels = useMemo(() => listAvailableImageModels(providers), [providers])

  const [opened, setOpened] = useState(false)
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS[kind])
  const [preview, setPreview] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [modelValue, setModelValue] = useState<string | null>(null)

  const selectData = useMemo(
    () =>
      imageModels.map((m) => ({
        value: m.value,
        label: `${m.providerName} · ${m.displayName}`,
      })),
    [imageModels]
  )

  const pickDefaultModelValue = useCallback(() => {
    if (imageModels.length === 0) return null
    // Prefer xAI Grok Imagine when available (works with SuperGrok OAuth)
    const xai = imageModels.find((m) => m.providerId === 'xAI' && m.modelId.includes('imagine'))
    if (xai) return xai.value
    const last = lastUsedModelStore.getState().picture
    if (last?.provider && last?.modelId) {
      const match = imageModels.find((m) => m.providerId === last.provider && m.modelId === last.modelId)
      if (match) return match.value
    }
    return imageModels[0].value
  }, [imageModels])

  useEffect(() => {
    if (!opened) return
    setModelValue((prev) => {
      if (prev && imageModels.some((m) => m.value === prev)) return prev
      return pickDefaultModelValue()
    })
  }, [opened, imageModels, pickDefaultModelValue])

  const reset = useCallback(() => {
    setPreview(null)
    setPrompt(DEFAULT_PROMPTS[kind])
    setGenerating(false)
    setErrorText(null)
  }, [kind])

  const handleClose = () => {
    setOpened(false)
    reset()
  }

  const handleGenerate = async () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      addToast(t('Enter a prompt first'))
      return
    }

    const parsed = modelValue ? parseImageModelValue(modelValue) : null
    if (!parsed) {
      addToast(t('Select an image model first. Configure Gemini, OpenAI, or xAI image models in Settings → Provider.'))
      return
    }

    setGenerating(true)
    setPreview(null)
    setErrorText(null)
    try {
      const dependencies = await createModelDependencies()

      // Refresh OAuth tokens the same way chat/Imagine do
      const { refreshXaiAuthIfNeeded } = await import('@/utils/xai-auth-refresh')
      const { refreshOpenAICodexAuthIfNeeded } = await import('@/utils/openai-codex-auth-refresh')
      const { refreshGeminiAntigravityAuthIfNeeded } = await import('@/utils/gemini-antigravity-auth-refresh')

      let globalSettings = settingsStore.getState().getSettings()
      globalSettings = await refreshXaiAuthIfNeeded(globalSettings, parsed.providerId)
      globalSettings = await refreshOpenAICodexAuthIfNeeded(globalSettings, parsed.providerId)
      globalSettings = await refreshGeminiAntigravityAuthIfNeeded(globalSettings, parsed.providerId)

      const providerSettings = globalSettings.providers?.[parsed.providerId]
      const finalPrompt = composeImageGenerationPrompt(providerSettings, trimmed)

      const model = getModel(
        {
          provider: parsed.providerId,
          modelId: parsed.modelId,
          imageGenerateNum: 1,
        },
        globalSettings,
        { uuid: '' },
        dependencies
      )

      if (!model?.paint) {
        const msg = t(
          'This model does not support image generation. Pick Gemini Flash Image, gpt-image-1, or grok-imagine-image.'
        )
        setErrorText(msg)
        addToast(msg)
        return
      }

      let firstImage: string | null = null
      const results = await model.paint(
        { prompt: finalPrompt, num: 1, aspectRatio: '1:1' },
        undefined,
        (picBase64: string) => {
          if (!firstImage) {
            firstImage = toDataUrl(picBase64)
            setPreview(firstImage)
          }
        }
      )

      if (!firstImage && results?.[0]) {
        firstImage = toDataUrl(results[0])
        setPreview(firstImage)
      }

      if (!firstImage) {
        const msg = t('Image generation returned no result. Check model access and try another image model.')
        setErrorText(msg)
        addToast(msg)
        return
      }

      lastUsedModelStore.getState().setPictureModel(parsed.providerId, parsed.modelId)
    } catch (error) {
      console.error('Avatar generation failed', error)
      const message = formatError(error, t('Failed to generate avatar'))
      setErrorText(message)
      addToast(message)
    } finally {
      setGenerating(false)
    }
  }

  const handleAccept = async () => {
    if (!preview) return
    const key =
      kind === 'user'
        ? StorageKeyGenerator.picture('user-avatar')
        : StorageKeyGenerator.picture('default-assistant-avatar')
    await storage.setBlob(key, preview)
    onSaved(key)
    handleClose()
    addToast(t('Avatar updated'))
  }

  const noModels = imageModels.length === 0

  return (
    <>
      <Button
        variant="light"
        size="xs"
        leftSection={<IconSparkles size={14} stroke={1.5} />}
        onClick={() => {
          reset()
          setOpened(true)
        }}
        className="active:scale-[0.96] transition-transform"
      >
        {t('Generate with AI')}
      </Button>

      <AdaptiveModal
        opened={opened}
        onClose={handleClose}
        title={t('Generate with AI')}
        centered
        size={440}
        className="app-dialog"
        classNames={{ content: 'app-dialog-content', header: 'app-dialog-header', body: 'app-dialog-body' }}
      >
        <Stack gap="md">
          <Text size="xs" c="chatbox-tertiary">
            {t(
              'Uses image models from your providers (xAI Grok Imagine, Gemini image, OpenAI gpt-image). Preview before saving.'
            )}
          </Text>

          {noModels ? (
            <Stack gap="xs">
              <Text size="sm" c="chatbox-secondary">
                {t(
                  'No image-capable model found. Sign in to xAI (grok-imagine-image) or add Gemini/OpenAI image models under Settings → Provider.'
                )}
              </Text>
              <Button component={Link} to="/settings/provider" variant="light" size="xs" onClick={handleClose}>
                {t('Open Provider Settings')}
              </Button>
            </Stack>
          ) : (
            <Select
              label={t('Image model')}
              data={selectData}
              value={modelValue}
              onChange={setModelValue}
              searchable
              nothingFoundMessage={t('No models')}
              allowDeselect={false}
            />
          )}

          <Textarea
            label={t('Prompt')}
            value={prompt}
            onChange={(e) => setPrompt(e.currentTarget.value)}
            minRows={3}
            autosize
            maxRows={6}
            disabled={noModels}
          />

          {errorText && (
            <Text size="xs" c="red" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {errorText}
            </Text>
          )}

          {preview && (
            <Flex justify="center">
              <Image
                src={preview}
                w={112}
                h={112}
                radius="md"
                alt={t('Preview')}
                style={{
                  outline: '1px solid rgba(0, 0, 0, 0.1)',
                  outlineOffset: 0,
                }}
              />
            </Flex>
          )}
          <Flex gap="xs" justify="flex-end" wrap="wrap">
            <Button variant="default" size="xs" onClick={handleClose}>
              {t('Cancel')}
            </Button>
            <Button
              variant="light"
              size="xs"
              loading={generating}
              disabled={noModels || !modelValue}
              onClick={() => void handleGenerate()}
            >
              {preview ? t('Retry') : t('Generate')}
            </Button>
            <Button size="xs" disabled={!preview || generating} onClick={() => void handleAccept()}>
              {t('Accept')}
            </Button>
          </Flex>
        </Stack>
      </AdaptiveModal>
    </>
  )
}

export default GenerateAvatarButton
