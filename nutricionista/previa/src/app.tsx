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
import { countItems, dayForWeekday, normalizePlan, optionTotals, planContentSchema, sortedMeals, type DiaryItem, type PlanContent } from '@/lib/plan'
import { mifflin, tdee, waterGoalMl, fmt } from '@/lib/nutricao'
import { DiaryDay, type DiaryEntryView, type DiaryMeal } from '@/components/nutri/DiaryDay'
import { ChatThread, type ChatMessage } from '@/components/nutri/ChatThread'
import { QuickMessage } from '@/components/nutri/QuickMessage'
import { AdherenceBars } from '@/components/AdherenceBars'
import { adherence, ADHERENCE_LABEL, classify, streak, weeklyAdherence, type AdherenceClass } from '@/lib/acompanhamento'
import { shoppingList, shoppingQuantity } from '@/lib/compras'
import { recipeNutrients, scale } from '@/lib/nutricao'
import { ShoppingList } from '@/components/nutri/ShoppingList'
import { NutriInline } from '@/components/nutri/MacroBars'

/* ------------------------------ dados ------------------------------ */

const FOODS: EditorFood[] = TACO_FOODS.map((f, i) => ({
  id: `f${i}`,
  name: f.name,
  group: f.group,
  per100: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber },
  cookingFactor: f.cookingFactor ?? null,
  measures: f.measures.map(([name, grams]) => ({ name, grams })),
}))

/** Receitas de exemplo (as mesmas do banco de demonstração), com cálculo pela base de alimentos. */
const ing = (name: string, grams: number) => {
  const f = FOODS.find((x) => x.name.startsWith(name))!
  return { name: f.name, grams, per100: f.per100 }
}
const DEMO_RECIPES = [
  {
    title: 'Panqueca de banana e aveia',
    portions: 1,
    finalWeight: 160,
    prep: 10,
    tags: ['café da manhã', 'sem lactose', 'vegetariana'],
    ingredients: [ing('Banana prata', 100), ing('Aveia em flocos', 30), ing('Ovo de galinha, inteiro, cozido', 50)],
    steps: '1. Amasse a banana com um garfo.\n2. Misture o ovo e a aveia até formar uma massa.\n3. Doure em frigideira antiaderente, 2 a 3 minutos de cada lado.',
  },
  {
    title: 'Salada de grão-de-bico',
    portions: 2,
    finalWeight: 350,
    prep: 15,
    tags: ['vegana', 'sem glúten', 'sem lactose'],
    ingredients: [ing('Grão-de-bico', 160), ing('Tomate', 120), ing('Cenoura', 60), ing('Azeite de oliva', 10)],
    steps: '1. Pique o tomate e rale a cenoura.\n2. Misture com o grão-de-bico cozido.\n3. Tempere com o azeite, limão, sal e cheiro-verde.',
  },
  {
    title: 'Omelete de legumes',
    portions: 1,
    finalWeight: 170,
    prep: 12,
    tags: ['low carb', 'sem glúten', 'sem lactose'],
    ingredients: [ing('Ovo de galinha, inteiro, cozido', 100), ing('Tomate', 40), ing('Abobrinha italiana', 40), ing('Azeite de oliva', 4)],
    steps: '1. Bata os ovos com uma pitada de sal.\n2. Refogue os legumes no azeite por 3 minutos.\n3. Junte os ovos, tampe e cozinhe em fogo baixo até firmar.',
  },
]

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
  diary: Entry[]
  messages: Msg[]
  goals: { id: string; title: string; done: boolean }[]
  nextAppointment: string
}
type Entry = DiaryEntryView & { date: string; mealKey: string | null }
type Msg = { id: string; fromPatient: boolean; body: string; at: string; read: boolean; diaryId?: string | null }
type Store = { clients: Client[]; current: string }

const KEY = 'andre-farion-demo-v3'
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

const nowLabel = () => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')

