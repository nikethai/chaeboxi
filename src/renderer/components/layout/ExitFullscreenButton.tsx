import { debounce } from 'lodash'
import { useEffect, useState } from 'react'
import platform from '@/platform'

/**
 * (legacy comment)
 * @returns
 */
export default function ExitFullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const checkFullscreen = async () => {
      const isFullscreen = await platform.isFullscreen()
      setIsFullscreen(isFullscreen)
    }
    // (legacy comment removed)
    checkFullscreen()
    // (legacy comment removed)
    const handleResize = debounce(() => {
      checkFullscreen()
    }, 1 * 1000)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])
  const onClick = () => {
    platform.setFullscreen(false)
  }
  if (!isFullscreen) {
    return null
  }
  return (
    <div
      className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-3 cursor-move hover:bg-gray-400/20"
      onClick={onClick}
    ></div>
  )
}
