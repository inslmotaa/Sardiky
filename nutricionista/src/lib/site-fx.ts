/**
 * Efeitos do site público em JavaScript puro (sem React), usados no Next e na prévia em arquivo único:
 * fundo "em ação" da abertura (monitor de batimentos), fundo de natureza e alimentos, nome que ocupa
 * a largura disponível, palavra que troca, storytelling ligado à rolagem, entrada suave, números que
 * contam e cabeçalho que ganha fundo ao rolar.
 * initSiteFx devolve a função que desfaz tudo (troca de página no Next).
 */

type Cleanup = () => void

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ------------------- fundo de natureza, alimentos e bem-estar ------------------- */

// Alimentos e símbolos em linha fina (caixa de 48 × 48, centro em 24,24).
const SHAPES = [
  'M24 14c-4-4-14-3-15 7-1 9 5 19 10 19 2 0 3-1 5-1s3 1 5 1c5 0 11-10 10-19-1-10-11-11-15-7zM24 14c0-4 2-7 5-8M27 9c3-3 8-2 9-1-2 3-6 4-9 1z',
  'M8 40C8 22 20 9 40 8c-1 19-13 32-32 32zM10 38C20 28 28 20 38 10',
  'M31 11l7-6M31 11l1-8M31 11h8M31 11c-3-1-6 0-8 2L9 37c-1 2 1 4 3 3l24-13c2-2 3-5 2-8M19 21l3 3M15 28l3 3',
  'M24 44V10M24 18c-4-1-7-4-7-8 4 1 7 4 7 8zM24 18c4-1 7-4 7-8-4 1-7 4-7 8zM24 28c-4-1-7-4-7-8 4 1 7 4 7 8zM24 28c4-1 7-4 7-8-4 1-7 4-7 8zM24 38c-4-1-7-4-7-8 4 1 7 4 7 8zM24 38c4-1 7-4 7-8-4 1-7 4-7 8z',
  'M24 6c-7 0-10 10-13 17-4 9 3 19 13 19s17-10 13-19C34 16 31 6 24 6zM30 30a6 6 0 1 1-12 0 6 6 0 0 1 12 0z',
  'M24 40S8 30 8 18a8 8 0 0 1 16-3 8 8 0 0 1 16 3c0 12-16 22-16 22z',
  'M24 42V24M24 26c-8 0-12-6-12-12 8 0 12 6 12 12zM24 22c6 0 10-5 10-10-6 0-10 5-10 10z',
]

function citrus() {
  const p = new Path2D()
  p.arc(24, 24, 18, 0, Math.PI * 2)
  p.moveTo(38, 24)
  p.arc(24, 24, 14, 0, Math.PI * 2)
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    p.moveTo(24, 24)
    p.lineTo(24 + Math.cos(a) * 13, 24 + Math.sin(a) * 13)
  }
  return p
}

