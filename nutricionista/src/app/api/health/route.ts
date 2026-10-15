import { sql } from 'drizzle-orm'
import { db } from '@/db'

/** Verificação para monitoramento (uptime). Não expõe detalhes internos. */
export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
