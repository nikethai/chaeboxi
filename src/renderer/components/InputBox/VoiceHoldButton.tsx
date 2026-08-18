import { UnstyledButton } from '@mantine/core'
import { IconLoader2, IconMicrophone } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { navigateToSettings } from '@/modals/Settings'
import { settingsStore } from '@/stores/settingsStore'
import * as toastActions from '@/stores/toastActions'
import { ModelProviderEnum } from '../../../shared/types'
import {
  mergeVoiceConfig,
  transcribeAudio,
  type VoiceAuth,
  type VoiceCopilotConfig,
} from '../../../shared/voice-copilot'

export function voiceAuthFromSettings(): VoiceAuth {
  const providers = settingsStore.getState().providers
  const openai = providers?.[ModelProviderEnum.OpenAI]
  const groq = providers?.[ModelProviderEnum.Groq]
  return {
    openaiApiKey: openai?.apiKey,
    openaiApiHost: openai?.apiHost,
    groqApiKey: groq?.apiKey,
    groqApiHost: groq?.apiHost,
  }
}

function pickRecorderMimeType(): { mimeType: string; fileName: string } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'audio/webm', fileName: 'audio.webm' }
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return { mimeType: 'audio/webm;codecs=opus', fileName: 'audio.webm' }
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return { mimeType: 'audio/webm', fileName: 'audio.webm' }
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return { mimeType: 'audio/mp4', fileName: 'audio.m4a' }
  }
  return { mimeType: '', fileName: 'audio.webm' }
}

function matchesHoldShortcut(event: KeyboardEvent, shortcut: string): boolean {
  if (!shortcut) return false
  const parts = shortcut.split('+').map((part) => part.trim().toLowerCase())
  if (parts.length === 0) return false
  const key = parts[parts.length - 1]
  if (!key || ['control', 'ctrl', 'alt', 'shift', 'meta', 'command', 'mod'].includes(key)) {
    return false
  }
  const needAlt = parts.includes('alt') || parts.includes('option')
  const needShift = parts.includes('shift')
  const needCtrl = parts.includes('ctrl') || parts.includes('control')
  const needMeta = parts.includes('meta') || parts.includes('command') || parts.includes('mod')
  const needCommandOrControl = parts.includes('commandorcontrol')
  if (Boolean(event.altKey) !== needAlt) return false
  if (Boolean(event.shiftKey) !== needShift) return false
  const ctrlOrMeta = event.ctrlKey || event.metaKey
  if (needCommandOrControl) {
    if (!ctrlOrMeta) return false
  } else {
    if (Boolean(event.ctrlKey) !== needCtrl) return false
    if (Boolean(event.metaKey) !== needMeta) return false
  }
  return event.key.toLowerCase() === key.toLowerCase()
}

export type VoiceHoldButtonProps = {
  enabled: boolean
  config: VoiceCopilotConfig
  shortcut: string
  toolbarButtonClass: string
  toolbarIconSize: number
  onTranscript: (text: string) => void
}

export default function VoiceHoldButton({
  enabled,
  config,
  shortcut,
  toolbarButtonClass,
  toolbarIconSize,
  onTranscript,
}: VoiceHoldButtonProps) {
  const { t } = useTranslation()
  const [holding, setHolding] = useState(false)
  const [busy, setBusy] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const holdingRef = useRef(false)
  const busyRef = useRef(false)

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const finishRecording = useCallback(async () => {
    const recorder = recorderRef.current
    recorderRef.current = null
    holdingRef.current = false
    setHolding(false)

    const blob = new Blob(chunksRef.current, { type: recorder?.mimeType || chunksRef.current[0]?.type || 'audio/webm' })
    chunksRef.current = []
    stopTracks()

    if (!blob.size) {
      toastActions.add(t('No audio captured. Hold the mic and speak, then release.'))
      return
    }

    busyRef.current = true
    setBusy(true)
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const { fileName, mimeType } = pickRecorderMimeType()
      const text = await transcribeAudio({
        bytes,
        fileName: recorder?.mimeType?.includes('mp4') ? 'audio.m4a' : fileName,
        mimeType: blob.type || mimeType || 'audio/webm',
        config,
        auth: voiceAuthFromSettings(),
      })
      onTranscript(text)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/missing .*api key/i.test(message)) {
        toastActions.add(t('Add an OpenAI or Groq API key in Settings → Model Provider, or use Local Whisper.'))
        navigateToSettings('/provider')
      } else {
        toastActions.add(message || t('Could not transcribe audio'))
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [config, onTranscript, t])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) {
      holdingRef.current = false
      setHolding(false)
      stopTracks()
      return
    }
    if (recorder.state === 'inactive') {
      void finishRecording()
      return
    }
    recorder.stop()
  }, [finishRecording])

  const startRecording = useCallback(async () => {
    if (!enabled || holdingRef.current || busyRef.current) return
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toastActions.add(t('Microphone recording is not supported in this environment.'))
      return
    }
    holdingRef.current = true
    setHolding(true)
    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!holdingRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const { mimeType } = pickRecorderMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        void finishRecording()
      }
      recorder.start()
    } catch (error) {
      holdingRef.current = false
      setHolding(false)
      stopTracks()
      console.error('[voice] getUserMedia failed', error)
      toastActions.add(t('Microphone permission is required for hold-to-talk.'))
    }
  }, [enabled, finishRecording, t])

  useEffect(() => {
    return () => {
      recorderRef.current?.stop()
      stopTracks()
    }
  }, [])

  useEffect(() => {
    if (!enabled || !shortcut) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented) return
      if (!matchesHoldShortcut(event, shortcut)) return
      event.preventDefault()
      void startRecording()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!matchesHoldShortcut(event, shortcut)) return
      event.preventDefault()
      stopRecording()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [enabled, shortcut, startRecording, stopRecording])

  if (!enabled) return null

  const label = busy ? t('Transcribing…') : holding ? t('Release to send') : t('Hold to talk')

  return (
    <UnstyledButton
      className={cn(
        toolbarButtonClass,
        'min-h-9 min-w-9 active:scale-[0.96] transition-transform',
        (holding || busy) && 'text-[var(--chatbox-tint-error,#e03131)]'
      )}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={busy}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        void startRecording()
      }}
      onPointerUp={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        stopRecording()
      }}
      onPointerCancel={() => stopRecording()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {busy ? (
        <IconLoader2 size={toolbarIconSize} stroke={1.8} className="animate-spin" />
      ) : (
        <IconMicrophone size={toolbarIconSize} stroke={1.8} />
      )}
    </UnstyledButton>
  )
}
