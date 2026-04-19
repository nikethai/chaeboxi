import { useMantineTheme } from '@mantine/core'
import type { IconProps } from '@tabler/icons-react'
import type React from 'react'

type Props = Omit<IconProps, 'size' | 'ref'> & {
  size?: number
  icon: React.ElementType<any>
} & Record<string, unknown>

export function ScalableIcon(props: Props) {
  const { icon: IconComponent, size = 16, ...others } = props
  const theme = useMantineTheme()
  const scale = theme.scale ?? 1
  return <IconComponent size={size * scale} {...others} />
}
