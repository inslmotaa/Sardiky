import 'server-only'
import { cache } from 'react'
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'

export const getSettings = cache(async () => {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.id, 1))
  if (!row) throw new Error('Configurações ausentes. Rode "npm run setup".')
  return row
})

export const getWorkingHours = cache(async () =>
  db.select().from(schema.workingHours).orderBy(asc(schema.workingHours.weekday), asc(schema.workingHours.start)),
)
