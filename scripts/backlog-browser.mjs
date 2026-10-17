import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const style = `body{font:17px/1.65 system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 24px;color:#222;background:#fafafa}a{color:#1656ad}pre{overflow:auto;padding:16px;background:#eee}code{font-size:.9em}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}blockquote{border-left:4px solid #ccc;margin-left:0;padding-left:16px}header{color:#555;border-bottom:1px solid #ddd;padding-bottom:16px} @media(prefers-color-scheme:dark){body{color:#ddd;background:#181818}a{color:#8ab4f8}pre{background:#252525}th,td{border-color:#555}header{color:#aaa}}`

// Only Markdown within the canonical docs tree is exposed. Links never grant
// access outside it; raw HTML and executable content are not rendered.
export function createDocsServer(docsRoot = resolve(projectRoot, 'docs')) {
  const canonicalRoot = realpath(docsRoot)
  return createServer(async (request, response) => {
    const headers = {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    }
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      response.writeHead(status, { ...headers, 'Content-Type': type })
      response.end(request.method === 'HEAD' ? undefined : body)
    }
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(request.headers.host ?? '')) {
      return send(403, 'Local access only')
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD')
      return send(405, 'Read-only viewer')
    }
    let pathname
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
    } catch {
      return send(400, 'Invalid path')
    }
    if (pathname.includes('\0') || pathname.includes('\\')) return send(400, 'Invalid path')
    if (pathname.endsWith('/')) pathname += 'index.md'
    if (!pathname.endsWith('.md')) return send(404, 'Markdown document not found')
    try {
      const root = await canonicalRoot
      const target = await realpath(resolve(root, `.${pathname}`))
      const subpath = relative(root, target)
      if (subpath === '..' || subpath.startsWith('../') || isAbsolute(subpath)) {
        return send(404, 'Markdown document not found')
      }
      const source = await readFile(target, 'utf8')
      const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
      const markdown = frontmatter ? source.slice(frontmatter[0].length) : source
      const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? subpath
      const h = React.createElement
      const page = h('html', { lang: 'en' },
        h('head', null,
          h('meta', { charSet: 'utf-8' }),
          h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
          h('title', null, title),
          h('style', null, style)),
        h('body', null,
          h('header', null, h('a', { href: '/index.md' }, 'Dango docs'),
            h('p', null, `Read-only · canonical file: docs/${subpath}`)),
          frontmatter && h('details', { open: true }, h('summary', null, 'Document metadata'), h('pre', null, frontmatter[1])),
          h('main', null, h(ReactMarkdown, { remarkPlugins: [remarkGfm], skipHtml: true }, markdown))))
      send(200, `<!doctype html>${renderToStaticMarkup(page)}`, 'text/html; charset=utf-8')
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EISDIR', 'ELOOP'].includes(error.code)) {
        return send(404, 'Markdown document not found')
      }
      console.error('Docs viewer error:', error)
      send(500, 'Could not read document')
    }
  })
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const server = createDocsServer()
  let board
  const stop = () => {
    board?.kill('SIGTERM')
    server.close()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  server.on('error', (error) => {
    console.error('Could not start docs viewer:', error.message)
    process.exitCode = 1
    stop()
  })
  server.listen(6421, '127.0.0.1', () => {
    console.log('Dango docs viewer: http://127.0.0.1:6421/index.md')
    board = spawn('backlog', ['browser', '--no-open'], { cwd: projectRoot, stdio: 'inherit' })
    board.once('error', (error) => {
      console.error('Could not start Backlog:', error.message)
      process.exitCode = 1
      server.close()
    })
    board.once('exit', (code) => {
      process.exitCode = code ?? 0
      server.close()
    })
  })
}
