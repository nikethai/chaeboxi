import { useComputedColorScheme } from '@mantine/core'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

export function WorkspaceCodeView(props: { code: string; language?: string }) {
  const { code, language = 'text' } = props
  const colorScheme = useComputedColorScheme()

  return (
    <div className="workspace-code">
      <SyntaxHighlighter
        style={colorScheme !== 'light' ? oneDark : oneLight}
        language={language}
        PreTag="div"
        showLineNumbers
        customStyle={{
          margin: 0,
          padding: '1rem 1.15rem',
          borderRadius: 0,
          border: 'none',
          background: 'transparent',
          fontSize: '0.75rem',
          lineHeight: 1.55,
          minHeight: '100%',
        }}
        lineNumberStyle={{
          minWidth: '2.25em',
          paddingRight: '0.85em',
          opacity: 0.45,
          fontVariantNumeric: 'tabular-nums',
        }}
        codeTagProps={{
          className: '!bg-transparent',
          style: { fontFamily: 'var(--chatbox-font-mono)' },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
