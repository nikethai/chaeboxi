import { Flex, type FlexProps } from '@mantine/core'
import clsx from 'clsx'
import type { FC } from 'react'
import { useIsSmallScreen } from '@/hooks/useScreenChange'

export type TitleBarRowProps = FlexProps & {
  /**
   * Apply start inset so content clears macOS traffic lights.
   * Use on chrome that sits under the traffic-light zone (sidebar always;
   * main header only when the sidebar is collapsed).
   */
  macTrafficInset?: boolean
  /**
   * Height mode:
   * - auto: mobile 56px / desktop 44px from screen size
   * - desktop: always 44px (sidebar rail head)
   * - mobile: always 56px
   */
  heightMode?: 'auto' | 'desktop' | 'mobile'
}

/**
 * Shared window chrome row — drag region + consistent height/inset with
 * main header and sidebar rail head.
 */
export const TitleBarRow: FC<TitleBarRowProps> = ({
  macTrafficInset = false,
  heightMode = 'auto',
  className,
  children,
  ...props
}) => {
  const isSmallScreen = useIsSmallScreen()
  const useMobileHeight = heightMode === 'mobile' || (heightMode === 'auto' && isSmallScreen)

  return (
    <Flex
      align="center"
      className={clsx(
        'title-bar title-bar-row flex-none',
        useMobileHeight && 'title-bar-row-mobile',
        macTrafficInset && 'title-bar-row-mac-inset',
        className
      )}
      {...props}
    >
      {children}
    </Flex>
  )
}

export default TitleBarRow
