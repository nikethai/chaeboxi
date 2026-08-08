/**
 * Shared agent avatar — blob / URL / procedural SVG (never letter-only for known ids).
 */

import { Avatar, type AvatarProps } from '@mantine/core'
import type { AgentRole, CopilotDetail } from '@shared/types'
import clsx from 'clsx'
import { type CSSProperties, type FC, useMemo } from 'react'
import { ImageInStorage } from '@/components/Image'
import {
  resolveAgentAvatar,
  resolveOpenClawAgentAvatar,
  type ResolvedAgentAvatar,
} from '@/packages/agents'

export type AgentAvatarProps = {
  size?: number
  agent?: Pick<CopilotDetail, 'id' | 'role' | 'avatarSeed' | 'avatarKey' | 'picUrl' | 'emojiAvatar'> | null
  /** When agent object is unavailable */
  agentId?: string
  role?: AgentRole
  avatarSeed?: string
  avatarKey?: string
  picUrl?: string
  /** OpenClaw gateway agents */
  openClaw?: boolean
  className?: string
  /** Pre-resolved avatar (skip recompute) */
  resolved?: ResolvedAgentAvatar | null
} & Omit<AvatarProps, 'src' | 'size' | 'children'>

export const AgentAvatar: FC<AgentAvatarProps> = ({
  size = 28,
  agent,
  agentId,
  role,
  avatarSeed,
  avatarKey,
  picUrl,
  openClaw,
  className,
  resolved,
  ...avatarProps
}) => {
  const avatar = useMemo((): ResolvedAgentAvatar | null => {
    if (resolved) return resolved
    if (openClaw && (agentId || agent?.id)) {
      return resolveOpenClawAgentAvatar(agentId || agent!.id)
    }
    const input = agent || {
      id: agentId || '',
      role,
      avatarSeed,
      avatarKey,
      picUrl,
    }
    if (!input.id) return null
    return resolveAgentAvatar(input)
  }, [resolved, openClaw, agent, agentId, role, avatarSeed, avatarKey, picUrl])

  if (!avatar) {
    return (
      <Avatar
        size={size}
        radius={size / 2}
        className={clsx('overflow-hidden shrink-0', className)}
        bg="chatbox-tertiary"
        {...avatarProps}
      />
    )
  }

  if (avatar.kind === 'blob') {
    return (
      <Avatar
        size={size}
        radius={size / 2}
        bd={0}
        className={clsx('overflow-hidden shrink-0', className)}
        {...avatarProps}
      >
        <ImageInStorage storageKey={avatar.storageKey} className="object-cover object-center w-full h-full" />
      </Avatar>
    )
  }

  if (avatar.kind === 'url' || avatar.kind === 'procedural') {
    const src = avatar.kind === 'url' ? avatar.url : avatar.src
    return (
      <Avatar
        size={size}
        radius={size / 2}
        bd={0}
        src={src}
        className={clsx('overflow-hidden shrink-0', className)}
        style={
          {
            outline: '1px solid rgba(0,0,0,0.12)',
            outlineOffset: 0,
            ...(avatarProps.style as CSSProperties | undefined),
          } as CSSProperties
        }
        {...avatarProps}
      />
    )
  }

  // emoji legacy (rarely used after resolve prefers procedural)
  return (
    <Avatar size={size} radius={size / 2} className={clsx('overflow-hidden shrink-0', className)} {...avatarProps}>
      {avatar.emoji}
    </Avatar>
  )
}

export default AgentAvatar
