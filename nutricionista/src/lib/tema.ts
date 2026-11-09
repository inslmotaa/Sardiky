/** Aparência escolhida pelo cliente no app: automático (segue o aparelho), claro ou escuro. */
export const THEME_COOKIE = 'tema'
export type ThemeChoice = 'auto' | 'claro' | 'escuro'
export const THEME_LABEL: Record<ThemeChoice, string> = { auto: 'Automático (como o aparelho)', claro: 'Claro', escuro: 'Escuro' }

/** Valor do cookie → atributo data-theme do <html> (sem atributo = segue prefers-color-scheme). */
export function themeAttr(cookie: string | undefined): 'light' | 'dark' | undefined {
  return cookie === 'claro' ? 'light' : cookie === 'escuro' ? 'dark' : undefined
}
