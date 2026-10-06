function inline(text: string, escapeHtml: (value: string) => string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

function renderBlocks(source: string, escapeHtml: (value: string) => string): string {
  const lines = source.split('\n')
  let html = ''
  let para: string[] = []
  let list: string[] = []
  const flushPara = () => {
    if (para.length === 0) return
    html += `<p>${inline(para.join(' '), escapeHtml)}</p>`
    para = []
  }
  const flushList = () => {
    if (list.length === 0) return
    html += `<ul class="akcp-check">${list.map((item) => `<li>${inline(item, escapeHtml)}</li>`).join('')}</ul>`
    list = []
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushPara()
      flushList()
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (heading) {
      flushPara()
      flushList()
      const level = Math.min(heading[1].length + 1, 4)
      html += `<h${level}>${inline(heading[2], escapeHtml)}</h${level}>`
      continue
    }
    if (trimmed.startsWith('> ')) {
      flushPara()
      flushList()
      html += `<blockquote>${inline(trimmed.slice(2), escapeHtml)}</blockquote>`
      continue
    }
    if (trimmed.startsWith('- ')) {
      flushPara()
      list.push(trimmed.slice(2))
      continue
    }
    flushList()
    para.push(trimmed)
  }
  flushPara()
  flushList()
  return html
}

/** Small Markdown subset for vendored lesson text. Text is escaped before tags are added. */
export function renderLesson(markdown: string, escapeHtml: (value: string) => string): string {
  const parts = markdown.split('```')
  let html = ''
  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      const newline = part.indexOf('\n')
      const code = newline === -1 ? part : part.slice(newline + 1)
      html += `<pre class="bash-code"><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`
      return
    }
    html += renderBlocks(part, escapeHtml)
  })
  return html
}
