import AddIcon from '@mui/icons-material/AddCircleOutline'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SettingsIcon from '@mui/icons-material/Settings'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import {
  Box,
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import { IconCode } from '@tabler/icons-react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { PanelLeftClose } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import SessionList from './components/SessionList'
import { FORCE_ENABLE_DEV_PAGES } from './dev/devToolsConfig'
import useNeedRoomForMacWinControls from './hooks/useNeedRoomForWinControls'
import { useIsSmallScreen, useSidebarWidth } from './hooks/useScreenChange'
import useVersion from './hooks/useVersion'
import { cn } from './lib/utils'
import { navigateToSettings } from './modals/Settings'
import { trackingEvent } from './packages/event'
import icon from './static/icon.png'
import { createEmpty } from './stores/sessionActions'
import { useLanguage } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { CHATBOX_BUILD_PLATFORM } from './variables'

export default function Sidebar() {
  const language = useLanguage()
  const showSidebar = useUIStore((s) => s.showSidebar)
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)

  const sessionListRef = useRef<HTMLDivElement>(null)

  const sidebarWidth = useSidebarWidth()

  const isSmallScreen = useIsSmallScreen()

  const theme = useTheme()

  const { needRoomForMacWindowControls } = useNeedRoomForMacWinControls()

  return (
    <div>
      <SwipeableDrawer
        anchor={language === 'ar' ? 'right' : 'left'}
        variant={isSmallScreen ? 'temporary' : 'persistent'}
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        onOpen={() => setShowSidebar(true)}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: sidebarWidth,
          },
        }}
        SlideProps={language === 'ar' ? { direction: 'left' } : undefined}
        PaperProps={language === 'ar' ? { sx: { direction: 'rtl' } } : undefined}
        disableSwipeToOpen={CHATBOX_BUILD_PLATFORM !== 'ios'} // 只在iOS设备上启用SwipeToOpen
      >
        <div className="ToolBar h-full">
          <Stack
            // 在 Mac 上给窗口控制按钮留出空间, 更完善的话切换到全屏时不需要留空间，但需要监听全屏状态变化，暂时不考虑
            className={cn('pl-2 pr-1')}
            sx={{
              height: '100%',
            }}
          >
            <Box className={cn('flex title-bar items-center', needRoomForMacWindowControls ? 'pt-12' : 'pt-3')}></Box>
            <Box className={cn('flex justify-between items-center p-0 m-0 mx-2 mb-2')}>
              <Box className="title-bar">
                <img src={icon} className="w-6 h-6 mr-2 align-middle inline-block" />
                <span className="text-xl font-semibold align-middle inline-block opacity-75">Chatbox</span>
              </Box>
              <Box onClick={() => setShowSidebar(!showSidebar)}>
                <IconButton
                  sx={
                    isSmallScreen
                      ? {
                          borderColor: theme.palette.action.hover,
                          borderStyle: 'solid',
                          borderWidth: 1,
                        }
                      : {}
                  }
                >
                  <PanelLeftClose size="20" strokeWidth={1.5} />
                </IconButton>
              </Box>
            </Box>

            <SessionList sessionListRef={sessionListRef} />

            <Divider variant="fullWidth" />

            <Box sx={isSmallScreen ? {} : { marginBottom: '20px' }}>
              <SidebarButtons sessionListRef={sessionListRef} />
            </Box>
          </Stack>
        </div>
      </SwipeableDrawer>
    </div>
  )
}

