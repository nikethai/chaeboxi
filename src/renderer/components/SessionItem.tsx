import NiceModal from '@ebay/nice-modal-react'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import CopyIcon from '@mui/icons-material/CopyAll'
import EditIcon from '@mui/icons-material/Edit'
import MoreHorizOutlinedIcon from '@mui/icons-material/MoreHorizOutlined'
import StarIcon from '@mui/icons-material/Star'
import StarOutlineIcon from '@mui/icons-material/StarOutline'
import VrpanoIcon from '@mui/icons-material/Vrpano'
import { Avatar, IconButton, ListItemIcon, ListItemText, MenuItem, Typography, useTheme } from '@mui/material'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionMeta } from 'src/shared/types'
import { ImageInStorage } from '@/components/Image'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { cn } from '@/lib/utils'
import {
  deleteSession as deleteSessionStore,
  getSession,
  updateSession as updateSessionStore,
} from '@/stores/chatStore'
import { copyAndSwitchSession, switchCurrentSession } from '@/stores/sessionActions'
import { useUIStore } from '@/stores/uiStore'
import { ConfirmDeleteMenuItem } from './ConfirmDeleteButton'
import StyledMenu from './StyledMenu'

export interface Props {
  session: SessionMeta
  selected: boolean
}

function _SessionItem(props: Props) {
  const { session, selected } = props
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    event.preventDefault()
    setAnchorEl(event.currentTarget)
  }
  const handleMenuClose = () => {
    setAnchorEl(null)
  }
  const onClick = () => {
    switchCurrentSession(session.id)
    if (isSmallScreen) {
      setShowSidebar(false)
    }
  }
  const theme = useTheme()
  const medianSize = theme.typography.pxToRem(24)
  const isSmallScreen = useIsSmallScreen()
  // const smallSize = theme.typography.pxToRem(20)
  return (
    <>
      <MenuItem
        key={session.id}
        selected={selected}
        onClick={onClick}
        sx={{ padding: '0.1rem', margin: '0.1rem' }}
        className="group/session-item"
      >
        <ListItemIcon>
          <IconButton onClick={onClick}>
            {session.assistantAvatarKey ? (
              <Avatar
                sizes={medianSize}
                sx={{
                  width: medianSize,
                  height: medianSize,
                  backgroundColor: theme.palette.primary.main,
                }}
              >
                <ImageInStorage
                  storageKey={session.assistantAvatarKey}
                  className="object-cover object-center w-full h-full"
                />
              </Avatar>
            ) : session.picUrl ? (
              <Avatar sizes={medianSize} sx={{ width: medianSize, height: medianSize }} src={session.picUrl} />
            ) : session.type === 'picture' ? (
              <VrpanoIcon fontSize="small" />
            ) : (
              <ChatBubbleOutlineOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </ListItemIcon>
        <ListItemText>
          <Typography variant="inherit" noWrap>
            {session.name}
          </Typography>
        </ListItemText>
        <span
          className={cn(
            session.starred || anchorEl || isSmallScreen ? 'inline-flex' : 'hidden group-hover/session-item:inline-flex'
          )}
        >
          <IconButton onClick={handleMenuClick} sx={{ color: 'primary.main' }}>
            {session.starred ? <StarIcon fontSize="small" /> : <MoreHorizOutlinedIcon fontSize="small" />}
          </IconButton>
        </span>
      </MenuItem>
      <StyledMenu
        MenuListProps={{
          'aria-labelledby': 'long-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
      >
        <MenuItem
          key={`${session.id}edit`}
          onClick={async () => {
            NiceModal.show('session-settings', {
              session: await getSession(session.id),
            })
            handleMenuClose()
          }}
          disableRipple
        >
          <EditIcon fontSize="small" />
          {t('edit')}
        </MenuItem>

        <MenuItem
          key={`${session.id}copy`}
          onClick={() => {
            copyAndSwitchSession(session)
            handleMenuClose()
          }}
          disableRipple
        >
          <CopyIcon fontSize="small" />
          {t('copy')}
        </MenuItem>
        <MenuItem
          key={`${session.id}star`}
          onClick={() => {
            void updateSessionStore(session.id, (s) => {
              if (!s) {
                throw new Error(`Session ${session.id} not found`)
              }
              return { ...s, starred: !s?.starred }
            })
            handleMenuClose()
          }}
          disableRipple
          divider
        >
          {session.starred ? (
            <>
              <StarOutlineIcon fontSize="small" />
              {t('unstar')}
            </>
          ) : (
            <>
              <StarIcon fontSize="small" />
              {t('star')}
            </>
          )}
        </MenuItem>

        <ConfirmDeleteMenuItem
          onDelete={() => {
            setAnchorEl(null)
            handleMenuClose()
            void deleteSessionStore(session.id)
          }}
        />
      </StyledMenu>
    </>
  )
}

export default function Session(props: Props) {
  return useMemo(() => {
    return <_SessionItem {...props} />
  }, [props.session, props.selected])
}