function seed(): Store {
  const { beatrizPlan, beatrizV1, lucasPlan, vegetarianoPlan } = buildDemoPlans((name) => {
    const f = FOODS.find((x) => x.name.startsWith(name))!
    return { id: f.id, name: f.name, group: f.group, per100: f.per100 }
  })
  const t = today()
  const bmrB = mifflin('F', 75.1, 165, 35)
  // Mesmos padrões do banco de demonstração: Beatriz “em dia”, Helena “com dificuldade”.
  const bDay = beatrizPlan.days[0]
  const hDay = vegetarianoPlan.days[0]
  const bLogs: Client['logs'] = {}
  const hLogs: Client['logs'] = {}
  const bWater: Client['water'] = {}
  for (let d = -13; d <= 0; d++) {
    const date = addDays(t, d)
    bDay.meals.forEach((m, i) => {
      if (d === 0 && i > 0) return
      const status = (d + i) % 9 === 0 ? 'parcial' : (d * 3 + i) % 13 === 0 ? null : d === -1 && i === 2 ? 'outra' : 'feita'
      if (status) (bLogs[date] ??= {})[`${bDay.id}:${m.id}`] = { status, optionId: m.options[0].id }
    })
    bWater[date] = d === 0 ? 750 : 1750 + ((d * 250) % 750)
    if (d >= -12 && d <= -1)
      hDay.meals.forEach((m, i) => {
        const status = i < 2 ? (d % 3 === 0 && i === 1 ? null : 'feita') : i === 2 && d % 2 === 0 ? 'parcial' : null
        if (status) (hLogs[date] ??= {})[`${hDay.id}:${m.id}`] = { status, optionId: m.options[0].id }
      })
  }
  const item = (name: string, grams: number): DiaryItem => {
    const f = FOODS.find((x) => x.name.startsWith(name))!
    return { foodId: f.id, name: f.name, grams, per100: f.per100 }
  }
  const entry = (e: Partial<Entry> & Pick<Entry, 'date' | 'time' | 'meal' | 'foods'>): Entry => ({
    id: uid(), mealKey: null, choice: null, items: [], hunger: null, satiety: null, mood: null, notes: null, photoUrl: null, comment: null, ...e,
  })
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
        logs: bLogs,
        water: bWater,
        diary: [
          entry({
            date: addDays(t, -1),
            time: '17:30',
            meal: 'Lanche da tarde',
            mealKey: `${bDay.id}:${bDay.meals[2].id}`,
            choice: 'nao_seguiu',
            foods: 'Biscoito e suco na reunião',
            items: [item('Biscoito cream cracker', 30), item('Suco de laranja natural', 200)],
            hunger: 5,
            satiety: 2,
            mood: 2,
            notes: 'Reunião longa, fiquei muito tempo sem comer.',
            comment: 'Tudo bem! Que tal deixar uma fruta na bolsa para dias de reunião?',
          }),
          entry({ date: t, time: '07:10', meal: 'Café da manhã', mealKey: `${bDay.id}:${bDay.meals[0].id}`, choice: 'total', foods: 'Segui o plano', hunger: 3, satiety: 4, mood: 4 }),
        ],
        messages: [
          { id: uid(), fromPatient: false, body: 'Nesta fase, foque em não pular o lanche da tarde: ele ajuda a chegar ao jantar com menos fome.', at: `${fmtDay(addDays(t, -29))} às 09:00`, read: true },
          { id: uid(), fromPatient: true, body: 'Posso trocar o iogurte por kefir no lanche?', at: `${fmtDay(addDays(t, -2))} às 18:20`, read: true },
          { id: uid(), fromPatient: false, body: 'Pode sim! Use a mesma quantidade (1 pote, 170 g).', at: `${fmtDay(addDays(t, -2))} às 19:05`, read: true },
        ],
        goals: [
          { id: uid(), title: 'Reduzir a circunferência da cintura', done: false },
          { id: uid(), title: 'Beber 2 litros de água por dia', done: true },
        ],
        nextAppointment: `${fmtDay(addDays(t, 5))} às 09:00`,
      },
      {
        id: 'helena',
        name: 'Helena Teste',
        objective: 'Alimentação na menopausa',
        sex: 'F',
        age: 48,
        heightCm: 160,
        weights: [{ date: addDays(t, -10), value: 68.3 }],
        features: { ...ALL_ON },
        energyTarget: null,
        draft: null,
        published: [{ version: 1, date: addDays(t, -20), title: 'Plano alimentar — vegetariano', content: vegetarianoPlan }],
        logs: hLogs,
        water: {},
        diary: [],
        messages: [
          { id: uid(), fromPatient: false, body: 'Oi, Helena! Como estão os jantares desta semana?', at: `${fmtDay(addDays(t, -3))} às 10:00`, read: true },
          { id: uid(), fromPatient: true, body: 'Estou chegando tarde e acabo pulando o jantar.', at: `${fmtDay(addDays(t, -3))} às 20:40`, read: true },
        ],
        goals: [],
        nextAppointment: `${fmtDay(addDays(t, 12))} às 14:00`,
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
        messages: [],
        goals: [],
        nextAppointment: `${fmtDay(addDays(t, 9))} às 16:00`,
      },
    ],
  }
}

