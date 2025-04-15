import type { SearchResultItem } from '@/packages/web-search'
import { ChevronDown, ChevronUp, ExternalLink, Globe } from 'lucide-react'
import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MessageToolCallPart } from 'src/shared/types'
import LinkTargetBlank from '../Link'
import { LoadingBubble } from '../MessageLoading'

type WebBrowsingToolCallPart = MessageToolCallPart<
  { query: string },
  { query: string; searchResults: SearchResultItem[] }
>

interface Props {
  part: MessageToolCallPart
}

export const ToolCallPartUI: FC<Props> = ({ part }) => {
  if (part.toolName !== 'web_search') {
    return null
  }
  if (part.state === 'call') {
    return <WebBrowsingLoading />
  }
  return <WebBrowsingCard webBrowsing={part as WebBrowsingToolCallPart} />
}

const WebBrowsingLoading = () => {
  const { t } = useTranslation()
  return (
    <div>
      <LoadingBubble>
        <span className="flex flex-col">
          <span>{t('Web Browsing...')}</span>
          <span className="text-[10px] opacity-70 font-normal">
            {t('Browsing and retrieving information from the internet.')}
          </span>
        </span>
      </LoadingBubble>
    </div>
  )
}

function WebBrowsingCard(props: { webBrowsing: WebBrowsingToolCallPart }) {
  const result = props.webBrowsing.result
  const [showAll, setShowAll] = useState(false)
  const DISPLAY_LINKS_COUNT = 4

  if (!result) {
    return null
  }

  const displayItems = useMemo(() => {
    return showAll ? result.searchResults : result.searchResults.slice(0, DISPLAY_LINKS_COUNT)
  }, [result.searchResults, showAll])

  if (displayItems.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-1.5 mt-1.5 p-2 rounded bg-blue-50/80 dark:bg-blue-900/20 border border-blue-300/30 dark:border-blue-600/30">
      <div className="flex flex-col gap-1.5 px-1.5 py-1 text-xs">
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium bg-blue-100/90 dark:bg-blue-500/30 px-2.5 py-1 rounded-full inline-block max-w-full">
              <span className="block truncate">{result.query}</span>
            </span>
          </div>
          {result.searchResults.length > DISPLAY_LINKS_COUNT && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="cursor-pointer
                            bg-white dark:bg-blue-500/30
                            hover:bg-blue-50 dark:hover:bg-blue-500/20 
                            text-blue-600 dark:text-blue-400
                            px-2 py-0.5 rounded-full
                            border border-blue-400/30
                            transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              {showAll ? (
                <ChevronUp size={14} />
              ) : (
                <>
                  <span className="text-xs opacity-80">+{result.searchResults.length - DISPLAY_LINKS_COUNT}</span>
                  <ChevronDown size={14} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="px-0.5">
        {displayItems.map((item, index) => (
          <div key={index}>
            <span className="text-xs text-gray-500 dark:text-gray-500">[{index + 1}]</span>
            <LinkTargetBlank
              key={index}
              href={item.link}
              className="text-xs py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-1.5"
            >
              <span className="whitespace-pre-wrap flex-1 break-all">{item.title}</span>
              <ExternalLink className="w-2.5 h-2.5 ml-1.5 text-gray-500 flex-shrink-0" />
            </LinkTargetBlank>
          </div>
        ))}
      </div>
    </div>
  )
}
