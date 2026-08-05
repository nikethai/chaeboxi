import { Flex, Image, Text } from '@mantine/core'
import clsx from 'clsx'
import type { FC } from 'react'
import icon from '@/static/icon.png'

export type ChaeboxiWordmarkProps = {
  /** Visual density — rail head vs larger surfaces */
  size?: 'rail' | 'about'
  className?: string
}

/**
 * Product brand lockup: mark + wordmark, left-aligned.
 * Distinct from body UI text (tracking + weight).
 */
export const ChaeboxiWordmark: FC<ChaeboxiWordmarkProps> = ({ size = 'rail', className }) => {
  const isRail = size === 'rail'
  const mark = isRail ? 20 : 28
  const typeSize = isRail ? 'sm' : 'lg'

  return (
    <Flex align="center" gap={isRail ? 7 : 10} miw={0} className={clsx('chaeboxi-wordmark min-w-0', className)}>
      <Image
        src={icon}
        w={mark}
        h={mark}
        alt=""
        aria-hidden
        className="chaeboxi-wordmark-mark shrink-0 rounded-[5px]"
      />
      <Text
        span
        c="chatbox-primary"
        size={typeSize}
        lh={1.15}
        fw={600}
        className={clsx('tracking-tight truncate select-none', isRail ? 'text-[0.9rem]' : 'text-[1.15rem]')}
        style={{ letterSpacing: '-0.03em' }}
      >
        Chaeboxi
      </Text>
    </Flex>
  )
}

export default ChaeboxiWordmark
