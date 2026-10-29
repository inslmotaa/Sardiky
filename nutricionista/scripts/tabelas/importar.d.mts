export type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>
export function normalizar(s: string): string
export function importarTaco(query: Query): Promise<{ inserted: number; updated: number }>
export function importarMedidas(query: Query): Promise<number>
export function precisaImportar(query: Query): Promise<boolean>
