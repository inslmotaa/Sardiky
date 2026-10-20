/**
 * Prévia em arquivo único: área do cliente e painel do André usando OS MESMOS
 * componentes do sistema (editor, tela Hoje, plano, calculadoras), com os dados
 * guardados só neste navegador (localStorage). Sem login e sem servidor.
 */
import { StrictMode, useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { PlanEditor, type EditorFood } from '@/components/PlanEditor'
import { PatientPlan } from '@/components/nutri/PatientPlan'
import { TodayView, type TodayData, type MealLog } from '@/components/nutri/TodayView'
import { Calculators, type EnergyToSave } from '@/components/nutri/Calculators'
import { LineChart } from '@/components/LineChart'
import { TACO_FOODS } from '@/db/foods-taco'
import { buildDemoPlans } from '@/db/demo-plans'
import { countItems, dayForWeekday, normalizePlan, planContentSchema, type PlanContent } from '@/lib/plan'
import { mifflin, tdee, waterGoalMl, fmt } from '@/lib/nutricao'

/* ------------------------------ dados ------------------------------ */

const FOODS: EditorFood[] = TACO_FOODS.map((f, i) => ({
  id: `f${i}`,
  name: f.name,
  group: f.group,
  per100: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber },
  cookingFactor: f.cookingFactor ?? null,
  measures: f.measures.map(([name, grams]) => ({ name, grams })),
}))

type Features = { diario: boolean; peso: boolean; chat: boolean; calorias: boolean; macros: boolean; calculadoras: boolean; agua: boolean }
const ALL_ON: Features = { diario: true, peso: true, chat: true, calorias: true, macros: true, calculadoras: true, agua: true }

type Published = { version: number; date: string; title: string; content: PlanContent }
type Client = {
  id: string
  name: string
  objective: string
  sex: 'F' | 'M'
  age: number
  heightCm: number
  weights: { date: string; value: number }[]
  features: Features
  energyTarget: number | null
  draft: { title: string; content: PlanContent } | null
  published: Published[]
  logs: Record<string, Record<string, MealLog>>
  water: Record<string, number>
  diary: { id: string; date: string; time: string; meal: string; foods: string; adherence: string; notes: string }[]
  nextAppointment: string
}
type Store = { clients: Client[]; current: string }

const KEY = 'andre-farion-demo-v2'
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const addDays = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const fmtDay = (s: string) => s.slice(0, 10).split('-').reverse().join('/')
const uid = () => Math.random().toString(36).slice(2, 10)

function seed(): Store {
  const { beatrizPlan, beatrizV1, lucasPlan } = buildDemoPlans((name) => {
    const f = FOODS.find((x) => x.name.startsWith(name))!
    return { id: f.id, name: f.name, group: f.group, per100: f.per100 }
  })
  const t = today()
  const bmrB = mifflin('F', 75.1, 165, 35)
  return {
    current: 'beatriz',
    clients: [
      {
        id: 'beatriz',
        name: 'Beatriz Exemplo',
        objective: 'Reeducação alimentar e mais disposição',
        sex: 'F',
        age: 35,
        heightCm: 165,
        weights: [78.4, 77.3, 76.6, 75.9, 75.1].map((v, i) => ({ date: addDays(t, -120 + i * 30), value: v })),
        features: { ...ALL_ON },
        energyTarget: Math.round(tdee(bmrB, 1.375) - 400),
        draft: null,
        published: [
          { version: 1, date: addDays(t, -150), title: 'Plano alimentar — reeducação', content: beatrizV1 },
          { version: 2, date: addDays(t, -30), title: 'Plano alimentar — reeducação', content: beatrizPlan },
        ],
        logs: { [t]: { [`${beatrizPlan.days[0].id}:${beatrizPlan.days[0].meals[0].id}`]: { status: 'feita', optionId: beatrizPlan.days[0].meals[0].options[0].id } } },
        water: { [t]: 750 },
        diary: [{ id: uid(), date: addDays(t, -1), time: '17:30', meal: 'Lanche da tarde', foods: 'Salgado assado e refrigerante zero', adherence: 'nao', notes: 'Reunião longa, fiquei muito tempo sem comer.' }],
        nextAppointment: `${fmtDay(addDays(t, 5))} às 09:00`,
      },
      {
        id: 'lucas',
        name: 'Lucas Fictício',
        objective: 'Alimentação para treinos de corrida',
        sex: 'M',
        age: 30,
        heightCm: 178,
        weights: [{ date: addDays(t, -20), value: 71.2 }],
        features: { ...ALL_ON },
        energyTarget: null,
        draft: { title: 'Plano para treinos de corrida', content: lucasPlan },
        published: [],
        logs: {},
        water: {},
        diary: [],
        nextAppointment: `${fmtDay(addDays(t, 9))} às 16:00`,
      },
    ],
  }
}

