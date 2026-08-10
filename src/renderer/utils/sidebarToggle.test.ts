import { describe, expect, it } from 'vitest'
import { getSidebarToggleResult } from './sidebarToggle'


describe('getSidebarToggleResult', () => {
  it('expands the desktop icon rail in place', () => {
    expect(
      getSidebarToggleResult({
        isSmallScreen: false,
        sidebarLayout: 'rail',
        showSidebar: true,
      })
    ).toEqual({
      sidebarLayout: 'expanded',
      showSidebar: true,
    })
  })

  it('toggles the temporary drawer on small screens', () => {
    expect(
      getSidebarToggleResult({
        isSmallScreen: true,
        sidebarLayout: 'expanded',
        showSidebar: true,
      })
    ).toEqual({
      sidebarLayout: 'expanded',
      showSidebar: false,
    })
  })
})
