import { ActionIcon, Text, Tooltip, UnstyledButton } from '@mantine/core'
import type { Message, MessageArtifact as MessageArtifactRecord } from '@shared/types/session'
import { IconCode, IconEye, IconLayoutSidebarRightExpand, IconPlayerStop, IconReload } from '@tabler/icons-react'
import { debounce } from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import { getMessageThreadContext } from '@/stores/sessionActions'
import { useUIStore } from '@/stores/uiStore'
import { getMessageText } from '../../shared/utils/message'

const RENDERABLE_CODE_LANGUAGES = ['html'] as const
export type RenderableCodeLanguage = (typeof RENDERABLE_CODE_LANGUAGES)[number]

const CODE_BLOCK_LANGUAGES = [...RENDERABLE_CODE_LANGUAGES, 'js', 'javascript', 'css'] as const
export type CodeBlockLanguage = (typeof CODE_BLOCK_LANGUAGES)[number]

export function isContainRenderableCode(markdown: string): boolean {
  if (!markdown) {
    return false
  }
  return (
    RENDERABLE_CODE_LANGUAGES.some((l) => markdown.includes('```' + l + '\n')) ||
    RENDERABLE_CODE_LANGUAGES.some((l) => markdown.includes('```' + l.toUpperCase() + '\n'))
  )
}

export function isRenderableCodeLanguage(language: string): boolean {
  return !!language && RENDERABLE_CODE_LANGUAGES.includes(language.toLowerCase() as RenderableCodeLanguage)
}

export function deriveMessageArtifacts(
  messageContent: string,
  options?: {
    existingArtifacts?: MessageArtifactRecord[]
    previousArtifact?: MessageArtifactRecord
  }
): MessageArtifactRecord[] | undefined {
  if (!isContainRenderableCode(messageContent)) {
    return undefined
  }

  const existingArtifact = options?.existingArtifacts?.[0]
  if (existingArtifact && existingArtifact.content === messageContent) {
    return options?.existingArtifacts
  }

  const previousArtifact = options?.previousArtifact
  return [
    {
      id: existingArtifact?.id ?? uuidv4(),
      type: 'html',
      title: 'HTML Artifact',
      language: 'html',
      content: messageContent,
      version: existingArtifact?.version ?? (previousArtifact?.version ?? 0) + 1,
      previousVersionId: existingArtifact?.previousVersionId ?? previousArtifact?.id,
      timestamp: Date.now(),
    },
  ]
}

export async function getPreviousArtifactVersion(
  sessionId: string,
  messageId: string
): Promise<MessageArtifactRecord | undefined> {
  const messageList = await getMessageThreadContext(sessionId, messageId)
  const messageIndex = messageList.findIndex((message) => message.id === messageId)
  if (messageIndex <= 0) {
    return undefined
  }

  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    const artifact = messageList[index].artifacts?.[0]
    if (artifact) {
      return artifact
    }
    const previousMessageText = getMessageText(messageList[index])
    if (messageList[index].role === 'assistant' && isContainRenderableCode(previousMessageText)) {
      return deriveMessageArtifacts(previousMessageText)?.[0]
    }
  }

  return undefined
}