/** Adesão de um cliente (mesmo cálculo do sistema): últimos 7 dias completos. */
function adherenceOf(c: Client) {
  const cur = c.published[c.published.length - 1]
  const plan = cur ? normalizePlan(cur.content) : null
  const logs = Object.entries(c.logs).flatMap(([date, m]) => Object.values(m).map((l) => ({ date, status: l.status })))
  const t = today()
  const start = c.published[0]?.date ?? null
  const a7 = adherence(plan, logs, addDays(t, -7), addDays(t, -1), start)
  const dates = [...logs.map((l) => l.date), ...c.diary.map((d) => d.date), ...Object.entries(c.water).filter(([, ml]) => ml > 0).map(([d]) => d)]
  const last = dates.length ? dates.reduce((m, d) => (d > m ? d : m)) : null
  return { plan, pct: a7?.pct ?? null, klass: classify(a7?.pct ?? null), streak: streak(dates, t), last, weekly: weeklyAdherence(plan, logs, addDays(t, -1), 6, start) }
}

function chatView(c: Client, viewer: 'patient' | 'team'): ChatMessage[] {
  return c.messages.map((m) => {
    const d = m.diaryId ? c.diary.find((x) => x.id === m.diaryId) : undefined
    return {
      id: m.id,
      mine: viewer === 'patient' ? m.fromPatient : !m.fromPatient,
      author: m.fromPatient ? (viewer === 'patient' ? 'Você' : c.name) : 'André Farion',
      body: m.body,
      at: m.at,
      attachment: null,
      diary: d ? { meal: d.meal, date: fmtDay(d.date), photoUrl: null, foods: d.foods } : null,
      guidance: false,
      automatic: false,
      read: m.read,
    }
  })
}