function mountNature(canvas: HTMLCanvasElement, reduce: boolean, seed: number): Cleanup {
  const host = (canvas.closest('[data-nature-host]') as HTMLElement | null) ?? canvas.parentElement!
  const ctx = canvas.getContext('2d')
  if (!ctx || typeof Path2D === 'undefined') return () => {}
  const shapes = [...SHAPES.map((d) => new Path2D(d)), citrus()]
  // Gerador pseudoaleatório com semente: cada bloco tem a sua composição, sempre a mesma.
  let r = 9301 + seed * 49297
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
  const GREEN = '31, 94, 59'
  const LIGHT = '141, 191, 139'
  let w = 0
  let h = 0
  let raf = 0
  let prev = 0
  let t = 3
  let visible = true
  let running = false
  let foods: { x: number; y: number; s: number; a: number; rot: number; vr: number; vy: number; shape: number; ph: number }[] = []
  let seeds: { x: number; y: number; r: number; vy: number; ph: number }[] = []
  let blades: { x: number; hgt: number; ph: number; lean: number }[] = []
  const mouse = { x: -9999, tx: -9999 }

  const layout = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = host.clientWidth
    h = host.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    r = 9301 + seed * 49297
    const n = Math.max(5, Math.min(16, Math.round((w * h) / 70000)))
    foods = Array.from({ length: n }, (_, i) => ({
      x: rand() * w,
      y: rand() * h,
      s: (0.7 + rand() * 0.6) * Math.min(1.3, Math.max(0.75, w / 1100)),
      a: 0.16 + rand() * 0.16,
      rot: rand() * Math.PI * 2,
      vr: (rand() - 0.5) * 0.12,
      vy: 6 + rand() * 9,
      shape: i % shapes.length,
      ph: rand() * Math.PI * 2,
    }))
    seeds = Array.from({ length: Math.round(n * 2.2) }, () => ({ x: rand() * w, y: rand() * h, r: 1 + rand() * 1.8, vy: 10 + rand() * 16, ph: rand() * 6 }))
    blades = []
    for (let x = -4; x < w + 8; x += 7 + rand() * 5) blades.push({ x, hgt: 14 + rand() * 30, ph: rand() * Math.PI * 2, lean: (rand() - 0.5) * 6 })
  }

  const draw = (dt: number) => {
    ctx.clearRect(0, 0, w, h)
    // Sol que "respira" (ciclo de 8 s): inspira, expira.
    const breath = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 8)
    const sx = w * 0.84
    const sy = Math.min(h * 0.22, 150)
    const sr = Math.min(130, Math.max(60, w * 0.08))
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * (1.6 + breath * 0.25))
    sun.addColorStop(0, `rgba(${LIGHT}, 0.3)`)
    sun.addColorStop(1, `rgba(${LIGHT}, 0)`)
    ctx.fillStyle = sun
    ctx.beginPath()
    ctx.arc(sx, sy, sr * (1.6 + breath * 0.25), 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 1
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(${GREEN}, ${0.13 - k * 0.035})`
      ctx.beginPath()
      ctx.arc(sx, sy, sr * (0.55 + k * 0.32) * (0.92 + breath * 0.12), 0, Math.PI * 2)
      ctx.stroke()
    }
    // Sementes subindo devagar.
    for (const p of seeds) {
      p.y -= p.vy * dt
      if (p.y < -6) {
        p.y = h + 6
        p.x = Math.random() * w
      }
      ctx.fillStyle = `rgba(${LIGHT}, 0.55)`
      ctx.beginPath()
      ctx.arc(p.x + Math.sin(t * 0.8 + p.ph) * 8, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    // Alimentos em linha fina, flutuando e girando de leve.
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const f of foods) {
      f.y -= f.vy * dt
      f.rot += f.vr * dt
      if (f.y < -50) {
        f.y = h + 50
        f.x = Math.random() * w
      }
      ctx.save()
      ctx.translate(f.x + Math.sin(t * 0.5 + f.ph) * 14, f.y)
      ctx.rotate(f.rot + Math.sin(t * 0.7 + f.ph) * 0.15)
      ctx.scale(f.s, f.s)
      ctx.translate(-24, -24)
      ctx.strokeStyle = `rgba(${GREEN}, ${f.a})`
      ctx.lineWidth = 1.4 / f.s
      ctx.stroke(shapes[f.shape]!)
      ctx.restore()
    }
    // Grama na base, balançando com o vento e se afastando do mouse.
    mouse.x += (mouse.tx - mouse.x) * 0.08
    ctx.lineWidth = 1.2
    for (const b of blades) {
      const d = b.x - mouse.x
      const push = Math.abs(d) < 140 ? Math.sign(d) * (1 - Math.abs(d) / 140) * 16 : 0
      const sway = Math.sin(t * 1.3 + b.ph + b.x * 0.012) * 5 + b.lean + push
      ctx.strokeStyle = `rgba(${GREEN}, 0.26)`
      ctx.beginPath()
      ctx.moveTo(b.x, h)
      ctx.quadraticCurveTo(b.x + sway * 0.3, h - b.hgt * 0.6, b.x + sway, h - b.hgt)
      ctx.stroke()
    }
  }
  const frame = (now: number) => {
    const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0
    prev = now
    t += dt
    draw(dt)
    raf = requestAnimationFrame(frame)
  }
  const start = () => {
    if (running || reduce || !visible || document.hidden) return
    running = true
    prev = 0
    raf = requestAnimationFrame(frame)
  }
  const stop = () => {
    running = false
    cancelAnimationFrame(raf)
  }
  layout()
  draw(0)
  const ro = new ResizeObserver(() => {
    layout()
    draw(0)
  })
  ro.observe(host)
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (visible) start()
    else stop()
  })
  io.observe(host)
  const onVis = () => (document.hidden ? stop() : start())
  document.addEventListener('visibilitychange', onVis)
  const onMove = (ev: PointerEvent) => {
    mouse.tx = ev.clientX - host.getBoundingClientRect().left
  }
  const onLeave = () => {
    mouse.tx = -9999
  }
  if (!reduce) {
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerleave', onLeave)
  }
  host.classList.add('nature--on')
  start()
  return () => {
    stop()
    ro.disconnect()
    io.disconnect()
    document.removeEventListener('visibilitychange', onVis)
    host.removeEventListener('pointermove', onMove)
    host.removeEventListener('pointerleave', onLeave)
    host.classList.remove('nature--on')
  }
}

/* ------------------------ fundo "em ação" da abertura ------------------------ */

// Forma de um batimento (P, QRS e T) ao longo de um período: devolve o deslocamento vertical (−1 a 1).
function beat(u: number) {
  const g = (c: number, w: number, a: number) => a * Math.exp(-((u - c) * (u - c)) / (2 * w * w))
  return g(0.18, 0.025, 0.12) + g(0.3, 0.008, -0.14) + g(0.33, 0.01, 1) + g(0.36, 0.01, -0.32) + g(0.58, 0.045, 0.24)
}

function mountAction(canvas: HTMLCanvasElement, reduce: boolean): Cleanup {
  const host = (canvas.closest('section') as HTMLElement | null) ?? canvas.parentElement!
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  let w = 0
  let h = 0
  let dpr = 1
  let raf = 0
  let prev = 0
  let t = 2.2
  let visible = true
  let running = false
  const GREEN = '31, 94, 59'
  const LIGHT = '141, 191, 139'

  let base = 0
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = host.clientWidth
    h = host.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // A linha passa no espaço livre acima do nome (e, no celular, abaixo do cartão do prato).
    const top = host.getBoundingClientRect().top
    const label = host.querySelector('.hero__label')?.getBoundingClientRect()
    const card = host.querySelector('.plate-card')?.getBoundingClientRect()
    const limit = label ? label.top - top - 60 : h * 0.5
    const floor = card && w < 760 ? card.bottom - top + 46 : h * 0.3
    base = Math.max(floor, Math.min(h * 0.5, limit))
  }
  const lineY = () => base
  const period = () => Math.max(220, Math.min(360, w / 4.2))
  const amp = () => (w < 760 ? 34 : Math.min(90, h * 0.11))
  const yAt = (x: number) => lineY() - beat((((x % period()) + period()) % period()) / period()) * amp()

  const draw = () => {
    ctx.clearRect(0, 0, w, h)
    const speed = Math.max(260, w / 4.5)
    const sweep = w + 260
    const head = reduce ? w * 0.7 : (t * speed) % sweep
    const base = lineY()
    // Grade de pontos que acende perto da varredura.
    const step = 30
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        const d = Math.abs(x - head)
        const near = Math.max(0, 1 - d / 220) * Math.max(0, 1 - Math.abs(y - base) / (h * 0.45))
        ctx.fillStyle = `rgba(${GREEN}, ${0.07 + near * 0.22})`
        ctx.fillRect(x - 1, y - 1, 2, 2)
      }
    }
    // Linha de base bem leve, de ponta a ponta.
    ctx.strokeStyle = `rgba(${GREEN}, 0.08)`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, base)
    ctx.lineTo(w, base)
    ctx.stroke()
    // Rastro do batimento: some aos poucos atrás da cabeça.
    const trail = Math.min(w * 0.75, 900)
    const from = Math.max(0, head - trail)
    const to = Math.min(w, head)
    if (to > from) {
      const grad = ctx.createLinearGradient(from, 0, to, 0)
      grad.addColorStop(0, `rgba(${GREEN}, 0)`)
      grad.addColorStop(0.7, `rgba(${GREEN}, 0.45)`)
      grad.addColorStop(1, `rgba(${GREEN}, 0.9)`)
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.8
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let x = from; x <= to; x += 2) {
        const y = yAt(x)
        if (x === from) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    if (head <= w) {
      const y = yAt(head)
      const glow = ctx.createRadialGradient(head, y, 0, head, y, 26)
      glow.addColorStop(0, `rgba(${LIGHT}, 0.55)`)
      glow.addColorStop(1, `rgba(${LIGHT}, 0)`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(head, y, 26, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgb(${GREEN})`
      ctx.beginPath()
      ctx.arc(head, y, 3.2, 0, Math.PI * 2)
      ctx.fill()
      // Onda que se abre a cada pico.
      const u = (((head % period()) + period()) % period()) / period()
      if (u > 0.33 && u < 0.75) {
        const k = (u - 0.33) / 0.42
        ctx.strokeStyle = `rgba(${LIGHT}, ${0.5 * (1 - k)})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(head - (u - 0.33) * period(), base - amp(), 8 + k * 70, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }
  const frame = (now: number) => {
    const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0
    prev = now
    t += dt
    draw()
    raf = requestAnimationFrame(frame)
  }
  const start = () => {
    if (running || reduce || !visible || document.hidden) return
    running = true
    prev = 0
    raf = requestAnimationFrame(frame)
  }
  const stop = () => {
    running = false
    cancelAnimationFrame(raf)
  }
  resize()
  draw()
  const ro = new ResizeObserver(() => {
    resize()
    draw()
  })
  ro.observe(host)
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (visible) start()
    else stop()
  })
  io.observe(host)
  const onVis = () => (document.hidden ? stop() : start())
  document.addEventListener('visibilitychange', onVis)
  host.classList.add('action--on')
  start()
  return () => {
    stop()
    ro.disconnect()
    io.disconnect()
    document.removeEventListener('visibilitychange', onVis)
    host.classList.remove('action--on')
  }
}

/* ---------------------- nome que ocupa toda a largura ---------------------- */

function mountFit(el: HTMLElement): Cleanup {
  const inner = el.querySelector<HTMLElement>('.wm__inner')
  if (!inner) return () => {}
  let last = -1
  const fit = () => {
    const avail = el.clientWidth
    if (!avail || avail === last) return
    el.style.fontSize = '100px'
    const w = inner.getBoundingClientRect().width
    if (w > 0) el.style.fontSize = `${Math.floor(((100 * avail * 0.995) / w) * 100) / 100}px`
    last = avail
  }
  const refit = () => {
    last = -1
    fit()
  }
  fit()
  el.classList.add('is-fit')
  const ro = new ResizeObserver(fit)
  ro.observe(el)
  // As medidas mudam quando as fontes terminam de carregar.
  document.fonts?.ready.then(refit)
  document.fonts?.addEventListener?.('loadingdone', refit)
  return () => {
    ro.disconnect()
    document.fonts?.removeEventListener?.('loadingdone', refit)
  }
}

/* ---------------------------- palavra que troca ---------------------------- */

function mountRotate(el: HTMLElement, reduce: boolean): Cleanup {
  const words = (el.dataset.rotate ?? '').split('|').filter(Boolean)
  if (reduce || words.length < 2) return () => {}
  let i = Math.max(0, words.indexOf(el.textContent?.trim() ?? ''))
  let t2 = 0
  const timer = window.setInterval(() => {
    el.classList.add('is-out')
    t2 = window.setTimeout(() => {
      i = (i + 1) % words.length
      el.textContent = words[i]!
      el.classList.remove('is-out')
      el.classList.add('is-in')
      void el.offsetWidth
      el.classList.remove('is-in')
    }, 380)
  }, 2600)
  return () => {
    clearInterval(timer)
    clearTimeout(t2)
  }
}

/* ------------------------------ storytelling ------------------------------ */

function range(el: Element, attr: string): [number, number] {
  const [a, b] = (el.getAttribute(attr) ?? '0,1').split(',').map(Number)
  return [a ?? 0, b ?? 1]
}

function mountStory(story: HTMLElement, reduce: boolean): Cleanup {
  const body = story.querySelector<HTMLElement>('[data-story-body]')
  const fill = story.querySelector<HTMLElement>('[data-rail-fill]')
  const marks = Array.from(story.querySelectorAll<HTMLElement>('[data-rail-mark]'))
  const chapters = Array.from(story.querySelectorAll<HTMLElement>('[data-chap]')).map((c) => ({
    el: c,
    draws: Array.from(c.querySelectorAll<SVGElement>('[data-draw]')).map((n) => ({ n, r: range(n, 'data-draw') })),
    fills: Array.from(c.querySelectorAll<SVGElement>('[data-fillin]')).map((n) => ({ n, r: range(n, 'data-fillin') })),
    pops: Array.from(c.querySelectorAll<SVGElement>('[data-pop]')).map((n) => ({
      n,
      at: Number(n.getAttribute('data-pop')),
    })),
  }))

  const paint = (c: (typeof chapters)[number], p: number) => {
    for (const d of c.draws) {
      const k = clamp01((p - d.r[0]) / (d.r[1] - d.r[0]))
      d.n.style.strokeDashoffset = String(1 - k)
      // Sem isso, a ponta arredondada de um traço ainda não iniciado aparece como um ponto.
      d.n.style.visibility = k > 0 ? '' : 'hidden'
    }
    for (const f of c.fills) f.n.style.opacity = String(clamp01((p - f.r[0]) / (f.r[1] - f.r[0])))
    for (const o of c.pops) o.n.classList.toggle('is-on', p >= o.at)
    c.el.style.setProperty('--p', p.toFixed(3))
  }

  let raf = 0
  const update = () => {
    raf = 0
    const vh = window.innerHeight
    if (body && fill) {
      const r = body.getBoundingClientRect()
      fill.style.transform = `scaleY(${clamp01((vh * 0.5 - r.top) / r.height)})`
    }
    let active = -1
    chapters.forEach((c, i) => {
      const r = c.el.getBoundingClientRect()
      if (!reduce) paint(c, clamp01((vh - r.top) / (vh * 0.55 + r.height * 0.55)))
      if (r.top < vh * 0.55 && r.bottom > vh * 0.45) active = i
    })
    chapters.forEach((c, i) => c.el.classList.toggle('is-active', i === active))
    marks.forEach((m, i) => m.classList.toggle('is-on', i === active))
    marks.forEach((m, i) => m.classList.toggle('is-done', active >= 0 && i < active))
  }
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update)
  }
  // Para quem prefere menos movimento, as ilustrações já aparecem prontas.
  if (reduce) chapters.forEach((c) => paint(c, 1))
  story.classList.add('story--fx')
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
    story.classList.remove('story--fx')
  }
}

/* ------------------------- entrada suave e números ------------------------- */

function mountReveal(root: ParentNode, reduce: boolean): Cleanup {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-rv]:not(.is-in)'))
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('is-in'))
    return () => {}
  }
  const vh = window.innerHeight
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
  )
  for (const el of els) {
    const r = el.getBoundingClientRect()
    // O que já está na tela (e toda a abertura) entra junto com a página; o resto, ao rolar.
    if ((r.top < vh * 0.92 && r.bottom > 0) || el.closest('.hero')) requestAnimationFrame(() => el.classList.add('is-in'))
    else io.observe(el)
  }
  document.documentElement.classList.add('fx-ready')
  return () => io.disconnect()
}

function mountCounters(root: ParentNode, reduce: boolean): Cleanup {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-count]'))
  if (reduce || !els.length) return () => {}
  const fmt = (n: number) => n.toLocaleString('pt-BR')
  const rafs: number[] = []
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        io.unobserve(e.target)
        const el = e.target as HTMLElement
        const to = Number(el.dataset.count)
        const t0 = performance.now()
        const step = (now: number) => {
          const k = clamp01((now - t0) / 1400)
          el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))))
          if (k < 1) rafs.push(requestAnimationFrame(step))
        }
        rafs.push(requestAnimationFrame(step))
      }
    },
    { threshold: 0.4 },
  )
  els.forEach((el) => {
    el.textContent = '0'
    io.observe(el)
  })
  return () => {
    io.disconnect()
    rafs.forEach(cancelAnimationFrame)
    els.forEach((el) => (el.textContent = fmt(Number(el.dataset.count))))
  }
}

function mountHeader(): Cleanup {
  const header = document.getElementById('site-header')
  if (!header) return () => {}
  const onScroll = () => header.toggleAttribute('data-scrolled', window.scrollY > 12)
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => window.removeEventListener('scroll', onScroll)
}

/* --------------------------------- entrada --------------------------------- */

export function initSiteFx(root: ParentNode = document): Cleanup {
  const reduce = prefersReducedMotion()
  const cleanups: Cleanup[] = [mountHeader()]
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-nature]').forEach((c, i) => cleanups.push(mountNature(c, reduce, i + 1)))
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-action]').forEach((c) => cleanups.push(mountAction(c, reduce)))
  root.querySelectorAll<HTMLElement>('[data-fit]').forEach((el) => cleanups.push(mountFit(el)))
  root.querySelectorAll<HTMLElement>('[data-rotate]').forEach((el) => cleanups.push(mountRotate(el, reduce)))
  root.querySelectorAll<HTMLElement>('[data-story]').forEach((el) => cleanups.push(mountStory(el, reduce)))
  cleanups.push(mountReveal(root, reduce))
  cleanups.push(mountCounters(root, reduce))
  return () => cleanups.forEach((fn) => fn())
}
