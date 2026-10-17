/**
 * Shared look of the composer toolbar's icon buttons ("+ Tools and attachments", dictate). One place, so the
 * buttons beside each other cannot drift apart.
 *
 * Small screens get the 44px touch target. `.mobile-touch-target` lives in the components layer, so the desktop
 * `min-w-9 min-h-9` utilities would beat it: the mobile variant drops them and restates 44px as utilities.
 */
export const composerToolbarButtonClass = (isSmallScreen: boolean) =>
  isSmallScreen
    ? 'relative mobile-touch-target min-w-11 min-h-11 active:scale-[0.96] transition-transform'
    : 'relative min-w-9 min-h-9 active:scale-[0.96] transition-transform'

/** Idle icon colour (ink-2); the Tools button swaps it for brand when a badge is active. */
export const COMPOSER_TOOLBAR_ICON_CLASS = 'text-[var(--chatbox-tint-secondary)]'
