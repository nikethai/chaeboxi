import { Flex, Text } from '@mantine/core'
import type { FC } from 'react'

export type CustomProviderIconProps = {
  providerId: string
  providerName: string
  size?: number
}

const BG_COLORS = [
  '#1ABC9C', // (legacy)
  '#3498DB', // (legacy)
  '#9B59B6', // (legacy)
  '#E67E22', // (legacy)
  '#E74C3C', // (legacy)
  '#2ECC71', // (legacy)
  '#34495E', // (legacy)
  '#F1C40F', // (legacy)
  '#F39C12', // (legacy)
  '#16A085', // (legacy)
  '#2980B9', // (legacy)
  '#8E44AD', // (legacy)
  '#2C3E50', // (legacy)
  '#C0392B', // (legacy)
  '#27AE60', // (legacy)
  '#7F8C8D', // (legacy)
]

const DEFAULT_SIZE = 32

export const CustomProviderIcon: FC<CustomProviderIconProps> = ({ providerId, providerName, size = DEFAULT_SIZE }) => {
  const char = providerName.slice(0, 1).toUpperCase() || 'X'
  const color = BG_COLORS[providerId.split('').reduce((sum, cur) => sum + cur.charCodeAt(0), 0) % BG_COLORS.length]
  const textScale = size / DEFAULT_SIZE
  return (
    <Flex w={size} h={size} bg={color} align="center" justify="center" className="rounded-full overflow-hidden">
      <Text span c="white" fz={16} fw="500" lh={1} style={{ transform: `scale(${textScale})` }}>
        {char}
      </Text>
    </Flex>
  )
}

export default CustomProviderIcon
