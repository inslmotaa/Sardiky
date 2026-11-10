import type { ReactNode } from 'react'

/**
 * Antes usavam framer-motion. Agora são contêineres simples, sem JavaScript: o conteúdo vem
 * visível do servidor (melhor LCP e menos ~70 KB de script). As entradas suaves do site são
 * feitas em CSS (src/lib/site-fx.ts e [data-rv] no site.css), respeitando "reduzir movimento".
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function FadeUp({ children, className, id }: { children: ReactNode; className?: string; delay?: number; id?: string }) {
  return (
    <div id={id} className={className} data-reveal="">
      {children}
    </div>
  )
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className} data-reveal="">
      {children}
    </div>
  )
}