/** Envio de mensagem na prévia (texto; anexos e áudio funcionam no sistema publicado). */
const sendMessage = (clientId: string, fromPatient: boolean) => async (_: unknown, fd: FormData) => {
  const body = String(fd.get('body') ?? '').trim()
  if (!body) return { error: 'Escreva a mensagem. (Na prévia, anexos e áudio não são guardados.)' }
  commit((st) => {
    const c = clientOf(st, clientId)
    c.messages.push({ id: uid(), fromPatient, body: body.replace(/\{nome\}/g, c.name.split(' ')[0]), at: nowLabel(), read: false })
  })
  return { ok: true, message: 'Mensagem enviada.' }
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
  return area === 'cliente' ? <ClientArea tab={sub || 'hoje'} extra={extra} /> : <AndreArea page={sub} extra={extra} />
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

function ClientArea({ tab, extra }: { tab: string; extra?: string }) {
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
                  links={{ plan: '#cliente/plano', chat: '#cliente/mensagens', diary: '#cliente/diario', progress: '#cliente/progresso' }}
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
                <p style={{ margin: 0 }}>Seu coach ainda está montando seu plano. Assim que ele for ativado, ele aparece aqui.</p>
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
              {(() => {
                const a = adherenceOf(c)
                return a.plan ? (
                  <section className="card">
                    <h2 style={{ fontSize: '1.15rem' }}>Constância</h2>
                    <div className="stat-row" style={{ marginBottom: 12 }}>
                      <div className="stat">
                        <strong>{a.pct != null ? `${a.pct}%` : '—'}</strong>
                        <span>das refeições do plano feitas nos últimos 7 dias (até ontem)</span>
                      </div>
                      <div className="stat">
                        <strong>
                          {a.streak} {a.streak === 1 ? 'dia' : 'dias'}
                        </strong>
                        <span>seguidos registrando</span>
                      </div>
                    </div>
                    <AdherenceBars weeks={a.weekly} good={80} />
                  </section>
                ) : null
              })()}
              {c.goals.length > 0 && (
                <section className="card">
                  <h2 style={{ fontSize: '1.15rem' }}>Metas</h2>
                  <ul className="list">
                    {c.goals.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          className="goal-check"
                          role="checkbox"
                          aria-checked={g.done}
                          onClick={() => commit((st) => void (clientOf(st, c.id).goals.find((x) => x.id === g.id)!.done = !g.done))}
                        >
                          <span className="goal-check__box" aria-hidden>
                            {g.done ? '✓' : ''}
                          </span>
                          <span className="goal-check__text">{g.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
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

          {tab === 'mensagens' && f.chat && <ClientChat client={c} />}

          {tab === 'mais' && (
            <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 680 }}>
              <h1>Mais</h1>
              <ul className="card list mais-list" style={{ padding: 0 }}>
                {f.chat && (
                  <li style={{ padding: 0 }}>
                    <a href="#cliente/mensagens">
                      <span>
                        Mensagens<span className="small muted" style={{ display: 'block', fontWeight: 400 }}>Converse com o André</span>
                      </span>
                    </a>
                  </li>
                )}
                {[
                  ['#cliente/compras', 'Lista de compras', 'Gerada do seu plano da semana'],
                  ['#cliente/receitas', 'Receitas', 'Receitas e sugestões do André'],
                ].map(([href, label, hint]) => (
                  <li key={href} style={{ padding: 0 }}>
                    <a href={href}>
                      <span>
                        {label}
                        <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
                          {hint}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
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
              <p className="small muted">Agenda (confirmar presença, remarcar e avaliar), materiais, notificações, fotos de evolução e perfil funcionam no sistema publicado.</p>
            </div>
          )}

          {tab === 'compras' &&
            (content ? (
              <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 760 }}>
                <div className="page-head">
                  <div>
                    <h1>Lista de compras da semana</h1>
                    <p>Gerada do seu plano (primeira opção de cada refeição, 7 dias). Alimentos cozidos aparecem em peso cru.</p>
                  </div>
                </div>
                <ShoppingList
                  storageKey={`demo-compras-${c.id}`}
                  rows={shoppingList(content, new Map(FOODS.map((x) => [x.id, { cookingFactor: x.cookingFactor, measures: x.measures }]))).map((i) => ({
                    key: i.key,
                    name: i.name,
                    groupLabel: i.groupLabel,
                    quantity: shoppingQuantity(i),
                  }))}
                />
              </div>
            ) : (
              <p className="empty">A lista aparece quando o plano for ativado.</p>
            ))}

          {tab === 'receitas' && !extra && (
            <div className="stack" style={{ ['--gap' as string]: '18px' }}>
              <h1>Receitas</h1>
              <div className="recipe-grid">
                {DEMO_RECIPES.map((r, i) => {
                  const n = recipeNutrients(r.ingredients, r.finalWeight, r.portions)
                  return (
                    <a key={r.title} href={`#cliente/receitas/${i}`} className="card recipe-card">
                      <div className="recipe-card__ph" aria-hidden>
                        🍽️
                      </div>
                      <strong>{r.title}</strong>
                      <span className="small muted">
                        {r.portions} {r.portions === 1 ? 'porção' : 'porções'}
                        {f.calorias && n.perPortion ? ` · ${fmt(n.perPortion.kcal, 0)} kcal/porção` : ''} · {r.prep} min
                      </span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'receitas' &&
            extra &&
            DEMO_RECIPES[Number(extra)] &&
            (() => {
              const r = DEMO_RECIPES[Number(extra)]
              const n = recipeNutrients(r.ingredients, r.finalWeight, r.portions)
              return (
                <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 760 }}>
                  <nav className="breadcrumb">
                    <a href="#cliente/receitas">Receitas</a>
                  </nav>
                  <h1>{r.title}</h1>
                  <div className="row" style={{ gap: 6 }}>
                    {r.tags.map((t) => (
                      <span key={t} className="badge badge--plain">
                        {t}
                      </span>
                    ))}
                  </div>
                  <section className="card">
                    <h2 style={{ fontSize: '1.1rem' }}>Ingredientes</h2>
                    <ul className="list">
                      {r.ingredients.map((x) => (
                        <li key={x.name} className="row row--between">
                          <span>{x.name}</span>
                          <span className="muted">
                            {x.grams} g{f.calorias ? ` · ${fmt(scale(x.per100, x.grams).kcal, 0)} kcal` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {n.perPortion && (f.calorias || f.macros) && (
                      <p className="small" style={{ marginBottom: 0 }}>
                        Por porção: <NutriInline n={n.perPortion} showKcal={f.calorias} showMacros={f.macros} />
                      </p>
                    )}
                  </section>
                  <section className="card">
                    <h2 style={{ fontSize: '1.1rem' }}>Modo de preparo</h2>
                    <p className="recipe-steps">{r.steps}</p>
                  </section>
                </div>
              )
            })()}

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

const CHOICE_STATUS: Record<string, MealLog['status']> = { total: 'feita', parcial: 'parcial', nao_seguiu: 'outra' }

function Diary({ client }: { client: Client }) {
  const t = today()
  const cur = client.published[client.published.length - 1]
  const content = cur ? normalizePlan(cur.content) : null
  const day = content ? dayForWeekday(content, new Date().getDay()) : null
  const f = client.features
  const meals: DiaryMeal[] = day
    ? sortedMeals(day).map((m) => {
        const key = `${day.id}:${m.id}`
        const log = client.logs[t]?.[key]
        const opt = m.options.find((o) => o.id === log?.optionId) ?? m.options[0]
        const e = client.diary.find((x) => x.date === t && x.mealKey === key)
        const fromToday: DiaryEntryView | null =
          log && log.status !== 'pulada'
            ? { id: `log-${key}`, time: '', meal: m.name, foods: 'Marcada na tela Hoje', choice: log.status === 'feita' ? 'total' : log.status === 'parcial' ? 'parcial' : 'nao_seguiu', items: [], hunger: null, satiety: null, mood: null, notes: null, photoUrl: null, comment: null }
            : null
        return { key, name: m.name, time: m.time, optionId: opt.id, summary: opt.items.map((i) => i.name.split(',')[0]).join(' · '), planned: content!.mode === 'calculado' ? optionTotals(opt) : null, entry: e ?? fromToday }
      })
    : []
  const keys = new Set(meals.map((m) => m.key))
  const extras = client.diary.filter((x) => x.date === t && (!x.mealKey || !keys.has(x.mealKey)))
  const now = new Date()
  const history = Array.from({ length: 7 }, (_, i) => addDays(t, -i - 1)).map((d) => ({
    d,
    n: Object.keys(client.logs[d] ?? {}).length + client.diary.filter((x) => x.date === d && !x.mealKey).length,
  }))

  const action = async (_: unknown, fd: FormData) => {
    const mealKey = String(fd.get('mealKey') ?? '') || null
    const choice = (String(fd.get('choice') ?? '') || null) as Entry['choice']
    const raw = JSON.parse(String(fd.get('items') || '[]')) as { foodId: string; name: string; grams: number }[]
    const items: DiaryItem[] = raw.map((i) => {
      const food = FOODS.find((x) => x.id === i.foodId)
      return { foodId: i.foodId, name: food?.name ?? i.name, grams: Math.round(i.grams), per100: food?.per100 ?? null }
    })
    const foodsText = String(fd.get('foods') ?? '').trim()
    if (mealKey && !choice) return { error: 'Conte como foi: segui o plano, segui em parte ou comi outra coisa.' }
    if ((choice === 'nao_seguiu' || !mealKey) && !items.length && !foodsText) return { error: 'Adicione os alimentos ou uma descrição. (Na prévia, a foto não é guardada.)' }
    const num = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null)
    const e: Entry = {
      id: uid(),
      date: t,
      time: String(fd.get('time') ?? '12:00'),
      meal: String(fd.get('meal') ?? 'Registro'),
      mealKey,
      choice,
      items,
      foods: foodsText || (items.length ? items.map((i) => `${i.name} (${i.grams} g)`).join(', ') : choice === 'total' ? 'Segui o plano' : 'Segui o plano em parte'),
      hunger: num('hunger'),
      satiety: num('satiety'),
      mood: num('mood'),
      notes: String(fd.get('notes') ?? '').trim() || null,
      photoUrl: null,
      comment: null,
    }
    commit((st) => {
      const c = clientOf(st, client.id)
      if (mealKey) c.diary = c.diary.filter((x) => !(x.date === t && x.mealKey === mealKey))
      c.diary.push(e)
      if (mealKey && choice) (c.logs[t] ??= {})[mealKey] = { status: CHOICE_STATUS[choice], optionId: String(fd.get('optionId') ?? '') || null }
    })
    const kind = choice === 'total' ? 'Que bom! ' : choice === 'parcial' ? 'Tudo certo, cada passo conta. ' : choice === 'nao_seguiu' ? 'Obrigado por contar. Amanhã é um novo dia. ' : ''
    return { ok: true, message: `${kind}Registro salvo no seu diário.` }
  }

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <div className="page-head">
        <div>
          <h1>Diário alimentar</h1>
          <p>Conte como foi cada refeição. Não existe registro “certo” — o importante é ser sincero.</p>
        </div>
      </div>
      {!day && <p className="empty">Seu coach ainda está montando seu plano. Enquanto isso, registre em “Fora do plano”.</p>}
      <DiaryDay
        key={client.id}
        date={t}
        nowTime={`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}
        meals={meals}
        extras={extras}
        foods={FOODS}
        action={action}
        onDelete={async (id) => commit((st) => void (clientOf(st, client.id).diary = clientOf(st, client.id).diary.filter((x) => x.id !== id)))}
        show={{ kcal: f.calorias, macros: f.macros }}
        photoNote="Na prévia a foto não é guardada; no sistema publicado ela fica visível só para você e para o André."
      />
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Últimos dias</h2>
        <ul className="day-history">
          {history.map((h) => (
            <li key={h.d}>
              <a href="#cliente/diario">
                <span>{fmtDay(h.d)}</span>
                <span className="muted small">{h.n === 0 ? 'sem registros' : `${h.n} ${h.n === 1 ? 'registro' : 'registros'}`}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ClientChat({ client }: { client: Client }) {
  useEffect(() => {
    if (client.messages.some((m) => !m.fromPatient && !m.read))
      commit((st) => clientOf(st, client.id).messages.forEach((m) => !m.fromPatient && (m.read = true)))
  }, [client])
  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      <div className="page-head">
        <div>
          <h1>Mensagens</h1>
          <p>Tire dúvidas sobre o seu plano. Atendimento pelo chat: seg a sex, das 08:00 às 18:00.</p>
        </div>
      </div>
      <section className="card">
        <ChatThread messages={chatView(client, 'patient')} action={sendMessage(client.id, true)} emptyText="Nenhuma mensagem ainda. Envie sua primeira dúvida abaixo." />
      </section>
      <p className="small muted">Na prévia, as mensagens ficam neste navegador. Abra o painel do André (Acompanhamento → nome do cliente) para responder.</p>
    </div>
  )
}

/* ------------------------------ painel do André ------------------------------ */

function AndreArea({ page, extra }: { page?: string; extra?: string }) {
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
              André Farion<span className="brand__sub">Painel do coach</span>
            </span>
          </a>
          <nav className="row" style={{ gap: 6 }}>
            <a className="btn btn--sm" href="#andre">
              Clientes
            </a>
            <a className="btn btn--sm" href="#andre/acompanhamento">
              Acompanhamento
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
                          messages: [],
                          goals: [],
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

          {page === 'acompanhamento' && <Tracking />}
          {page === 'conversa' && extra && <TeamChat clientId={extra} />}
          {page && !['calculadoras', 'acompanhamento', 'conversa'].includes(page) && <ClientPlanEditor clientId={page} />}
        </div>
      </main>
    </>
  )
}

const TONE: Record<AdherenceClass, string> = { em_dia: 'badge--ok', dificuldade: 'badge--warn', sem_progresso: 'badge--danger' }

function Tracking() {
  const s = useStore()
  const rows = s.clients.map((c) => ({ c, a: adherenceOf(c) }))
  const order: AdherenceClass[] = ['dificuldade', 'sem_progresso', 'em_dia']
  rows.sort((x, y) => order.indexOf(x.a.klass) - order.indexOf(y.a.klass))
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <div className="page-head">
        <div>
          <h1>Acompanhamento</h1>
          <p>Clientes pela adesão nos últimos 7 dias completos: em dia (≥ 80% das refeições feitas), com dificuldade (40–79%) e sem progresso (&lt; 40% ou sem registro).</p>
        </div>
      </div>
      <div className="stat-row">
        {order.map((k) => (
          <div key={k} className="stat">
            <strong>{rows.filter((r) => r.a.klass === k).length}</strong>
            <span>
              <span className={`badge ${TONE[k]}`}>{ADHERENCE_LABEL[k]}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Situação</th>
              <th className="num">Adesão (7 dias)</th>
              <th>Último registro</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, a }) => (
              <tr key={c.id}>
                <td>
                  <a href={`#andre/conversa/${c.id}`}>
                    <strong>{c.name}</strong>
                  </a>
                  <div className="small muted">{c.objective}</div>
                  {!a.plan && <div className="small muted">Sem plano ativo</div>}
                </td>
                <td>
                  <span className={`badge ${TONE[a.klass]}`}>{ADHERENCE_LABEL[a.klass]}</span>
                </td>
                <td className="num">
                  {a.pct != null ? (
                    <span className="adh-cell">
                      <span className="adh-cell__track" aria-hidden>
                        <span style={{ width: `${a.pct}%` }} />
                      </span>
                      {a.pct}%
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{a.last ? fmtDay(a.last) : <span className="muted">nunca</span>}</td>
                <td>
                  <QuickMessage name={c.name} action={sendMessage(c.id, false)} replies={['Ótima escolha!', 'Vamos ajustar isso no retorno.', 'Obrigado por registrar, {nome}! Continue assim.']} whatsapp={null} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TeamChat({ clientId }: { clientId: string }) {
  const s = useStore()
  const c = clientOf(s, clientId)
  const a = adherenceOf(c)
  useEffect(() => {
    if (c.messages.some((m) => m.fromPatient && !m.read)) commit((st) => clientOf(st, c.id).messages.forEach((m) => m.fromPatient && (m.read = true)))
  }, [c])
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <div className="page-head">
        <div>
          <nav className="breadcrumb">
            <a href="#andre/acompanhamento">Acompanhamento</a>
          </nav>
          <h1>{c.name}</h1>
          <p>
            <span className={`badge ${TONE[a.klass]}`}>{ADHERENCE_LABEL[a.klass]}</span> · adesão {a.pct != null ? `${a.pct}%` : '—'} · sequência de {a.streak} {a.streak === 1 ? 'dia' : 'dias'}
          </p>
        </div>
        <a className="btn" href={`#andre/${c.id}`}>
          Plano alimentar
        </a>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Conversa</h2>
          <ChatThread messages={chatView(c, 'team')} action={sendMessage(c.id, false)} quickReplies={['Ótima escolha!', 'Vamos ajustar isso no retorno.']} placeholder="Responder" emptyText="Nenhuma mensagem." />
        </section>
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Diário recente</h2>
          {c.diary.length === 0 ? (
            <p className="muted">Sem registros no diário.</p>
          ) : (
            <ul className="list">
              {[...c.diary].reverse().slice(0, 8).map((d) => (
                <li key={d.id}>
                  <strong>
                    {fmtDay(d.date)} · {d.meal}
                  </strong>
                  <div>{d.foods}</div>
                  <form
                    className="row"
                    style={{ marginTop: 6 }}
                    onSubmit={(e) => {
                      e.preventDefault()
                      const input = e.currentTarget.elements.namedItem('reply') as HTMLInputElement
                      if (!input.value.trim()) return
                      commit((st) => clientOf(st, c.id).messages.push({ id: uid(), fromPatient: false, body: input.value.trim(), at: nowLabel(), read: false, diaryId: d.id }))
                      input.value = ''
                    }}
                  >
                    <input name="reply" placeholder="Responder no chat" aria-label={`Responder sobre ${d.meal}`} style={{ flex: 1, minWidth: 160 }} />
                    <button className="btn btn--sm" type="submit">
                      Responder no chat
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
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
        patient={{ name: c.name, weightKg: c.weights[c.weights.length - 1]?.value ?? null, energyTarget: c.energyTarget, restrictions: c.id === 'beatriz' ? ['lactose'] : c.id === 'helena' ? ['vegetariano'] : [] }}
      />
    </div>
  )
}

createRoot(appEl).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