export function MessageArtifact(props: {
  sessionId: string
  messageId: string
  messageContent: string
  preview: boolean
  setPreview: (preview: boolean) => void
  /** When true, open side workspace once after the artifact is ready (auto-preview setting). */
  autoOpenWorkspace?: boolean
  generating?: boolean
}) {
  const {
    sessionId,
    messageId,
    messageContent,
    preview,
    setPreview,
    autoOpenWorkspace = false,
    generating = false,
  } = props

  const [contextMessages, setContextMessages] = useState<Message[]>([])
  const setWorkspacePanel = useUIStore((s) => s.setWorkspacePanel)
  const didAutoOpen = useRef(false)
  const prevGenerating = useRef(generating)
  const pendingAutoOpen = useRef(false)

  useEffect(() => {
    async function fetchContextMessages(): Promise<Message[]> {
      if (!sessionId || !messageId) {
        return []
      }
      const messageList = await getMessageThreadContext(sessionId, messageId)
      const index = messageList.findIndex((m) => m.id === messageId)

      return messageList.slice(0, index)
    }
    void fetchContextMessages().then((msgs) => {
      setContextMessages(msgs)
    })
  }, [messageId, sessionId])

  const htmlCode = useMemo(() => {
    return generateHtml([...contextMessages.map((m) => getMessageText(m)), messageContent])
  }, [contextMessages, messageContent])

  // Mark auto-open only when this message finishes generating (not historical loads)
  useEffect(() => {
    const finished = prevGenerating.current && !generating
    prevGenerating.current = generating
    if (finished && autoOpenWorkspace) {
      pendingAutoOpen.current = true
    }
  }, [generating, autoOpenWorkspace])

  // Open side workspace once after finish + html is ready (no scroll fight)
  useEffect(() => {
    if (!pendingAutoOpen.current || didAutoOpen.current || !htmlCode || generating) return
    didAutoOpen.current = true
    pendingAutoOpen.current = false
    setWorkspacePanel({
      kind: 'html',
      htmlCode,
      title: 'HTML Artifact',
      messageId,
    })
  }, [htmlCode, generating, messageId, setWorkspacePanel])

  return (
    <ArtifactWithButtons
      htmlCode={htmlCode}
      messageId={messageId}
      preview={preview}
      setPreview={setPreview}
    />
  )
}

export function ArtifactWithButtons(props: {
  htmlCode: string
  messageId?: string
  preview: boolean
  setPreview: (preview: boolean) => void
}) {
  const { htmlCode, messageId, preview, setPreview } = props
  const { t } = useTranslation()
  const [reloadSign, setReloadSign] = useState(0)
  const isSmallScreen = useIsSmallScreen()
  const setWorkspacePanel = useUIStore((s) => s.setWorkspacePanel)

  const openWorkspace = () => {
    if (!htmlCode) return
    setWorkspacePanel({
      kind: 'html',
      htmlCode,
      title: t('Artifact'),
      messageId,
    })
  }

  const onReplay = () => {
    setReloadSign(Math.random())
  }
  const onPreview = () => {
    // Desktop: open side workspace (Artifacts mental model). Mobile: expand inline.
    if (!isSmallScreen) {
      openWorkspace()
      return
    }
    setPreview(true)
    setReloadSign(Math.random())
  }
  const onStopPreview = () => {
    setPreview(false)
  }

  if (!preview) {
    return (
      <div className="artifact-card">
        <UnstyledButton type="button" className="artifact-card-main" onClick={onPreview}>
          <span className="artifact-card-icon" aria-hidden>
            <IconCode size={16} stroke={1.5} />
          </span>
          <span className="artifact-card-copy min-w-0">
            <Text size="sm" fw={600} className="artifact-card-title">
              {t('HTML Artifact')}
            </Text>
            <Text size="xs" className="artifact-card-sub">
              {isSmallScreen ? t('Tap to preview') : t('Open in workspace')}
            </Text>
          </span>
          <span className="artifact-card-chevron" aria-hidden>
            <IconLayoutSidebarRightExpand size={18} stroke={1.5} />
          </span>
        </UnstyledButton>
        <div className="artifact-card-actions">
          <Tooltip label={t('Open in workspace')} openDelay={200}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size={36}
              radius="xl"
              aria-label={t('Open in workspace')}
              className="artifact-card-btn"
              onClick={(e) => {
                e.stopPropagation()
                openWorkspace()
              }}
            >
              <IconLayoutSidebarRightExpand size={16} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
          {isSmallScreen ? (
            <Tooltip label={t('Inline preview')} openDelay={200}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={36}
                radius="xl"
                aria-label={t('Inline preview')}
                className="artifact-card-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setPreview(true)
                  setReloadSign(Math.random())
                }}
              >
                <IconEye size={16} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('artifact-inline', isSmallScreen && 'artifact-inline--stack')}>
      <div className="artifact-inline-frame">
        <Artifact htmlCode={htmlCode} reloadSign={reloadSign} className="artifact-inline-iframe" />
      </div>
      <div className="artifact-inline-tools" role="toolbar" aria-label={t('Artifact controls')}>
        <Tooltip label={t('Refresh')} openDelay={200}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={36}
            radius="xl"
            onClick={onReplay}
            aria-label={t('Refresh')}
            className="artifact-card-btn"
          >
            <IconReload size={16} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('Open in workspace')} openDelay={200}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={36}
            radius="xl"
            onClick={openWorkspace}
            aria-label={t('Open in workspace')}
            className="artifact-card-btn"
          >
            <IconLayoutSidebarRightExpand size={16} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('Close preview')} openDelay={200}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={36}
            radius="xl"
            onClick={onStopPreview}
            aria-label={t('Close preview')}
            className="artifact-card-btn"
          >
            <IconPlayerStop size={16} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      </div>
    </div>
  )
}

