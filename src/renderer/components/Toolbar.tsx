import NiceModal from '@ebay/nice-modal-react'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import HistoryIcon from '@mui/icons-material/History'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import Save from '@mui/icons-material/Save'
import SearchIcon from '@mui/icons-material/Search'
import WidthNormalIcon from '@mui/icons-material/WidthNormal'
import WidthWideIcon from '@mui/icons-material/WidthWide'
import { MenuItem } from '@mui/material'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import { useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsLargeScreen, useIsSmallScreen } from '@/hooks/useScreenChange'
import platform from '@/platform'
import { deleteSession, useSession } from '@/stores/chatStore'
import { clear as clearSession } from '@/stores/sessionActions'
import { useUIStore } from '@/stores/uiStore'
import * as atoms from '../stores/atoms'
import { ConfirmDeleteMenuItem } from './ConfirmDeleteButton'
import StyledMenu from './StyledMenu'
import UpdateAvailableButton from './UpdateAvailableButton'

/**
 * 顶部标题工具栏（右侧）
 * @returns
 */
export default function Toolbar({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const isLargeScreen = useIsLargeScreen()

  const [showUpdateNotification, setShowUpdateNotification] = useState(false)
  const setOpenSearchDialog = useUIStore((s) => s.setOpenSearchDialog)
  const setThreadHistoryDrawerOpen = useSetAtom(atoms.showThreadHistoryDrawerAtom)
  const widthFull = useUIStore((s) => s.widthFull)
  const setWidthFull = useUIStore((s) => s.setWidthFull)

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  useEffect(() => {
    const offUpdateDownloaded = platform.onUpdateDownloaded(() => {
      setShowUpdateNotification(true)
    })
    return () => {
      offUpdateDownloaded()
    }
  }, [setShowUpdateNotification])

  const handleMoreMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    event.preventDefault()
    setAnchorEl(event.currentTarget)
  }
  const handleMoreMenuClose = () => {
    setAnchorEl(null)
  }
  const handleExportAndSave = () => {
    NiceModal.show('export-chat')
    handleMoreMenuClose()
  }
  const handleSessionClean = () => {
    void clearSession(sessionId)
    handleMoreMenuClose()
  }
  const handleSessionDelete = () => {
    void deleteSession(sessionId)
    handleMoreMenuClose()
  }

  return (
    <Box className="controls">
      {showUpdateNotification && <UpdateAvailableButton sx={{ mr: 2 }} />}
      {isSmallScreen ? (
        <IconButton
          color="inherit"
          aria-label="menu"
          onClick={() => setOpenSearchDialog(true)}
          sx={{
            mr: 0.5,
          }}
        >
          <SearchIcon />
        </IconButton>
      ) : (
        <Button
          component="label"
          variant="outlined"
          color="inherit"
          startIcon={<SearchIcon />}
          sx={{ mr: 1 }}
          onClick={() => setOpenSearchDialog(true)}
          size="small"
          className="transform-none opacity-30"
        >
          <span className="justify-between transform-none text-sm" style={{ textTransform: 'none' }}>
            <span className="mr-1">{t('Search')}...</span>
            {/* <span className='text-xs bg-slate-600 opacity-60 text-white border border-solid px-0.5 border-slate-600'>
                                    Ctrl K
                                </span> */}
          </span>
        </Button>
      )}
      {isLargeScreen && (
        <IconButton
          color="inherit"
          aria-label="width-full-button"
          onClick={() => setWidthFull(!widthFull)}
          sx={{
            mr: 0.5,
          }}
        >
          {widthFull ? <WidthWideIcon /> : <WidthNormalIcon />}
        </IconButton>
      )}
      <IconButton
        color="inherit"
        aria-label="thread-history-drawer-button"
        sx={{
          mr: 0.5,
        }}
        onClick={() => setThreadHistoryDrawerOpen(true)}
      >
        <HistoryIcon />
      </IconButton>
      <IconButton color="inherit" aria-label="more-menu-button" onClick={handleMoreMenuOpen}>
        <MoreHorizIcon />
      </IconButton>
      <StyledMenu anchorEl={anchorEl} open={open} onClose={handleMoreMenuClose}>
        <MenuItem onClick={handleExportAndSave} disableRipple divider>
          <Save fontSize="small" />
          {t('Export Chat')}
        </MenuItem>
        <ConfirmDeleteMenuItem
          onDelete={handleSessionClean}
          label={t('Clear All Messages')}
          color="warning"
          icon={<CleaningServicesIcon fontSize="small" />}
        />
        <ConfirmDeleteMenuItem onDelete={handleSessionDelete} label={t('Delete Current Session')} />
      </StyledMenu>
    </Box>
  )
}
