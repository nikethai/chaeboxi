import { ActionIcon, Collapse, Flex, Tooltip } from '@mantine/core'
import { aiProviderNameHash } from '@shared/models'
import { ProviderAPIError } from '@shared/models/errors'
import { classifyQuotaError } from '@shared/providers/usage'
import type { Message } from '@shared/types'
import { IconCheck, IconChevronDown, IconChevronUp, IconCopy } from '@tabler/icons-react'
import type React from 'react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useCopied } from '@/hooks/useCopied'
import { navigateToSettings } from '@/modals/Settings'
import * as settingActions from '@/stores/settingActions'

const MAX_CHARS = 200
const MAX_LINES = 3

function shouldTruncate(text: string): boolean {
  if (text.length > MAX_CHARS) return true
  const lineCount = text.split('\n').length
  return lineCount > MAX_LINES
}

function getTruncatedText(text: string): string {
  if (text.length > MAX_CHARS) {
    return `${text.slice(0, MAX_CHARS)}...`
  }
  const lines = text.split('\n')
  if (lines.length > MAX_LINES) {
    return `${lines.slice(0, MAX_LINES).join('\n')}...`
  }
  return text
}

function getProviderDisplayName(aiProvider: string | undefined): string {
  if (!aiProvider) {
    return 'AI Provider'
  }
  const providerNames = aiProviderNameHash as Record<string, string>
  return providerNames[aiProvider] || aiProvider
}

