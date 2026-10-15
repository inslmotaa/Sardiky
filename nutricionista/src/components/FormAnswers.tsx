import type { schema } from '@/db'
import { formatAnswer } from '@/lib/forms'

export function FormAnswersView({ assignment }: { assignment: typeof schema.formAssignments.$inferSelect }) {
  return (
    <dl className="kv" style={{ gridTemplateColumns: '1fr' }}>
      {assignment.fields.map((f) => (
        <div key={f.id} style={{ paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
          <dt>{f.label}</dt>
          <dd style={{ whiteSpace: 'pre-wrap' }}>{formatAnswer(f, assignment.answers?.[f.id])}</dd>
        </div>
      ))}
    </dl>
  )
}
