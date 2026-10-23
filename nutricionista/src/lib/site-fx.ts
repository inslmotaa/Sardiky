/**
 * Efeitos do site público em JavaScript puro (sem React), usados no Next e na prévia em arquivo único:
 * fundo "em ação" da abertura (monitor de batimentos em canvas), fundo líquido em WebGL, nome que ocupa a largura disponível, palavra que troca, storytelling ligado
 * à rolagem, entrada suave, números que contam e cabeçalho que ganha fundo ao rolar.
 * initSiteFx devolve a função que desfaz tudo (troca de página no Next).
 */

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}`

// Superfície líquida: fbm com domain warping, normais por diferença finita e luz especular suave.
const FRAG = `precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uPush;
uniform float uSeed;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
const mat2 R=mat2(1.6,1.2,-1.2,1.6);
float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p=R*p;a*=0.5;}return v;}

float height(vec2 p,vec2 m){
  vec2 d=p-m;
  float k=uPush*exp(-dot(d,d)*3.0);
  p-=d*k*0.45;
  float t=uTime;
  vec2 q=vec2(fbm(p+0.06*t+uSeed),fbm(p+vec2(5.2,1.3)-0.05*t));
  vec2 r=vec2(fbm(p+2.4*q+vec2(1.7,9.2)+0.035*t),fbm(p+2.4*q+vec2(8.3,2.8)-0.03*t));
  return fbm(p+1.9*r)+k*0.08;
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 asp=vec2(uRes.x/uRes.y,1.0);
  vec2 p=uv*asp*1.05;
  vec2 m=uMouse*asp*1.05;
  float e=0.012;
  float h=height(p,m);
  float hx=height(p+vec2(e,0.0),m);
  float hy=height(p+vec2(0.0,e),m);
  vec3 n=normalize(vec3((h-hx)/e*0.26,(h-hy)/e*0.26,1.0));
  vec3 L=normalize(vec3(-0.45,0.6,0.66));
  vec3 H=normalize(L+vec3(0.0,0.0,1.0));
  float diff=clamp(dot(n,L),0.0,1.0);
  float nh=clamp(dot(n,H),0.0,1.0);
  float spec=pow(nh,56.0)*0.55+pow(nh,9.0)*0.07;
  vec3 base=vec3(0.969,0.973,0.961);
  vec3 shade=vec3(0.885,0.93,0.882);
  vec3 valley=vec3(0.553,0.749,0.545);
  vec3 deep=vec3(0.122,0.369,0.231);
  vec3 col=mix(shade,base,smoothstep(0.45,0.98,diff));
  col=mix(col,valley,smoothstep(0.52,0.2,h)*0.13);
  col=mix(col,deep,smoothstep(0.40,0.15,h)*0.05);
  col+=vec3(spec);
  float bottom=smoothstep(0.42,0.0,uv.y);
  float edge=smoothstep(0.38,0.9,length((uv-0.5)*vec2(1.1,1.0)));
  col=mix(col,col*vec3(0.93,0.955,0.935),clamp(bottom*0.6+edge*0.7,0.0,1.0));
  gl_FragColor=vec4(min(col,vec3(1.0)),1.0);
}`

const RENDER_SCALE = 0.55

type Cleanup = () => void

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ----------------------------- fundo líquido ----------------------------- */

function mountLiquid(canvas: HTMLCanvasElement, reduce: boolean, seed: number): Cleanup {
  const host = (canvas.closest('[data-liquid-host]') as HTMLElement | null) ?? canvas.parentElement!
  let gl: WebGLRenderingContext | null = null
  try {
    gl = (canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false,
    }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
  } catch {
    gl = null
  }
  const fallback = () => {
    host.classList.add('liquid--fallback')
    return () => host.classList.remove('liquid--fallback')
  }
  if (!gl) return fallback()

  const compile = (type: number, src: string) => {
    const sh = gl!.createShader(type)!
    gl!.shaderSource(sh, src)
    gl!.compileShader(sh)
    return gl!.getShaderParameter(sh, gl!.COMPILE_STATUS) ? sh : null
  }
  const vs = compile(gl.VERTEX_SHADER, VERT)
  const fs = compile(gl.FRAGMENT_SHADER, FRAG)
  const prog = gl.createProgram()!
  if (!vs || !fs) return fallback()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return fallback()
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const uRes = gl.getUniformLocation(prog, 'uRes')
  const uTime = gl.getUniformLocation(prog, 'uTime')
  const uMouse = gl.getUniformLocation(prog, 'uMouse')
  const uPush = gl.getUniformLocation(prog, 'uPush')
  gl.uniform1f(gl.getUniformLocation(prog, 'uSeed'), seed)
  host.classList.add('liquid--on')

  // Mouse com easing: o alvo muda na hora, a posição usada no shader persegue o alvo.
  const mouse = {
    x: 0.65,
    y: 0.6,
    tx: 0.65,
    ty: 0.6,
    push: 0,
    tpush: 0,
    last: 0,
  }
  let time = 8 + seed * 3
  let raf = 0
  let prev = 0
  let visible = true
  let running = false

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(host.clientWidth * dpr * RENDER_SCALE))
    const h = Math.max(1, Math.round(host.clientHeight * dpr * RENDER_SCALE))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl!.viewport(0, 0, w, h)
  }
  const draw = () => {
    gl!.uniform2f(uRes, canvas.width, canvas.height)
    gl!.uniform1f(uTime, time)
    gl!.uniform2f(uMouse, mouse.x, mouse.y)
    gl!.uniform1f(uPush, mouse.push)
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
  }
  const frame = (now: number) => {
    const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0
    prev = now
    time += dt
    if (now - mouse.last > 900) mouse.tpush = Math.min(mouse.tpush, 0.35)
    mouse.x += (mouse.tx - mouse.x) * 0.06
    mouse.y += (mouse.ty - mouse.y) * 0.06
    mouse.push += (mouse.tpush - mouse.push) * 0.04
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
    if (!running) draw()
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
    const r = host.getBoundingClientRect()
    mouse.tx = (ev.clientX - r.left) / r.width
    mouse.ty = 1 - (ev.clientY - r.top) / r.height
    mouse.tpush = 1
    mouse.last = performance.now()
  }
  const onLeave = () => {
    mouse.tpush = 0
  }
  if (!reduce) {
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerleave', onLeave)
  }
  start()

  return () => {
    stop()
    ro.disconnect()
    io.disconnect()
    document.removeEventListener('visibilitychange', onVis)
    host.removeEventListener('pointermove', onMove)
    host.removeEventListener('pointerleave', onLeave)
    host.classList.remove('liquid--on')
    gl!.getExtension('WEBGL_lose_context')?.loseContext()
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
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-liquid]').forEach((c, i) => cleanups.push(mountLiquid(c, reduce, i * 1.7)))
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-action]').forEach((c) => cleanups.push(mountAction(c, reduce)))
  root.querySelectorAll<HTMLElement>('[data-fit]').forEach((el) => cleanups.push(mountFit(el)))
  root.querySelectorAll<HTMLElement>('[data-rotate]').forEach((el) => cleanups.push(mountRotate(el, reduce)))
  root.querySelectorAll<HTMLElement>('[data-story]').forEach((el) => cleanups.push(mountStory(el, reduce)))
  cleanups.push(mountReveal(root, reduce))
  cleanups.push(mountCounters(root, reduce))
  return () => cleanups.forEach((fn) => fn())
}