function SidebarButtons(props: { sessionListRef: React.RefObject<HTMLDivElement> }) {
  const { sessionListRef } = props
  const { t } = useTranslation()
  const versionHook = useVersion()
  const routerState = useRouterState()
  const navigate = useNavigate()
  const setShowSidebar = useUIStore((s) => s.setShowSidebar)
  const isSmallScreen = useIsSmallScreen()
  const handleCreateNewSession = useCallback(() => {
    // sessionActions.createEmpty('chat')
    // if (sessionListRef.current) {
    //   sessionListRef.current.scrollTo(0, 0)
    // }
    navigate({ to: `/` })

    // On small screen, when click create new session happens
    // while path does not change, automatic hide sidebar won't take effect.
    // So trigger by ourself.
    if (isSmallScreen) {
      setShowSidebar(false)
    }
    trackingEvent('create_new_conversation', { event_category: 'user' })
  }, [navigate, setShowSidebar, isSmallScreen])

  const handleCreateNewPictureSession = () => {
    void createEmpty('picture')
    if (sessionListRef.current) {
      sessionListRef.current.scrollTo(0, 0)
    }
    if (isSmallScreen) {
      setShowSidebar(false)
    }
    trackingEvent('create_new_picture_conversation', { event_category: 'user' })
  }

  return (
    <MenuList>
      <Box className="flex flex-col m-1 mb-2 gap-2">
        <Button variant="outlined" className="w-full gap-2" size="large" onClick={handleCreateNewSession}>
          <AddIcon fontSize="small" />
          <span className="flex flex-col normal-case">
            <span>{t('New Chat')}</span>
            <span className="opacity-0 h-0">{t('New Images')}</span>
          </span>
        </Button>

        <Button variant="outlined" className="w-full gap-2 " size="large" onClick={handleCreateNewPictureSession}>
          <AddPhotoAlternateIcon fontSize="small" />
          <span className="flex flex-col normal-case">
            <span className="opacity-0 h-0">{t('New Chat')}</span>
            <span>{t('New Images')}</span>
          </span>
        </Button>
      </Box>

      {/* <MenuItem onClick={handleCreateNewSession} sx={{ padding: '0.2rem 0.1rem', margin: '0.1rem' }}>
        <ListItemIcon>
          <IconButton>
            <AddIcon fontSize="small" />
          </IconButton>
        </ListItemIcon>
        <ListItemText>{t('new chat')}</ListItemText>
        <Typography variant="body2" color="text.secondary">
        </Typography>
      </MenuItem>

      <MenuItem onClick={handleCreateNewPictureSession} sx={{ padding: '0.2rem 0.1rem', margin: '0.1rem' }}>
        <ListItemIcon>
          <IconButton>
            <AddPhotoAlternateIcon fontSize="small" />
          </IconButton>
        </ListItemIcon>
        <ListItemText>{t('New Images')}</ListItemText>
        <Typography variant="body2" color="text.secondary">
        </Typography>
      </MenuItem> */}

      <MenuItem
        onClick={() => {
          navigate({
            to: '/copilots',
          })
          if (isSmallScreen) {
            setShowSidebar(false)
          }
        }}
        selected={routerState.location.pathname === '/copilots'}
        sx={{ padding: '0.2rem 0.1rem', margin: '0.1rem' }}
      >
        <ListItemIcon>
          <IconButton>
            <SmartToyIcon fontSize="small" />
          </IconButton>
        </ListItemIcon>
        <ListItemText>
          <Typography>{t('My Copilots')}</Typography>
        </ListItemText>
      </MenuItem>

      <MenuItem
        onClick={() => {
          navigateToSettings()
          if (isSmallScreen) {
            setShowSidebar(false)
          }
        }}
        selected={routerState.location.pathname.startsWith('/settings')}
        sx={{ padding: '0.2rem 0.1rem', margin: '0.1rem' }}
      >
        <ListItemIcon>
          <IconButton>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </ListItemIcon>
        <ListItemText>{t('Settings')}</ListItemText>
        <Typography variant="body2" color="text.secondary">
          {/* ⌘N */}
        </Typography>
      </MenuItem>

      {/* Show Dev menu only in development mode */}
      {FORCE_ENABLE_DEV_PAGES && (
        <MenuItem
          onClick={() => {
            navigate({
              to: '/dev',
            })
            if (isSmallScreen) {
              setShowSidebar(false)
            }
          }}
          selected={routerState.location.pathname.startsWith('/dev')}
          sx={{ padding: '0.2rem 0.1rem', margin: '0.1rem' }}
        >
          <ListItemIcon>
            <IconButton>
              <IconCode size={18} />
            </IconButton>
          </ListItemIcon>
          <ListItemText>
            <Typography>Dev Tools</Typography>
          </ListItemText>
        </MenuItem>
      )}

      <MenuItem
        onClick={() => {
          navigate({
            to: '/about',
          })
          if (isSmallScreen) {
            setShowSidebar(false)
          }
        }}
        selected={routerState.location.pathname === '/about'}
        sx={{ padding: '0.2rem 0.1rem', margin: '0.1rem' }}
      >
        <ListItemIcon>
          <IconButton>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </ListItemIcon>
        <ListItemText>
          <Typography sx={{ opacity: 0.5 }}>
            {t('About')}
            {/\d/.test(versionHook.version) ? `(${versionHook.version})` : ''}
          </Typography>
        </ListItemText>
      </MenuItem>
    </MenuList>
  )
}
