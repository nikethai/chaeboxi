import Header from '@/components/Header'
import InputBox from '@/components/InputBox'
import MessageList from '@/components/MessageList'
import ThreadHistoryDrawer from '@/components/ThreadHistoryDrawer'
import * as atoms from '@/stores/atoms'
import * as scrollActions from '@/stores/scrollActions'
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown'
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp'
import { Box, ButtonGroup, IconButton } from '@mui/material'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
export const Route = createFileRoute('/session/$sessionId')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { sessionId: currentSessionId } = Route.useParams()
  const currentSession = useAtomValue(atoms.currentSessionAtom)

  useEffect(() => {
    setTimeout(() => {
      scrollActions.scrollToBottom('auto') // 每次启动时自动滚动到底部
    }, 200)
  }, [])


  return currentSession ? (
    <div className="flex flex-col h-full">
      {/* {
                    // 小屏幕的广告UI
                    isSmallScreen && (
                        <Box className="text-center">
                            <SponsorChip />
                        </Box>
                    )
                } */}
      <Header />

      {/* MessageList 设置 key，确保每个 session 对应新的 MessageList 实例 */}
      <MessageList key={currentSessionId} currentSession={currentSession} />

      <ScrollButtons />
      <InputBox />
      <ThreadHistoryDrawer />
    </div>
  ) : null
}

function ScrollButtons() {
  const atScrollTop = useAtomValue(atoms.messageScrollingAtTopAtom)
  const atScrollBottom = useAtomValue(atoms.messageScrollingAtBottomAtom)
  const language = useAtomValue(atoms.languageAtom)
  return (
    <Box className="relative">
      <ButtonGroup
        sx={
          language === 'ar'
            ? {
                position: 'absolute',
                left: '0.4rem',
                top: '-5.5rem',
                opacity: 0.6,
              }
            : {
                position: 'absolute',
                right: '0.4rem',
                top: '-5.5rem',
                opacity: 0.6,
              }
        }
        orientation="vertical"
      >
        <IconButton
          onClick={() => scrollActions.scrollToTop()}
          sx={{
            visibility: atScrollTop ? 'hidden' : 'visible',
          }}
        >
          <ArrowCircleUpIcon />
        </IconButton>
        <IconButton
          onClick={() => scrollActions.scrollToBottom()}
          sx={{
            visibility: atScrollBottom ? 'hidden' : 'visible',
          }}
        >
          <ArrowCircleDownIcon />
        </IconButton>
      </ButtonGroup>
    </Box>
  )
}
