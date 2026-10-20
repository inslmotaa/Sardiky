import type { schema } from '@/db'
import { formatAnswer } from '@/lib/forms'

export function FormAnswersView({ assignment }: { assignment: typeof schema.formAssignments.$inferSelect }) {
  return (
    <dl className="kv" style={{ gridTemplateColumns: '1fr' }}>
      {assignment.fields.map((f) =>
        f.type === 'section' ? (
          <h3 key={f.id} style={{ margin: '12px 0 0' }}>
            {f.label}
          </h3>
        ) : (
          <div key={f.id} style={{ paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
            <dt>{f.label}</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>
              {f.type === 'file' && typeof assignment.answers?.[f.id] === 'string' && assignment.answers?.[f.id] ? (
                <a href={`/arquivos/${assignment.answers[f.id]}`} target="_blank" rel="noopener noreferrer">
                  Abrir arquivo enviado
                </a>
              ) : (
                formatAnswer(f, assignment.answers?.[f.id])
              )}
            </dd>
          </div>
        ),
      )}
    </dl>
  )
}
