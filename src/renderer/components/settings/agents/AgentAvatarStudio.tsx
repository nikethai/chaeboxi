/**
 * Avatar studio: preview + upload + shuffle seed + AI generate.
 */

import { Button, FileButton, Flex, Stack, Text } from '@mantine/core'
import type { CopilotDetail } from '@shared/types'
import { IconDice, IconTrash, IconUpload } from '@tabler/icons-react'
import { type FC, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentAvatar } from '@/components/agents/AgentAvatar'
import { handleImageInputAndSave } from '@/components/Image'
import { ScalableIcon } from '@/components/common/ScalableIcon'
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
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        {t('Avatar')}
      </Text>
      <Flex align="center" gap="md" wrap="wrap">
        <div
          className="rounded-full"
          style={{
            outline: '1px solid rgba(255,255,255,0.1)',
            outlineOffset: 0,
            lineHeight: 0,
          }}
        >
          <AgentAvatar size={72} agent={detail} />
        </div>
        <Flex gap="xs" wrap="wrap">
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
              <Button
                {...props}
                variant="outline"
                size="xs"
                leftSection={<ScalableIcon icon={IconUpload} size={14} />}
                className="active:scale-[0.96] transition-transform"
              >
                {t('Upload Image')}
              </Button>
            )}
          </FileButton>
          <Button
            variant="light"
            size="xs"
            leftSection={<ScalableIcon icon={IconDice} size={14} />}
            onClick={() => onChange({ avatarSeed: newAvatarSeed(), avatarKey: undefined, emojiAvatar: undefined })}
            className="active:scale-[0.96] transition-transform"
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
              leftSection={<ScalableIcon icon={IconTrash} size={14} />}
              onClick={() => onChange({ avatarKey: undefined, picUrl: undefined, emojiAvatar: undefined })}
              className="active:scale-[0.96] transition-transform"
            >
              {t('Use procedural')}
            </Button>
          )}
        </Flex>
      </Flex>
      <Text size="xs" c="chatbox-tertiary">
        {t('Unique emblem by default. Upload or generate with AI to personalize.')}
      </Text>
    </Stack>
  )
}

export default AgentAvatarStudio
