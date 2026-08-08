/**
 * Avatar studio: preview + upload + shuffle seed + AI generate.
 */

import { Button, FileButton, Flex, Stack, Text } from '@mantine/core'
import type { CopilotDetail } from '@shared/types'
import { type FC, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentAvatar } from '@/components/agents/AgentAvatar'
import { handleImageInputAndSave } from '@/components/Image'
import GenerateAvatarButton from '@/components/settings/GenerateAvatarButton'
import { buildAgentAvatarGeneratePrompt, newAvatarSeed } from '@/packages/agents'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { add as addToast } from '@/stores/toastActions'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export type AgentAvatarStudioProps = {
  detail: CopilotDetail
  onChange(patch: Partial<CopilotDetail>): void
}

export const AgentAvatarStudio: FC<AgentAvatarStudioProps> = ({ detail, onChange }) => {
  const { t } = useTranslation()
  const generatePrompt = useMemo(
    () =>
      buildAgentAvatarGeneratePrompt({
        name: detail.name || t('Agent'),
        role: detail.role,
        voice: detail.voice,
        description: detail.description,
      }),
    [detail.name, detail.role, detail.voice, detail.description, t]
  )

  const storageKeyForGen = useMemo(
    () => detail.avatarKey || StorageKeyGenerator.picture(`agent-avatar:${detail.id}`),
    [detail.avatarKey, detail.id]
  )

  return (
    <Stack gap="xs">
      <Text size="xs" c="chatbox-secondary">
        {t('Avatar')}
      </Text>
      <Flex align="center" gap="xs" wrap="wrap">
        <AgentAvatar size={56} agent={detail} />
        <FileButton
          onChange={(file) => {
            if (!file) return
            if (file.size > MAX_IMAGE_SIZE) {
              addToast(t('Support jpg or png file smaller than 5MB'))
              return
            }
            const key = StorageKeyGenerator.picture(`agent-avatar:${detail.id}`)
            handleImageInputAndSave(file, key, () => {
              onChange({ avatarKey: key, emojiAvatar: undefined })
            })
          }}
          accept="image/png,image/jpeg"
        >
          {(props) => (
            <Button {...props} variant="outline" size="xs">
              {t('Upload Image')}
            </Button>
          )}
        </FileButton>
        <Button
          variant="outline"
          size="xs"
          onClick={() => onChange({ avatarSeed: newAvatarSeed(), avatarKey: undefined, emojiAvatar: undefined })}
        >
          {t('Shuffle look')}
        </Button>
        <GenerateAvatarButton
          kind="agent"
          storageKey={storageKeyForGen}
          defaultPrompt={generatePrompt}
          onSaved={(key) => onChange({ avatarKey: key, emojiAvatar: undefined })}
        />
        {(detail.avatarKey || detail.picUrl) && (
          <Button
            color="chatbox-gray"
            size="xs"
            onClick={() => onChange({ avatarKey: undefined, picUrl: undefined, emojiAvatar: undefined })}
          >
            {t('Delete')}
          </Button>
        )}
      </Flex>
      <Text size="xs" c="chatbox-tertiary">
        {t('Support jpg or png file smaller than 5MB')}
      </Text>
    </Stack>
  )
}

export default AgentAvatarStudio
