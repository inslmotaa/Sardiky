/**
 * Markdown simples dos Conteúdos (blog), sem biblioteca e sem HTML cru: o texto vira uma árvore
 * de blocos e trechos que o componente <Markdown> transforma em elementos React. Qualquer
 * HTML digitado aparece como texto; links só com http(s), mailto ou caminhos do próprio site.
 *
 * Suportado: ## e ### títulos, parágrafos, **negrito**, *itálico* (ou _itálico_), `código`,
 * [links](https://...), listas com "-"/"*" ou "1.", citações com ">" e linha "---".
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; external: boolean; c: Inline[] }

export type Block =
  | { t: 'h2' | 'h3'; c: Inline[] }
  | { t: 'p'; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] }
  | { t: 'quote'; c: Inline[] }
  | { t: 'hr' }

/** Endereço permitido num link: http(s), mailto ou caminho interno ("/planos", "#secao"). */
export function safeHref(raw: string): { href: string; external: boolean } | null {
  const v = raw.trim()
  if (/^\/(?!\/)/.test(v) || /^#[\w-]*$/.test(v)) return { href: v, external: false }
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(v)) return { href: v, external: false }
  try {
    const u = new URL(v)
    if (u.protocol === 'http:' || u.protocol === 'https:') return { href: u.toString(), external: true }
  } catch {
    /* endereço inválido */
  }
  return null
}

/** Trechos de uma linha: código, links, negrito e itálico (aninháveis, exceto código). */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let buf = ''
  const flush = () => {
    if (buf) out.push({ t: 'text', v: buf })
    buf = ''
  }
  let i = 0
  while (i < src.length) {
    const rest = src.slice(i)
    // `código`
    let m = /^`([^`]+)`/.exec(rest)
    if (m) {
      flush()
      out.push({ t: 'code', v: m[1] })
      i += m[0].length
      continue
    }
    // [texto](endereço)
    m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest)
    if (m) {
      const link = safeHref(m[2])
      flush()
      if (link) out.push({ t: 'link', ...link, c: parseInline(m[1]) })
      else out.push(...parseInline(m[1])) // endereço não permitido: fica só o texto
      i += m[0].length
      continue
    }
    // **negrito** ou __negrito__
    m = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest)
    if (m) {
      flush()
      out.push({ t: 'strong', c: parseInline(m[2]) })
      i += m[0].length
      continue
    }
    // *itálico* ou _itálico_ (o "_" só no começo de palavra, para não pegar nomes_com_sublinhado)
    m = /^\*(?=\S)([^*]*?\S)\*/.exec(rest) ?? (/[\w]$/.test(buf) ? null : /^_(?=\S)([^_]*?\S)_(?!\w)/.exec(rest))
    if (m) {
      flush()
      out.push({ t: 'em', c: parseInline(m[1]) })
      i += m[0].length
      continue
    }
    buf += src[i]
    i++
  }
  flush()
  return out
}

/** Texto em Markdown → blocos. */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let list: { t: 'ul' | 'ol'; items: string[] } | null = null
  let quote: string[] = []

  const flushPara = () => {
    if (para.length) blocks.push({ t: 'p', c: parseInline(para.join(' ')) })
    para = []
  }
  const flushList = () => {
    if (list) blocks.push({ t: list.t, items: list.items.map(parseInline) })
    list = null
  }
  const flushQuote = () => {
    if (quote.length) blocks.push({ t: 'quote', c: parseInline(quote.join(' ')) })
    quote = []
  }
  const flushAll = () => {
    flushPara()
    flushList()
    flushQuote()
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushAll()
      continue
    }
    let m: RegExpExecArray | null
    if ((m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line))) {
      flushAll()
      // "#" vira h2: o título do post já é o h1 da página.
      blocks.push({ t: m[1].length <= 2 ? 'h2' : 'h3', c: parseInline(m[2]) })
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushAll()
      blocks.push({ t: 'hr' })
      continue
    }
    if ((m = /^>\s?(.*)$/.exec(line))) {
      flushPara()
      flushList()
      quote.push(m[1])
      continue
    }
    const ul = /^[-*+]\s+(.+)$/.exec(line)
    const ol = /^\d{1,3}[.)]\s+(.+)$/.exec(line)
    if (ul || ol) {
      flushPara()
      flushQuote()
      const kind = ul ? 'ul' : 'ol'
      if (!list || list.t !== kind) {
        flushList()
        list = { t: kind, items: [] }
      }
      list.items.push((ul ?? ol)![1])
      continue
    }
    if (list && /^\s{2,}\S/.test(raw)) {
      // continuação recuada do último item
      list.items[list.items.length - 1] += ` ${line}`
      continue
    }
    flushList()
    flushQuote()
    para.push(line)
  }
  flushAll()
  return blocks
}

/** Texto puro (sem marcação), para resumo automático e tempo de leitura. */
export function plainText(src: string): string {
  const inl = (c: Inline[]): string => c.map((x) => (x.t === 'text' || x.t === 'code' ? x.v : inl(x.c))).join('')
  return parseMarkdown(src)
    .map((b) => (b.t === 'hr' ? '' : 'items' in b ? b.items.map(inl).join(' ') : inl(b.c)))
    .filter(Boolean)
    .join(' ')
}

/** Minutos de leitura (cerca de 200 palavras por minuto, mínimo 1). */
export function readingMinutes(src: string): number {
  const words = plainText(src).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
