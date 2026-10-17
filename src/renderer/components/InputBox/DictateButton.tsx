import { ActionIcon } from '@mantine/core'
import { Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { navigateToSettings } from '@/modals/Settings'
import VoiceHoldButton, { type VoiceHoldButtonProps } from './VoiceHoldButton'

/**
 * Composer dictate control. With voice set up it is the hold-to-talk button;
 * otherwise it stays visible and leads to Settings > Voice so the feature is discoverable.
 */
export default function DictateButton(props: VoiceHoldButtonProps) {
  const { t } = useTranslation()

  if (props.enabled) {
    return <VoiceHoldButton {...props} />
  }

  return (
    <ActionIcon
      variant="transparent"
      // same ink as the "+" Tools button beside it; without this the transparent variant uses the primary green
      c="var(--chatbox-tint-secondary)"
      className={cn(props.toolbarButtonClass, 'min-h-9 min-w-9 justify-center')}
      aria-label={t('Dictate')}
      title={t('Dictate')}
      onClick={() => navigateToSettings('/voice')}
    >
      <Mic size={16} strokeWidth={1.8} />
    </ActionIcon>
  )
}