/* ------------------------------ armazenamento ------------------------------ */

let store: Store = load()
const listeners = new Set<() => void>()
function load(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Store | null
    if (raw?.clients?.length) return raw
  } catch {
    /* sem armazenamento disponível */
  }
  return seed()
}
function commit(fn: (s: Store) => void) {
  const next = structuredClone(store)
  fn(next)
  store = next
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* navegação privada: funciona só nesta aba */
  }
  listeners.forEach((l) => l())
}
const useStore = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => store,
  )
const clientOf = (s: Store, id: string) => s.clients.find((c) => c.id === id) ?? s.clients[0]

/* ------------------------------ rotas ------------------------------ */

function useHash() {
  const [h, setH] = useState(location.hash)
  useEffect(() => {
    const on = () => {
      setH(location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return h
}

const site = document.getElementById('view-site')!
const appEl = document.getElementById('view-app')!

function Root() {
  const hash = useHash()
  const isApp = hash.startsWith('#cliente') || hash.startsWith('#andre')
  useEffect(() => {
    site.hidden = isApp
    appEl.hidden = !isApp
  }, [isApp])
  if (!isApp) return null
  const [area, sub, extra] = hash.slice(1).split('/')
  return area === 'cliente' ? <ClientArea tab={sub || 'hoje'} /> : <AndreArea page={sub} extra={extra} />
}

function DemoBar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="demo-bar no-print">
      <div className="container row row--between">
        <span>
          <strong>Demonstração.</strong> Os dados ficam salvos só neste navegador. O sistema publicado tem login, senha e banco de dados.
        </span>
        <span className="row" style={{ gap: 8 }}>
          {children}
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              if (!confirm('Apagar as alterações e voltar aos dados de exemplo?')) return
              store = seed()
              commit(() => undefined)
            }}
          >
            Restaurar exemplo
          </button>
        </span>
      </div>
    </div>
  )
}

const Leaf = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
)

/* ------------------------------ área do cliente ------------------------------ */

