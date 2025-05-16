import { handleImageInputAndSave, ImageInStorage } from '@/components/Image'
import { useSettings } from '@/hooks/useSettings'
import { Box, Button, FileButton, Flex, Stack, Switch, Text, Textarea, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import PersonIcon from '@mui/icons-material/Person'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import EditableAvatar from '@/components/EditableAvatar'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { getDefaultPrompt } from 'src/shared/defaults'

export const Route = createFileRoute('/settings/chat')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const { settings, setSettings } = useSettings()

  return (
    <Stack gap="xxl" p="md">
      <Title order={5}>{t('Chat Settings')}</Title>

      {/* Avatars */}
      <Stack gap="md">
        <Stack gap="xxs">
          <Text fw="600">{t('Edit Avatars')}</Text>
          <Text size="xs" c="chatbox-tertiary">
            {t('Support jpg or png file smaller than 5MB')}
          </Text>
        </Stack>

        {/* User Avatar' */}
        <Stack>
          <Text size="xs" c="chatbox-secondary">
            {t('User Avatar')}
          </Text>
          <Flex align="center" gap="xs">
            <Box w={56} h={56} mr="xs" className=" rounded-full overflow-hidden">
              {settings.userAvatarKey ? (
                <ImageInStorage
                  storageKey={settings.userAvatarKey}
                  className="object-cover object-center w-full h-full"
                />
              ) : (
                <Flex align="center" justify="center" c="white" className="w-full h-full bg-[#bdbdbd] rounded-full">
                  <PersonIcon fontSize="medium" />
                </Flex>
              )}
            </Box>
            <FileButton
              onChange={(file) => {
                if (file) {
                  const key = StorageKeyGenerator.picture('user-avatar')
                  handleImageInputAndSave(file, key, () => setSettings({ userAvatarKey: key }))
                }
              }}
              accept="image/png,image/jpeg"
            >
              {(props) => (
                <Button {...props} variant="outline" size="xs">
                  {t('Upload Image')}
                </Button>
              )}
            </FileButton>
            {!!settings.userAvatarKey && (
              <Button color="chatbox-gray" size="xs" onClick={() => setSettings({ userAvatarKey: undefined })}>
                {t('Delete')}
              </Button>
            )}
          </Flex>
        </Stack>

        {/* Default Assistant Avatar */}
        <Stack>
          <Text size="xs" c="chatbox-secondary">
            {t('Default Assistant Avatar')}
          </Text>
          <Flex align="center" gap="xs">
            <Box w={56} h={56} mr="xs" className=" rounded-full overflow-hidden">
              {settings.defaultAssistantAvatarKey ? (
                <ImageInStorage
                  storageKey={settings.defaultAssistantAvatarKey}
                  className="object-cover object-center w-full h-full"
                />
              ) : (
                <Flex align="center" justify="center" c="white" className="w-full h-full bg-[#bdbdbd] rounded-full">
                  <SmartToyIcon fontSize="medium" />
                </Flex>
              )}
            </Box>
            <FileButton
              onChange={(file) => {
                if (file) {
                  const key = StorageKeyGenerator.picture('default-assistant-avatar')
                  handleImageInputAndSave(file, key, () => setSettings({ defaultAssistantAvatarKey: key }))
                }
              }}
              accept="image/png,image/jpeg"
            >
              {(props) => (
                <Button {...props} variant="outline" size="xs">
                  {t('Upload Image')}
                </Button>
              )}
            </FileButton>
            {!!settings.defaultAssistantAvatarKey && (
              <Button
                color="chatbox-gray"
                size="xs"
                onClick={() => setSettings({ defaultAssistantAvatarKey: undefined })}
              >
                {t('Delete')}
              </Button>
            )}
          </Flex>
        </Stack>
      </Stack>

      {/* Default Prompt */}
      <Stack gap="xxs">
        <Text fw="600">{t('Default Prompt for New Conversation')}</Text>
        <Textarea
          value={settings.defaultPrompt || ''}
          autosize
          minRows={1}
          maxRows={12}
          onChange={(e) =>
            setSettings({
              defaultPrompt: e.currentTarget.value,
            })
          }
        />
        <Button
          variant="transparent"
          color="chatbox-gray"
          onClick={() => {
            setSettings({
              defaultPrompt: getDefaultPrompt(),
            })
          }}
          px={3}
          py={6}
          className=" self-start"
        >
          {t('Reset to Default')}
        </Button>
      </Stack>

      {/* Conversation Settings */}
      <Stack gap="md">
        <Text fw="600">{t('Conversation Settings')}</Text>

        {/* Display */}
        <Stack gap="sm">
          <Text c="chatbox-tertiary">{t('Display')}</Text>

          <Switch
            label={t('show message word count')}
            checked={settings.showWordCount}
            onChange={(e) =>
              setSettings({
                showWordCount: !settings.showWordCount,
              })
            }
          />

          <Switch
            label={t('show message token count')}
            checked={settings.showTokenCount}
            onChange={(e) =>
              setSettings({
                showTokenCount: !settings.showTokenCount,
              })
            }
          />

          <Switch
            label={t('show message token usage')}
            checked={settings.showTokenUsed}
            onChange={(e) =>
              setSettings({
                showTokenUsed: !settings.showTokenUsed,
              })
            }
          />

          <Switch
            label={t('show model name')}
            checked={settings.showModelName}
            onChange={(e) =>
              setSettings({
                showModelName: !settings.showModelName,
              })
            }
          />

          <Switch
            label={t('show message timestamp')}
            checked={settings.showMessageTimestamp}
            onChange={(e) =>
              setSettings({
                showMessageTimestamp: !settings.showMessageTimestamp,
              })
            }
          />

          <Switch
            label={t('show first token latency')}
            checked={settings.showFirstTokenLatency}
            onChange={(e) =>
              setSettings({
                showFirstTokenLatency: !settings.showFirstTokenLatency,
              })
            }
          />
        </Stack>

        {/* Function */}
        <Stack gap="sm">
          <Text c="chatbox-tertiary">{t('Function')}</Text>

          <Switch
            label={t('Auto-collapse code blocks')}
            checked={settings.autoCollapseCodeBlock}
            onChange={(e) =>
              setSettings({
                autoCollapseCodeBlock: !settings.autoCollapseCodeBlock,
              })
            }
          />
          <Switch
            label={t('Auto-Generate Chat Titles')}
            checked={settings.autoGenerateTitle}
            onChange={(e) =>
              setSettings({
                ...settings,
                autoGenerateTitle: !settings.autoGenerateTitle,
              })
            }
          />
          <Switch
            label={t('Spell Check')}
            checked={settings.spellCheck}
            onChange={(e) =>
              setSettings({
                ...settings,
                spellCheck: !settings.spellCheck,
              })
            }
          />
          <Switch
            label={t('Markdown Rendering')}
            checked={settings.enableMarkdownRendering}
            onChange={(e) =>
              setSettings({
                ...settings,
                enableMarkdownRendering: !settings.enableMarkdownRendering,
              })
            }
          />
          <Switch
            label={t('LaTeX Rendering (Requires Markdown)')}
            checked={settings.enableLaTeXRendering}
            onChange={(e) =>
              setSettings({
                ...settings,
                enableLaTeXRendering: !settings.enableLaTeXRendering,
              })
            }
          />
          <Switch
            label={t('Mermaid Diagrams & Charts Rendering')}
            checked={settings.enableMermaidRendering}
            onChange={(e) =>
              setSettings({
                ...settings,
                enableMermaidRendering: !settings.enableMermaidRendering,
              })
            }
          />
          <Switch
            label={t('Inject default metadata')}
            checked={settings.injectDefaultMetadata}
            description={t('e.g., Model Name, Current Date')}
            onChange={(e) =>
              setSettings({
                ...settings,
                injectDefaultMetadata: !settings.injectDefaultMetadata,
              })
            }
          />
          <Switch
            label={t('Auto-preview artifacts')}
            checked={settings.autoPreviewArtifacts}
            description={t('Automatically render generated artifacts (e.g., HTML with CSS, JS, Tailwind)')}
            onChange={(e) =>
              setSettings({
                ...settings,
                autoPreviewArtifacts: !settings.autoPreviewArtifacts,
              })
            }
          />
          <Switch
            label={t('Paste long text as a file')}
            checked={settings.pasteLongTextAsAFile}
            description={t(
              'Pasting long text will automatically insert it as a file, keeping chats clean and reducing token usage with prompt caching.'
            )}
            onChange={(e) =>
              setSettings({
                ...settings,
                pasteLongTextAsAFile: !settings.pasteLongTextAsAFile,
              })
            }
          />
        </Stack>
      </Stack>
    </Stack>
  )
}
