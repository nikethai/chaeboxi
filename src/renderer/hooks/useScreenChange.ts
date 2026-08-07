import { useMantineTheme } from '@mantine/core'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'

/** Desktop icon-only rail width (px). Expanded width uses useSidebarWidth(). */
export const SIDEBAR_ICON_RAIL_WIDTH = 56

export default function useScreenChange() {
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)
  const realIsSmallScreen = useIsSmallScreen()
  useEffect(() => {
    // Desktop: always keep drawer open (expanded or icon rail). Mobile: closed by default.
    setShowSidebar(!realIsSmallScreen)
  }, [realIsSmallScreen, setShowSidebar])
}

export function useIsSmallScreen() {
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
  return isSmallScreen
}

export function useScreenDownToMD() {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.down('md'))
}

export function useIsLargeScreen() {
  const theme = useTheme()
  return !useMediaQuery(theme.breakpoints.down('lg'))
}

export function useSidebarWidth() {
  const mantineTheme = useMantineTheme()
  const scale = mantineTheme.scale ?? 1
  const theme = useTheme()
  const customWidth = useUIStore((s) => s.sidebarWidth)

  // Always call hooks in the same order
  const sm = useMediaQuery(theme.breakpoints.up('sm'))
  const md = useMediaQuery(theme.breakpoints.up('md'))
  const lg = useMediaQuery(theme.breakpoints.up('lg'))
  const xl = useMediaQuery(theme.breakpoints.up('xl'))

  // If custom width is set, use it
  if (customWidth !== null) {
    return customWidth
  }

  // Studio rail target ~280px (mock --rail-w); keep slightly tighter only on small desktop
  if (xl || lg) {
    return 280 * scale
  } else if (md) {
    return 260 * scale
  } else if (sm) {
    return 240 * scale
  } else {
    return 280 * scale
  }
}

/** Desktop: expanded tree width or 56px icon rail. Mobile callers still use 75vw for the drawer. */
export function useSidebarEffectiveWidth() {
  const expandedWidth = useSidebarWidth()
  const isSmallScreen = useIsSmallScreen()
  const sidebarLayout = useUIStore((s) => s.sidebarLayout)
  if (isSmallScreen) {
    return expandedWidth
  }
  return sidebarLayout === 'rail' ? SIDEBAR_ICON_RAIL_WIDTH : expandedWidth
}

export function useInputBoxHeight(): { min: number; max: number } {
  const theme = useTheme()
  const sm = useMediaQuery(theme.breakpoints.up('sm'))
  const md = useMediaQuery(theme.breakpoints.up('md'))
  // const lg = useMediaQuery(theme.breakpoints.up('lg'))
  const xl = useMediaQuery(theme.breakpoints.up('xl'))
  if (xl) {
    return { min: 96, max: 480 }
  } else if (md) {
    return { min: 72, max: 384 }
  } else if (sm) {
    return { min: 56, max: 288 }
  } else {
    return { min: 32, max: 192 }
  }
}
