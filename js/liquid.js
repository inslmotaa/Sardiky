/*
 * Fundo "liquid" da hero: fbm + domain warping, normais calculadas pela
 * altura e luz especular. Reflexos levemente avermelhados nos brilhos e
 * vermelho bem escuro nos vales. Deforma onde o mouse passa (com easing).
 *
 * Performance: renderiza a ~55% da resolução, pausa fora da tela e com a
 * aba oculta, desenha um quadro estático com prefers-reduced-motion e
 * mantém o gradiente CSS como fallback quando não há WebGL.
 */
(function () {
  const canvas = document.getElementById("liquid");
  if (!canvas) return;

  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl) return; // fica o gradiente do CSS

  const RES = 0.55;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  const vert = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const frag = `
    precision mediump float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform vec2 u_mouse;   // 0..1, origem embaixo à esquerda
    uniform float u_force;  // 0..1, intensidade do mouse (com easing)

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    const mat2 R = mat2(1.6, 1.2, -1.2, 1.6);
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p = R * p; a *= 0.5; }
      return v;
    }

    vec2 toSpace(vec2 uv) {
      float aspect = u_res.x / u_res.y;
      return vec2(uv.x * aspect, uv.y) * 2.2;
    }

    float heightAt(vec2 p) {
      float t = u_time * 0.045;
      // mouse: empurra o líquido em volta do cursor
      vec2 m = toSpace(u_mouse);
      vec2 d = p - m;
      float fall = exp(-dot(d, d) * 2.2) * u_force;
      p -= d * fall * 0.55;

      vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
      vec2 r = vec2(fbm(p + 3.2 * q + vec2(1.7, 9.2) + 0.7 * t),
                    fbm(p + 3.2 * q + vec2(8.3, 2.8) - 0.6 * t));
      float h = fbm(p + 3.0 * r);
      h += fall * 0.18 * sin(length(d) * 9.0 - u_time * 1.6);
      return h;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      vec2 p = toSpace(uv);

      float e = 2.0 / u_res.y;
      float h  = heightAt(p);
      float hx = heightAt(p + vec2(e, 0.0));
      float hy = heightAt(p + vec2(0.0, e));
      vec3 n = normalize(vec3((h - hx) / e * 0.06, (h - hy) / e * 0.06, 1.0));

      vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
      vec3 V = vec3(0.0, 0.0, 1.0);
      vec3 H = normalize(L + V);
      float diff = max(dot(n, L), 0.0);
      float spec = pow(max(dot(n, H), 0.0), 70.0);
      float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);

      // base quase preta, vales em vermelho bem escuro
      vec3 col = vec3(0.018, 0.016, 0.016);
      float valley = 1.0 - smoothstep(0.28, 0.55, h);
      col = mix(col, vec3(0.11, 0.004, 0.0), valley * 0.75);
      col += diff * 0.035;
      // brilhos com reflexo levemente avermelhado
      col += spec * vec3(0.95, 0.62, 0.58) * 0.55;
      col += rim * vec3(0.35, 0.03, 0.02) * 0.35;

      // vinheta e terço inferior mais escuro
      float vig = smoothstep(1.15, 0.35, length((uv - vec2(0.55, 0.55)) * vec2(1.1, 1.3)));
      col *= mix(0.35, 1.0, vig);
      col *= mix(0.45, 1.0, smoothstep(0.0, 0.42, uv.y));

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = shader(gl.VERTEX_SHADER, vert);
  const fs = shader(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uMouse = gl.getUniformLocation(prog, "u_mouse");
  const uForce = gl.getUniformLocation(prog, "u_force");

  const hero = canvas.closest(".hero") || canvas.parentElement;
  const mouse = { x: 0.7, y: 0.6, tx: 0.7, ty: 0.6, f: 0, tf: 0 };
  let visible = true;
  let raf = 0;
  let last = 0;
  let time = 8; // começa num ponto "bonito" do ruído

  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * RES));
    const h = Math.max(1, Math.round(canvas.clientHeight * RES));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  }

  function draw() {
    gl.uniform1f(uTime, time);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uForce, mouse.f);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    time += dt;
    // easing do mouse
    const k = 1 - Math.pow(0.0015, dt);
    mouse.x += (mouse.tx - mouse.x) * k;
    mouse.y += (mouse.ty - mouse.y) * k;
    mouse.f += (mouse.tf - mouse.f) * (1 - Math.pow(0.02, dt));
    mouse.tf *= Math.pow(0.35, dt); // a deformação some quando o mouse para
    draw();
    schedule();
  }

  function schedule() {
    if (!raf && visible && !document.hidden && !reduced.matches) raf = requestAnimationFrame(frame);
  }

  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }

  function renderStatic() { resize(); draw(); }

  hero.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left) / r.width;
    mouse.ty = 1 - (e.clientY - r.top) / r.height;
    mouse.tf = Math.min(1, mouse.tf + 0.12);
    schedule();
  }, { passive: true });

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    visible ? schedule() : stop();
  }).observe(hero);

  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : schedule()));

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => { resize(); if (reduced.matches) draw(); }, 120);
  });

  reduced.addEventListener && reduced.addEventListener("change", () => (reduced.matches ? (stop(), renderStatic()) : schedule()));

  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stop(); canvas.classList.remove("is-ready"); });

  resize();
  draw();
  canvas.classList.add("is-ready");
  schedule();
})();
