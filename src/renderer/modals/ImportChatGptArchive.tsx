import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Button, Group, List, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { describeImportedArchiveError, importChatGptArchiveUsingPicker } from '@/packages/imported-history'
import platform, { platformCapabilities } from '@/platform'

const CHATGPT_HOME_URL = 'https://chatgpt.com/'
const CHATGPT_EXPORT_HELP_URL = 'https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data'

const ImportChatGptArchive = NiceModal.create(() => {
  const modal = useModal()
  const { t } = useTranslation()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const onPick = async () => {
    if (
      !platformCapabilities.supportsImportedArchives ||
      !platform.pickImportedArchivePath ||
      !platform.inspectImportedArchive
    ) {
      setStatus(t('Imported archives are available on desktop only'))
      return
    }
    setBusy(true)
    try {
      const result = await importChatGptArchiveUsingPicker(platform)
      if (!result) {
        return
      }
      setStatus(
        t('Imported {{count}} conversations. Search (⌘K) for a conversation title, then Continue.', {
          count: result.source.conversations.length,
        })
      )
    } catch (error) {
      setStatus(t(describeImportedArchiveError(error)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdaptiveModal opened={modal.visible} onClose={() => modal.hide()} centered title={t('Import ChatGPT archive')}>
      <Stack gap="md">
        <Text size="sm">{t('Chaeboxi cannot download ChatGPT history. OpenAI emails you a ZIP.')}</Text>
        <List type="ordered" size="sm" spacing="xs" classNames={{ item: 'whitespace-normal' }}>
          <List.Item>{t('Open ChatGPT → profile → Settings → Data controls → Export → Confirm.')}</List.Item>
          <List.Item>{t('Wait for email or SMS (minutes, sometimes longer; help says up to 7 days).')}</List.Item>
          <List.Item>{t('Download the ZIP while signed into the same account. Do not unzip.')}</List.Item>
          <List.Item>{t('Come back here and choose that .zip.')}</List.Item>
        </List>
        <Text size="xs" c="dimmed">
          {t('Work, Team, Business, and Enterprise accounts often have no Export button.')}
        </Text>
        <Group gap="sm">
          <Button variant="default" onClick={() => void platform.openLink(CHATGPT_HOME_URL)}>
            {t('Open ChatGPT')}
          </Button>
          <Button variant="subtle" onClick={() => void platform.openLink(CHATGPT_EXPORT_HELP_URL)}>
            {t('How to export')}
          </Button>
        </Group>
        {status ? <Text size="sm">{status}</Text> : null}
        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton onClick={() => modal.hide()}>{t('Close')}</AdaptiveModal.CloseButton>
          <Button disabled={busy} onClick={() => void onPick()}>
            {t('Choose ZIP on this computer')}
          </Button>
        </AdaptiveModal.Actions>
      </Stack>
    </AdaptiveModal>
  )
})

export default ImportChatGptArchive
