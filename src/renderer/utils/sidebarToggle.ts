export type SidebarLayout = 'expanded' | 'rail'

export type SidebarToggleState = {
  isSmallScreen: boolean
  sidebarLayout: SidebarLayout
  showSidebar: boolean
}

export type SidebarToggleResult = Pick<SidebarToggleState, 'sidebarLayout' | 'showSidebar'>

export function getSidebarToggleResult({
  isSmallScreen,
  sidebarLayout,
  showSidebar,
}: SidebarToggleState): SidebarToggleResult {
  if (!isSmallScreen && sidebarLayout === 'rail') {
    return {
      sidebarLayout: 'expanded',
      showSidebar: true,
    }
  }

  return {
    sidebarLayout,
    showSidebar: !showSidebar,
  }
}
