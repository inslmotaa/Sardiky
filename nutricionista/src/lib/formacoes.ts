/** Formações e certificações do coach: "Curso | Instituição | Ano" por linha (Configurações → Perfil). */
export type Credential = { course: string; institution: string; year: number }

export function parseCredentials(text: string | null | undefined, thisYear = new Date().getFullYear()): { items: Credential[]; error?: string } {
  const items: Credential[] = []
  const lines = (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length > 20) return { items, error: 'No máximo 20 formações.' }
  for (const [i, line] of lines.entries()) {
    const parts = line.split('|').map((p) => p.trim())
    const [course, institution, yearText] = parts
    const year = Number(yearText)
    if (parts.length !== 3 || !course || !institution || !yearText)
      return { items, error: `Linha ${i + 1}: use “Curso | Instituição | Ano”.` }
    if (!/^\d{4}$/.test(yearText) || year < 1950 || year > thisYear + 1) return { items, error: `Linha ${i + 1}: ano inválido (${yearText}).` }
    if (course.length > 160 || institution.length > 160) return { items, error: `Linha ${i + 1}: texto muito longo.` }
    items.push({ course, institution, year })
  }
  // Mais recentes primeiro.
  return { items: items.sort((a, b) => b.year - a.year) }
}

export const credentialsText = (items: Credential[]) => items.map((c) => `${c.course} | ${c.institution} | ${c.year}`).join('\n')