function SettingsLink({ children, onClick }: { children?: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="msg-error-link" onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * Detects if an error message indicates a context length exceeded error from various AI providers.
 */
export function isContextLengthError(errorText: string | null | undefined): boolean {
  if (!errorText) return false
  const text = errorText.toLowerCase()

  if (text.includes('context_length_exceeded')) return true
  if (text.includes('prompt is too long')) return true
  if (text.includes('maximum context length')) return true
  if (text.includes('input token limit')) return true
  if (text.includes('token') && text.includes('exceed') && text.includes('limit')) return true
  if (text.includes('exceed') && text.includes('max_prompt_tokens')) return true

  return false
}

export default function MessageErrTips(props: { msg: Message }) {
  const { msg } = props
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const errorMessage = msg.errorExtra?.responseBody
    ? (() => {
        try {
          const json = JSON.parse(msg.errorExtra.responseBody as string)
          return JSON.stringify(json, null, 2)
        } catch {
          return String(msg.errorExtra.responseBody)
        }
      })()
    : msg.error || ''

  const { copied, copy } = useCopied(errorMessage)
  const isTruncated = shouldTruncate(errorMessage)

  if (!msg.error) {
    return null
  }

  const tips: React.ReactNode[] = []
  let onlyShowTips = false

  const quotaKind = classifyQuotaError({
    message: msg.error,
    responseBody: typeof msg.errorExtra?.responseBody === 'string' ? msg.errorExtra.responseBody : undefined,
    errorCode: msg.errorCode,
  }).kind

  if (quotaKind === 'exhausted' || msg.errorCode === 10004) {
    tips.push(
      <Trans
        i18nKey="You may have reached your provider plan limit. Check <ViewUsageLink>Usage</ViewUsageLink> or <OpenSettingButton>provider settings</OpenSettingButton> to switch models."
        components={{
          ViewUsageLink: <SettingsLink onClick={() => navigateToSettings('/usage')} />,
          OpenSettingButton: (
            <SettingsLink
              onClick={() => navigateToSettings(msg.aiProvider ? `/provider/${msg.aiProvider}` : '/provider')}
            />
          ),
        }}
      />
    )
  } else if (quotaKind === 'rate_limit' || msg.errorCode === 20005) {
    tips.push(
      <Trans
        i18nKey="You have exceeded the provider rate limit. Please try again later. You can also review <ViewUsageLink>Usage</ViewUsageLink>."
        components={{
          ViewUsageLink: <SettingsLink onClick={() => navigateToSettings('/usage')} />,
        }}
      />
    )
  } else if (isContextLengthError(msg.error) || isContextLengthError(errorMessage)) {
    tips.push(
      <Trans i18nKey="Your conversation has exceeded the model's context limit. Try compressing the conversation, starting a new chat, or reducing the number of context messages in settings." />
    )
  } else if (msg.error.startsWith('OCR Error')) {
    tips.push(
      <Trans
        i18nKey="OCR processing failed (provider: {{aiProvider}}). Please check your <OpenSettingButton>OCR model settings</OpenSettingButton> and ensure the configured model is available."
        values={{
          aiProvider: msg.errorExtra?.aiProvider || 'AI Provider',
        }}
        components={{
          OpenSettingButton: <SettingsLink onClick={() => navigateToSettings('/default-models')} />,
        }}
      />
    )
  } else if (msg.error.startsWith('API Error')) {
    tips.push(
      <Trans
        i18nKey="Connection to {{aiProvider}} failed. This typically occurs due to incorrect configuration or {{aiProvider}} account issues. Please <buttonOpenSettings>check your settings</buttonOpenSettings> and verify your {{aiProvider}} account status."
        values={{
          aiProvider: getProviderDisplayName(msg.aiProvider),
        }}
        components={{
          buttonOpenSettings: (
            <SettingsLink
              onClick={() => navigateToSettings(msg.aiProvider ? `/provider/${msg.aiProvider}` : '/provider')}
            />
          ),
        }}
      />
    )
  } else if (msg.error.startsWith('Network Error')) {
    tips.push(
      <Trans
        i18nKey="network error tips"
        values={{
          host: msg.errorExtra?.host || 'AI Provider',
        }}
      />
    )
    const proxy = settingActions.getProxy()
    if (proxy) {
      tips.push(<Trans i18nKey="network proxy error tips" values={{ proxy }} />)
    }
  } else if (msg.errorCode === 10003) {
    tips.push(
      <Trans
        i18nKey="ai provider no implemented paint tips"
        values={{
          aiProvider: getProviderDisplayName(msg.aiProvider),
        }}
        components={[<SettingsLink key="link" onClick={() => navigateToSettings()} />]}
      />
    )
  } else if (msg.errorCode && ProviderAPIError.getDetail(msg.errorCode)) {
    const chatboxAIErrorDetail = ProviderAPIError.getDetail(msg.errorCode)
    if (chatboxAIErrorDetail) {
      onlyShowTips = true
      tips.push(
        <Trans
          i18nKey={chatboxAIErrorDetail.i18nKey}
          values={{
            model: msg.model,
            supported_web_browsing_models: 'gemini-2.0-flash(API), perplexity API',
          }}
          components={{
            OpenSettingButton: <SettingsLink onClick={() => navigateToSettings()} />,
            OpenExtensionSettingButton: <SettingsLink onClick={() => navigateToSettings('/web-search')} />,
            OpenMorePlanButton: <SettingsLink onClick={() => navigateToSettings('/provider')} />,
            LinkToHomePage: <span />,
            LinkToAdvancedFileProcessing: <span />,
            LinkToAdvancedUrlProcessing: <span />,
            OpenDocumentParserSettingButton: <SettingsLink onClick={() => navigateToSettings('/document-parser')} />,
          }}
        />
      )
    }
  } else {
    tips.push(<Trans i18nKey="unknown error tips" components={[<span key="a"></span>]} />)
  }

  return (
    <div className="msg-error-tips message-error-tips" role="alert">
      <div className="msg-error-tips-body">
        {tips.map((tip, i) => (
          <p key={`${i}-${String(tip)}`} className="msg-error-tips-line">
            {tip}
          </p>
        ))}
      </div>
      {onlyShowTips ? null : (
        <div className="msg-error-detail">
          {isTruncated ? (
            <button
              type="button"
              className="msg-error-detail-toggle"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              <span className="msg-error-detail-chevron" aria-hidden>
                {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              </span>
              <span className="msg-error-detail-text whitespace-pre-wrap break-all">
                {expanded ? errorMessage : getTruncatedText(errorMessage)}
              </span>
            </button>
          ) : (
            <div className="msg-error-detail-text whitespace-pre-wrap break-all">{errorMessage}</div>
          )}
          <Collapse in={expanded || !isTruncated}>
            <Flex justify="flex-end" mt={isTruncated ? 'xs' : 0}>
              <Tooltip label={t('copy')} withArrow openDelay={1000}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color="chatbox-error"
                  className="active:scale-[0.96] transition-transform"
                  onClick={(e) => {
                    e.stopPropagation()
                    copy()
                  }}
                  aria-label={t('copy')}
                >
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </ActionIcon>
              </Tooltip>
            </Flex>
          </Collapse>
        </div>
      )}
    </div>
  )
}