function ClientArea({ tab }: { tab: string }) {
  const s = useStore()
  const c = clientOf(s, s.current)
  const f = c.features
  const tabs: [string, string][] = [
    ['hoje', 'Hoje'],
    ['plano', 'Plano'],
    ...(f.diario ? ([['diario', 'Diário']] as [string, string][]) : []),
    ['progresso', 'Progresso'],
    ['mais', 'Mais'],
  ]
  const cur = c.published[c.published.length - 1] ?? null
  const content = cur ? normalizePlan(cur.content) : null
  const t = today()
  const now = new Date()

  return (
    <>
      <DemoBar>
        <label className="small row" style={{ gap: 6 }}>
          Ver como
          <select className="demo-select" value={c.id} onChange={(e) => commit((st) => void (st.current = e.target.value))}>
            {s.clients.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </DemoBar>
      <header className="patient-header no-print">
        <div className="container patient-header__inner">
          <a className="brand" href="#cliente">
            <span className="brand__mark">
              <Leaf />
            </span>
            <span className="brand__name">
              André Farion<span className="brand__sub">App do paciente</span>
            </span>
          </a>
          <nav className="patient-nav" aria-label="Área do paciente">
            {tabs.map(([k, l]) => (
              <a key={k} href={`#cliente/${k}`} aria-current={tab === k ? 'page' : undefined}>
                {l}
              </a>
            ))}
          </nav>
          <a className="btn btn--sm" href="#">
            Voltar ao site
          </a>
        </div>
      </header>
      <main className="patient-main">
        <div className="container">
          {tab === 'hoje' &&
            (() => {
              const day = content ? dayForWeekday(content, now.getDay()) : null
              const w = c.weights[c.weights.length - 1]
              const data: TodayData = {
                firstName: c.name.split(' ')[0],
                dateLabel: now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (x) => x.toUpperCase()) + (day && content!.days.length > 1 ? ` · ${day.label}` : ''),
                nowTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
                planTitle: cur?.title ?? null,
                mode: content?.mode ?? 'calculado',
                day,
                logs: c.logs[t] ?? {},
                waterMl: c.water[t] ?? 0,
                waterGoalMl: w ? waterGoalMl(w.value) : 2000,
                features: f,
                nextAppointment: { when: c.nextAppointment, label: 'Retorno · presencial · confirmada', meetingUrl: null },
                guidance: content?.guidance ?? null,
                lastWeight: w ? { value: w.value, date: fmtDay(w.date) } : null,
              }
              return (
                <TodayView
                  key={c.id}
                  data={data}
                  links={{ plan: '#cliente/plano', chat: '#cliente/mais', diary: '#cliente/diario', progress: '#cliente/progresso' }}
                  actions={{
                    setMeal: async (key, optionId, status) =>
                      commit((st) => {
                        const cl = clientOf(st, c.id)
                        cl.logs[t] = cl.logs[t] ?? {}
                        if (status) cl.logs[t][key] = { status: status as MealLog['status'], optionId }
                        else delete cl.logs[t][key]
                      }),
                    water: async (delta) =>
                      commit((st) => {
                        const cl = clientOf(st, c.id)
                        cl.water[t] = Math.max(0, (cl.water[t] ?? 0) + delta)
                      }),
                  }}
                  weightForm={<WeightForm clientId={c.id} />}
                />
              )
            })()}

          {tab === 'plano' &&
            (cur && content ? (
              <div className="stack" style={{ ['--gap' as string]: '18px' }}>
                <div className="page-head">
                  <div>
                    <h1>{cur.title}</h1>
                    <p>
                      Versão {cur.version} · ativado em {fmtDay(cur.date)}
                    </p>
                  </div>
                  <button type="button" className="btn no-print" onClick={() => print()}>
                    Imprimir / salvar PDF
                  </button>
                </div>
                <PatientPlan key={`${c.id}${cur.version}`} content={content} features={{ calorias: f.calorias, macros: f.macros }} weekday={now.getDay()} />
              </div>
            ) : (
              <div className="empty">
                <p style={{ margin: 0 }}>Seu nutricionista ainda está montando seu plano. Assim que ele for ativado, ele aparece aqui.</p>
              </div>
            ))}

          {tab === 'diario' && <Diary client={c} />}

          {tab === 'progresso' && (
            <div className="stack" style={{ ['--gap' as string]: '18px' }}>
              <div className="page-head">
                <div>
                  <h1>Seu progresso</h1>
                </div>
              </div>
              <section className="card">
                <h3>Peso (kg)</h3>
                <LineChart title="Peso" unit="kg" points={c.weights.map((w) => ({ date: w.date, value: w.value, source: 'profissional' as const }))} />
              </section>
              {f.peso && (
                <section className="card">
                  <WeightForm clientId={c.id} />
                </section>
              )}
            </div>
          )}

          {tab === 'mais' && (
            <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 680 }}>
              <h1>Mais</h1>
              <ul className="card list mais-list" style={{ padding: 0 }}>
                {f.calculadoras && (
                  <li style={{ padding: 0 }}>
                    <a href="#cliente/calculadoras">
                      <span>
                        Calculadoras<span className="small muted" style={{ display: 'block', fontWeight: 400 }}>Porções, IMC, água e mais</span>
                      </span>
                    </a>
                  </li>
                )}
                <li style={{ padding: 0 }}>
                  <a href="https://forms.gle/8EkK8XcNE35ydHYKA" target="_blank" rel="noopener noreferrer">
                    <span>
                      Anamnese<span className="small muted" style={{ display: 'block', fontWeight: 400 }}>Formulário da consultoria</span>
                    </span>
                  </a>
                </li>
              </ul>
              <p className="small muted">Mensagens, agenda e perfil funcionam no sistema publicado.</p>
            </div>
          )}

          {tab === 'calculadoras' && (
            <div className="stack" style={{ maxWidth: 900 }}>
              <h1>Calculadoras</h1>
              <Calculators foods={FOODS} mode="patient" allow={{ calorias: f.calorias }} defaults={{ sex: c.sex, age: c.age, weightKg: c.weights[c.weights.length - 1]?.value, heightCm: c.heightCm }} />
            </div>
          )}
          <p className="small muted" style={{ marginTop: 32 }}>
            Este app não substitui atendimento médico. Em caso de urgência, procure um serviço de saúde.
          </p>
        </div>
      </main>
      <nav className="tabbar no-print" aria-label="Atalhos" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map(([k, l]) => (
          <a key={k} href={`#cliente/${k}`} aria-current={tab === k ? 'page' : undefined}>
            <span>{l}</span>
          </a>
        ))}
      </nav>
    </>
  )
}

