/**
 * Ilustrações em linha fina dos capítulos do storytelling. Os traços com data-draw="início,fim"
 * se desenham conforme a rolagem (pathLength=1); data-pop aparece a partir de um ponto do capítulo
 * e data-fillin preenche aos poucos. Sem JavaScript, tudo aparece pronto.
 */

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg className="art" viewBox="0 0 240 240" aria-hidden focusable="false">
      {children}
    </svg>
  )
}

/** Capítulo 1: relógio com os ponteiros girando rápido. */
export function ArtClock() {
  return (
    <Svg>
      <circle cx="120" cy="120" r="92" {...S} pathLength={1} data-draw="0,0.4" />
      <circle cx="120" cy="120" r="84" {...S} strokeOpacity={0.35} pathLength={1} data-draw="0.08,0.45" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6
        const r1 = i % 3 === 0 ? 66 : 72
        return (
          <line
            key={i}
            x1={120 + Math.sin(a) * r1}
            y1={120 - Math.cos(a) * r1}
            x2={120 + Math.sin(a) * 78}
            y2={120 - Math.cos(a) * 78}
            {...S}
            pathLength={1}
            data-draw={`${0.25 + i * 0.015},${0.35 + i * 0.015}`}
          />
        )
      })}
      <g className="art__pop" data-pop="0.42">
        <line className="spin spin--fast" x1="120" y1="120" x2="120" y2="58" {...S} strokeWidth={1.8} />
        <line className="spin spin--slow" x1="120" y1="120" x2="152" y2="120" {...S} strokeWidth={2.4} />
        <circle cx="120" cy="120" r="3.5" fill="currentColor" />
      </g>
      <text className="art__mono" x="120" y="236" textAnchor="middle" data-pop="0.55">
        SEG · 07:00
      </text>
    </Svg>
  )
}

const TRIES = ['DIETA DA MODA', 'CORTAR CARBOIDRATO', 'CONTAR CALORIAS']

/** Capítulo 2: tentativas riscadas uma a uma. */
export function ArtTries() {
  return (
    <Svg>
      <rect x="22" y="38" width="196" height="164" rx="6" {...S} strokeOpacity={0.35} pathLength={1} data-draw="0,0.3" />
      {TRIES.map((t, i) => {
        const y = 88 + i * 40
        const w = t.length * 8.4
        return (
          <g key={t}>
            <text className="art__mono art__mono--lg" x="120" y={y} textAnchor="middle">
              {t}
            </text>
            <line
              x1={120 - w / 2 - 8}
              y1={y - 4.5}
              x2={120 + w / 2 + 8}
              y2={y - 4.5}
              {...S}
              strokeWidth={1.8}
              pathLength={1}
              data-draw={`${0.2 + i * 0.22},${0.36 + i * 0.22}`}
            />
          </g>
        )
      })}
    </Svg>
  )
}

/** Capítulo 3: prato visto de cima, com setores que se preenchem. */
export function ArtPlate() {
  return (
    <Svg>
      <circle cx="120" cy="120" r="90" {...S} pathLength={1} data-draw="0,0.3" />
      <circle cx="120" cy="120" r="74" {...S} strokeOpacity={0.45} pathLength={1} data-draw="0.08,0.36" />
      <path d="M120 120 L120 46 A74 74 0 0 0 120 194 Z" className="art__sector art__sector--a" data-fillin="0.42,0.58" />
      <path d="M120 120 L120 46 A74 74 0 0 1 194 120 Z" className="art__sector art__sector--b" data-fillin="0.52,0.68" />
      <path d="M120 120 L194 120 A74 74 0 0 1 120 194 Z" className="art__sector art__sector--c" data-fillin="0.62,0.78" />
      <line x1="120" y1="46" x2="120" y2="194" {...S} pathLength={1} data-draw="0.3,0.45" />
      <line x1="120" y1="120" x2="194" y2="120" {...S} pathLength={1} data-draw="0.38,0.5" />
      <text className="art__mono" x="80" y="123" textAnchor="middle" data-pop="0.5">
        VEGETAIS
      </text>
      <text className="art__mono" x="153" y="98" textAnchor="middle" data-pop="0.6">
        PROTEÍNA
      </text>
      <text className="art__mono art__mono--sm" x="157" y="150" textAnchor="middle" data-pop="0.7">
        CARBOIDRATO
      </text>
      {/* garfo e faca */}
      <path d="M12 58 V182 M6 58 V84 Q6 92 12 92 Q18 92 18 84 V58" {...S} pathLength={1} data-draw="0.15,0.4" />
      <path d="M228 58 Q218 80 220 116 L228 118 V182" {...S} pathLength={1} data-draw="0.2,0.45" />
    </Svg>
  )
}

const POINTS: [number, number][] = [
  [40, 186],
  [72, 172],
  [104, 176],
  [136, 146],
  [168, 132],
  [204, 92],
]

/** Capítulo 4: gráfico subindo, com pontos que aparecem em sequência. */
export function ArtProgress() {
  return (
    <Svg>
      {[70, 110, 150].map((y) => (
        <line key={y} x1="30" y1={y} x2="220" y2={y} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="2 5" />
      ))}
      <path d="M30 34 V206 H222" {...S} pathLength={1} data-draw="0,0.22" />
      {[72, 104, 136, 168, 204].map((x) => (
        <line key={x} x1={x} y1="206" x2={x} y2="212" {...S} strokeOpacity={0.5} />
      ))}
      <polyline points={POINTS.map((p) => p.join(',')).join(' ')} {...S} strokeWidth={2} pathLength={1} data-draw="0.22,0.78" />
      {POINTS.map(([x, y], i) => (
        <circle key={x} cx={x} cy={y} r="4.5" className="art__dot" data-pop={(0.24 + i * 0.105).toFixed(3)} />
      ))}
      <text className="art__mono" x="204" y="74" textAnchor="middle" data-pop="0.82">
        EVOLUÇÃO
      </text>
      <text className="art__mono" x="126" y="232" textAnchor="middle" data-pop="0.3">
        A CADA 15 DIAS
      </text>
    </Svg>
  )
}
