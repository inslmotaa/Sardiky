/** Ilustrações leves (SVG) para os estados vazios do hub do cliente. */
export function IlloPlate() {
  return (
    <svg viewBox="0 0 120 90" width="120" height="90" aria-hidden className="illo">
      <ellipse cx="60" cy="52" rx="44" ry="30" fill="var(--verde-menta)" />
      <ellipse cx="60" cy="50" rx="30" ry="20" fill="#fff" stroke="var(--verde-claro)" strokeWidth="3" />
      <path d="M48 46c6-10 18-12 24-4-4 8-14 10-24 4z" fill="var(--verde-claro)" />
      <circle cx="70" cy="54" r="5" fill="#f2b880" />
      <path d="M14 22v24M10 22v10M18 22v10M14 46v28" stroke="var(--verde-escuro)" strokeWidth="3" strokeLinecap="round" />
      <path d="M106 22c-6 4-6 18 0 22v30" stroke="var(--verde-escuro)" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}
export function IlloCalendar() {
  return (
    <svg viewBox="0 0 120 90" width="110" height="82" aria-hidden className="illo">
      <rect x="22" y="16" width="76" height="62" rx="10" fill="#fff" stroke="var(--verde-claro)" strokeWidth="3" />
      <rect x="22" y="16" width="76" height="16" rx="8" fill="var(--verde-principal)" />
      <path d="M40 10v12M80 10v12" stroke="var(--verde-escuro)" strokeWidth="4" strokeLinecap="round" />
      {[0, 1, 2, 3].map((c) => [0, 1].map((r) => <rect key={`${c}${r}`} x={32 + c * 15} y={42 + r * 15} width="9" height="9" rx="2" fill={c === 2 && r === 1 ? 'var(--verde-claro)' : 'var(--verde-menta)'} />))}
    </svg>
  )
}
export function IlloScale() {
  return (
    <svg viewBox="0 0 120 90" width="110" height="82" aria-hidden className="illo">
      <rect x="24" y="20" width="72" height="60" rx="14" fill="var(--verde-menta)" stroke="var(--verde-claro)" strokeWidth="3" />
      <path d="M44 40a16 16 0 0 1 32 0" fill="none" stroke="var(--verde-principal)" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 40l7-8" stroke="var(--verde-escuro)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
export function IlloLeaf() {
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden className="illo">
      <path d="M8 56C8 28 26 8 58 6c-2 30-20 50-50 50z" fill="var(--verde-claro)" />
      <path d="M10 54C24 40 36 26 54 10" stroke="var(--verde-escuro)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".6" />
    </svg>
  )
}