function WeightForm({ clientId }: { clientId: string }) {
  const [v, setV] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault()
        const n = Number(v.replace(',', '.'))
        if (!(n >= 20 && n <= 350)) return setMsg('Informe o peso entre 20 e 350 kg.')
        commit((st) => clientOf(st, clientId).weights.push({ date: today(), value: n }))
        setV('')
        setMsg('Peso registrado. Obrigado por acompanhar!')
      }}
    >
      <div className="field">
        <label htmlFor="w-today">Registrar peso de hoje (kg)</label>
        <input id="w-today" type="text" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="Ex.: 70,5" style={{ maxWidth: 160 }} />
      </div>
      <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
        Salvar peso
      </button>
      {msg && <span className="small">{msg}</span>}
    </form>
  )
}

function Diary({ client }: { client: Client }) {
  const [foods, setFoods] = useState('')
  const [meal, setMeal] = useState('Almoço')
  const [adh, setAdh] = useState('total')
  const ADH: Record<string, [string, string]> = { total: ['Segui o plano', 'badge--ok'], parcial: ['Segui em parte', 'badge--warn'], nao: ['Comi outra coisa', 'badge--plain'] }
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <h1>Diário alimentar</h1>
      <section className="card">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!foods.trim()) return
            const d = new Date()
            commit((st) =>
              clientOf(st, client.id).diary.push({ id: uid(), date: today(), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, meal, foods: foods.trim(), adherence: adh, notes: '' }),
            )
            setFoods('')
          }}
        >
          <div className="form-grid">
            <div className="field">
              <label htmlFor="d-meal">Refeição</label>
              <select id="d-meal" value={meal} onChange={(e) => setMeal(e.target.value)}>
                {['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="d-adh">Como foi?</label>
              <select id="d-adh" value={adh} onChange={(e) => setAdh(e.target.value)}>
                <option value="total">Segui o plano</option>
                <option value="parcial">Segui em parte</option>
                <option value="nao">Comi outra coisa</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="d-foods">O que você comeu?</label>
            <textarea id="d-foods" rows={2} value={foods} onChange={(e) => setFoods(e.target.value)} />
          </div>
          <div>
            <button className="btn btn--primary" type="submit">
              Salvar registro
            </button>
          </div>
        </form>
      </section>
      <ul className="card list">
        {[...client.diary].reverse().map((d) => (
          <li key={d.id}>
            <div className="row row--between">
              <strong>
                {fmtDay(d.date)} · {d.time} · {d.meal}
              </strong>
              <span className={`badge ${ADH[d.adherence]?.[1] ?? 'badge--plain'}`}>{ADH[d.adherence]?.[0]}</span>
            </div>
            <div>{d.foods}</div>
            {d.notes && <div className="small muted">“{d.notes}”</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------ painel do André ------------------------------ */

function AndreArea({ page }: { page?: string; extra?: string }) {
  const s = useStore()
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  return (
    <>
      <DemoBar />
      <header className="demo-appbar no-print">
        <div className="container row row--between">
          <a className="brand" href="#andre">
            <span className="brand__mark">
              <Leaf />
            </span>
            <span className="brand__name">
              André Farion<span className="brand__sub">Painel do nutricionista</span>
            </span>
          </a>
          <nav className="row" style={{ gap: 6 }}>
            <a className="btn btn--sm" href="#andre">
              Clientes
            </a>
            <a className="btn btn--sm" href="#andre/calculadoras">
              Calculadoras
            </a>
            <a className="btn btn--sm" href="#">
              Voltar ao site
            </a>
          </nav>
        </div>
      </header>
      <main className="patient-main">
        <div className="container">
          {!page && (
            <div className="stack" style={{ ['--gap' as string]: '18px' }}>
              <div className="page-head">
                <div>
                  <h1>Clientes</h1>
                  <p>Escolha um cliente para montar o plano alimentar com cálculo automático.</p>
                </div>
              </div>
              <div className="grid-2" style={{ alignItems: 'start' }}>
                <section className="stack">
                  {s.clients.map((c) => {
                    const cur = c.published[c.published.length - 1]
                    return (
                      <div key={c.id} className="card row row--between">
                        <div>
                          <strong>{c.name}</strong>
                          <div className="small muted">{c.objective}</div>
                          <div className="small" style={{ marginTop: 4 }}>
                            {cur ? <span className="badge badge--ok">Plano ativo · v{cur.version}</span> : <span className="badge badge--plain">Sem plano ativo</span>}{' '}
                            {c.draft && <span className="badge badge--warn">Rascunho</span>}
                          </div>
                        </div>
                        <a className="btn btn--primary btn--sm" href={`#andre/${c.id}`}>
                          Montar plano
                        </a>
                      </div>
                    )
                  })}
                </section>
                <section className="card">
                  <h2 style={{ fontSize: '1.1rem' }}>Novo cliente</h2>
                  <form
                    className="stack"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (name.trim().length < 3) return
                      const id = `c${uid()}`
                      commit((st) =>
                        st.clients.push({
                          id,
                          name: name.trim(),
                          objective: objective.trim(),
                          sex: 'F',
                          age: 30,
                          heightCm: 165,
                          weights: [],
                          features: { ...ALL_ON },
                          energyTarget: null,
                          draft: null,
                          published: [],
                          logs: {},
                          water: {},
                          diary: [],
                          nextAppointment: `${fmtDay(addDays(today(), 7))} às 10:00`,
                        }),
                      )
                      location.hash = `#andre/${id}`
                    }}
                  >
                    <div className="field">
                      <label htmlFor="n-name">Nome completo</label>
                      <input id="n-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="field">
                      <label htmlFor="n-obj">Objetivo</label>
                      <input id="n-obj" type="text" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Ex.: emagrecimento, hipertrofia…" />
                    </div>
                    <div>
                      <button className="btn btn--primary" type="submit">
                        Cadastrar cliente
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            </div>
          )}

          {page === 'calculadoras' && (
            <div className="stack" style={{ maxWidth: 980 }}>
              <h1>Calculadoras</h1>
              <Calculators
                foods={FOODS}
                mode="pro"
                patients={s.clients.map((c) => ({ id: c.id, name: c.name, sex: c.sex, age: c.age, weightKg: c.weights[c.weights.length - 1]?.value ?? null, heightCm: c.heightCm }))}
                onSaveEnergy={async (id: string, e: EnergyToSave) => {
                  commit((st) => void (clientOf(st, id).energyTarget = e.targetKcal))
                  return { ok: true, message: `Meta de ${e.targetKcal} kcal salva na ficha. Ela aparece como sugestão no editor de planos.` }
                }}
              />
            </div>
          )}

          {page && page !== 'calculadoras' && <ClientPlanEditor clientId={page} />}
        </div>
      </main>
    </>
  )
}

function ClientPlanEditor({ clientId }: { clientId: string }) {
  const s = useStore()
  const c = clientOf(s, clientId)
  const [rev, setRev] = useState(0)
  const cur = c.published[c.published.length - 1]
  const startContent = c.draft?.content ?? (cur ? normalizePlan(cur.content) : normalizePlan({ v: 2, days: [{ id: uid(), label: 'Todos os dias', meals: [] }] }))
  const title = c.draft?.title ?? cur?.title ?? 'Plano alimentar'

  const action = async (_: unknown, fd: FormData) => {
    let json: unknown
    try {
      json = JSON.parse(String(fd.get('content') ?? ''))
    } catch {
      return { error: 'Conteúdo do plano inválido.' }
    }
    const parsed = planContentSchema.safeParse(json)
    if (!parsed.success) return { error: `Revise o plano: ${parsed.error.issues[0].message}` }
    const t = String(fd.get('title') ?? '').trim() || 'Plano alimentar'
    if (fd.get('intent') !== 'publish') {
      commit((st) => void (clientOf(st, clientId).draft = { title: t, content: parsed.data }))
      return { ok: true, message: 'Rascunho salvo. O cliente ainda não vê esta versão.' }
    }
    if (fd.get('reviewed') !== 'on') return { error: 'Confirme que revisou o plano antes de publicar.' }
    if (countItems(parsed.data) === 0) return { error: 'O plano precisa ter ao menos uma refeição com alimentos.' }
    for (const d of parsed.data.days)
      for (const m of d.meals)
        for (const o of m.options) if (o.items.length === 0) return { error: `“${m.name}” (${o.label}, ${d.label}) está sem alimentos.` }
    commit((st) => {
      const cl = clientOf(st, clientId)
      cl.published.push({ version: (cl.published[cl.published.length - 1]?.version ?? 0) + 1, date: today(), title: t, content: parsed.data })
      cl.draft = null
    })
    setTimeout(() => setRev((r) => r + 1), 1200)
    return { ok: true, message: 'Plano ativado no app do paciente.' }
  }

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <div className="page-head">
        <div>
          <nav className="breadcrumb">
            <a href="#andre">Clientes</a>
          </nav>
          <h1>{c.name}</h1>
          <p>
            {c.objective}
            {cur ? ` · plano ativo: versão ${cur.version} (${fmtDay(cur.date)})` : ' · ainda sem plano ativo'}
            {c.energyTarget ? ` · meta calculada: ${fmt(c.energyTarget, 0)} kcal` : ''}
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            commit((st) => void (st.current = clientId))
            location.hash = '#cliente/plano'
          }}
        >
          Ver como o cliente
        </button>
      </div>
      <p className="alert alert--warn">
        Você está editando um <strong>rascunho</strong>. O cliente só vê o plano depois que você revisa e clica em “Ativar no app do paciente”.
      </p>
      <PlanEditor
        key={`${clientId}-${rev}`}
        action={action}
        initial={startContent}
        title={title}
        validFrom={null}
        validUntil={null}
        isTemplate={false}
        foods={FOODS}
        patient={{ name: c.name, weightKg: c.weights[c.weights.length - 1]?.value ?? null, energyTarget: c.energyTarget }}
      />
    </div>
  )
}

createRoot(appEl).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
