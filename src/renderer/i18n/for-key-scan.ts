/**
 * This file exists solely to help i18next-parser extract translation keys
 * that are defined in src/shared/models/errors.ts and used dynamically via
 * t(errorDetail.i18nKey) or <Trans i18nKey={errorDetail.i18nKey} />.
 *
 * Do NOT delete this file. It is not imported anywhere at runtime.
 * When adding new error codes with i18nKey in errors.ts, add the key here too.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _errorI18nKeys(t: (key: string) => string) {
  // Document parser errors (errors.ts line 230+)
  t(
    'Local document parsing failed. You can go to <OpenDocumentParserSettingButton>Settings</OpenDocumentParserSettingButton> and switch to legacy cloud service for cloud-based document parsing.'
  )
  t('Cloud document parsing failed. Please try again later or use local parsing.')
  t(
    'Document parsing failed. You can go to <OpenDocumentParserSettingButton>Settings</OpenDocumentParserSettingButton> and switch to legacy cloud service for cloud-based document parsing.'
  )
  t(
    'Selected document parser is currently only supported in Knowledge Base. For chat file attachments, please go to <OpenDocumentParserSettingButton>Settings</OpenDocumentParserSettingButton> and switch to Local or legacy cloud service.'
  )
  t(
    'MinerU API token is required. Please go to <OpenDocumentParserSettingButton>Settings</OpenDocumentParserSettingButton> and configure your MinerU API token.'
  )
  t(
    'This file type requires a document parser. Please go to <OpenDocumentParserSettingButton>Settings</OpenDocumentParserSettingButton> and enable legacy cloud service document parsing.'
  )
  t(
    'You have selected Serper as the search provider, but an API key has not been entered yet. Please <OpenExtensionSettingButton>click here to open Settings</OpenExtensionSettingButton> and enter your API key, or choose a different search provider.'
  )
  t(
    'You have selected Google Custom Search as the search provider, but the API key or Search Engine ID is missing. Please <OpenExtensionSettingButton>click here to open Settings</OpenExtensionSettingButton> and complete the configuration, or choose a different search provider.'
  )
}