export function Artifact(props: { htmlCode: string; reloadSign?: number; className?: string }) {
  const { htmlCode, reloadSign, className } = props
  const ref = useRef<HTMLIFrameElement>(null)
  const iframeOrigin = 'https://artifact-preview.chatboxai.app/preview'

  const sendIframeMsg = (type: 'html', code: string) => {
    if (!ref.current) {
      return
    }
    ref.current.contentWindow?.postMessage({ type, code }, '*')
  }
  // 当 reloadSign 改变时，重新加载 iframe 内容
  useEffect(() => {
    ;(async () => {
      sendIframeMsg('html', '')
      await new Promise((resolve) => setTimeout(resolve, 1500))
      sendIframeMsg('html', htmlCode)
    })()
  }, [reloadSign])

  // 当 htmlCode 改变时，防抖地刷新 iframe 内容
  const updateIframe = useMemo(
    () =>
      debounce(() => {
        sendIframeMsg('html', htmlCode)
      }, 300),
    [htmlCode]
  )
  useEffect(() => {
    updateIframe()
    return () => updateIframe.cancel()
  }, [updateIframe])

  return (
    <iframe
      className={cn('w-full', 'border-none', 'h-[400px]', className)}
      sandbox="allow-scripts allow-forms"
      src={iframeOrigin}
      ref={ref}
    />
  )
}

function generateHtml(markdowns: string[]): string {
  const codeBlocks: Record<CodeBlockLanguage, string[]> = {
    html: [],
    js: [],
    javascript: [],
    css: [],
  }
  const languages = Array.from(Object.keys(codeBlocks)) as (keyof typeof codeBlocks)[]
  let currentType: keyof typeof codeBlocks | null = null
  let currentContent = ''
  for (const markdown of markdowns) {
    for (let line of markdown.split('\n')) {
      line = line.trimStart()
      const lang = languages.find((l) => '```' + l === line)
      if (lang) {
        currentType = lang
        continue
      }
      if (line === '```') {
        if (currentContent && currentType) {
          codeBlocks[currentType].push(currentContent)
          currentContent = ''
          currentType = null
          continue
        } else {
          continue
        }
      }
      if (currentType) {
        currentContent += line + '\n'
      }
    }
  }
  // 仅保留最后一个
  // const htmlWholes = codeBlocks.html.filter(c => c.includes('</html>'))
  // codeBlocks.html = [
  //     htmlWholes[htmlWholes.length - 1],
  //     ...codeBlocks.html.filter(c => !c.includes('</html>'))
  // ]

  codeBlocks.html = codeBlocks.html.slice(-1)
  codeBlocks.css = codeBlocks.css.slice(-1)
  codeBlocks.javascript = codeBlocks.javascript.slice(-1)
  codeBlocks.js = codeBlocks.js.slice(-1)

  if (codeBlocks.html.length === 0) {
    return ''
  }

  const srcDoc = `
<script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,line-clamp,container-queries"></script>

${codeBlocks.html.join('\n')}

<style>
${codeBlocks.css.join('\n')}
</style>

<script>
${codeBlocks.js.join('\n\n// ----------- \n\n')}
${codeBlocks.javascript.join('\n\n// ----------- \n\n')}
</script>
    `
  return srcDoc
}
