import { UnstyledButton } from '@mantine/core'
import { Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import { navigateToSettings } from '@/modals/Settings'
import { COMPOSER_TOOLBAR_ICON_CLASS, composerToolbarButtonClass } from './composerToolbar'
import VoiceHoldButton, { type VoiceHoldButtonProps } from './VoiceHoldButton'

/**
 * Composer dictate control. With voice set up it is the hold-to-talk button;
 * otherwise it stays visible and leads to Settings > Voice so the feature is discoverable.
 */
export default function DictateButton(props: VoiceHoldButtonProps) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()

  if (props.enabled) {
    return <VoiceHoldButton {...props} />
  }

  // same button and icon classes as the "+" Tools button beside it
  return (
    <UnstyledButton
      className={cn(props.toolbarButtonClass, composerToolbarButtonClass(isSmallScreen))}
      aria-label={t('Dictate')}
      title={t('Dictate')}
      onClick={() => navigateToSettings('/voice')}
    >
      <Mic size={props.toolbarIconSize} strokeWidth={1.8} className={COMPOSER_TOOLBAR_ICON_CLASS} />
    </UnstyledButton>
  )
}
