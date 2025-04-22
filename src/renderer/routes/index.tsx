import { currentSessionAtom } from '@/stores/atoms'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import icon from '@/static/icon.png'
import { Typography } from '@mui/material'
export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const navigate = useNavigate()
  const currentSession = useAtomValue(currentSessionAtom)

  useEffect(() => {
    if (!currentSession) {
      return
    }
    navigate({
      to: `/session/${currentSession?.id}`,
      replace: true,
    })
  }, [currentSession])
  
  return (
    <div className="p-2 flex flex-col items-center justify-center h-full">
      <img src={icon} className="w-32 h-32 align-middle" />
      <Typography variant="h4">Chatbox</Typography>
    </div>
  )
}
