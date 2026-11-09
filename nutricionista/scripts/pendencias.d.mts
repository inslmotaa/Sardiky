export type Pendencia = { campo: 'bio' | 'email' | 'instagram' | 'foto' | 'sobre'; texto: string; onde: string }
export function pendenciasDoSite(s: {
  bio?: string | null
  method?: string | null
  specialties?: string[] | null
  differentials?: string[] | null
  contactEmail?: string | null
  privacyContact?: string | null
  instagram?: string | null
  photoFileId?: string | null
}): Pendencia[]
