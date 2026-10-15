import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { ADHERENCE_LABEL } from '@/lib/format'
import { commentDiary } from '@/actions/admin/patients'
import { DiaryList } from '@/components/DiaryList'
import { Empty } from '@/components/ui'

export async function DiaryTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const entries = await db
    .select()
    .from(schema.diaryEntries)
    .where(eq(schema.diaryEntries.patientId, patient.id))
    .orderBy(desc(schema.diaryEntries.date), desc(schema.diaryEntries.time))
    .limit(200)
  const withAdh = entries.filter((e) => e.adherence)
  const pct = (k: string) => (withAdh.length ? Math.round((withAdh.filter((e) => e.adherence === k).length / withAdh.length) * 100) : 0)
  return (
    <div className="stack">
      {withAdh.length > 0 && (
        <div className="card row">
          <strong>Adesão informada ({withAdh.length} registros):</strong>
          {(['total', 'parcial', 'nao_seguiu'] as const).map((k) => (
            <span key={k} className="badge badge--plain">
              {ADHERENCE_LABEL[k]}: {pct(k)}%
            </span>
          ))}
        </div>
      )}
      {entries.length === 0 ? <Empty>O paciente ainda não registrou refeições.</Empty> : <DiaryList entries={entries} commentAction={commentDiary.bind(null, patient.id)} />}
    </div>
  )
}
