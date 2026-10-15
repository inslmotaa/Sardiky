import os from 'node:os'
import path from 'node:path'

/**
 * Pasta de dados locais (banco embutido de desenvolvimento e uploads).
 * Fica fora do projeto para o servidor de desenvolvimento não recarregar
 * a página a cada gravação. Em produção, use UPLOAD_DIR e DATABASE_URL.
 */
export function localDataDir(sub: string) {
  return path.join(process.env.NUTRI_DATA_DIR ?? path.join(os.homedir(), '.consultorio-nutri'), sub)
}
