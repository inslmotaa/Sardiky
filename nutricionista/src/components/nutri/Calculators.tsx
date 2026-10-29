'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ACTIVITY_FACTORS,
  BMR_FORMULAS,
  bmi,
  bmiClass,
  bmr,
  calorieTarget,
  cookedToRaw,
  equivalentGrams,
  fatChangeKg,
  fmt,
  formatMeasure,
  GROUP_MAIN_MACRO,
  healthyWeightRange,
  inRange,
  leanMass,
  LIMITS,
  macrosFromGkg,
  macrosFromPct,
  nearestMeasure,
  parseDecimal,
  proteinAlert,
  rawToCooked,
  recipeNutrients,
  scale,
  tdee,
  waistHipRatio,
  waistRisk,
  waterGoalMl,
  type BmrFormula,
  type MacroKey,
  type Sex,
} from '@/lib/nutricao'
import { FoodPicker } from './FoodPicker'
import { MacroBars, NutriInline } from './MacroBars'

export type CalcFood = {
  id: string
  name: string
  group: string
  per100: { kcal: number; protein: number; carbs: number; fat: number; fiber: number }
  cookingFactor: number | null
  measures: { name: string; grams: number }[]
}

export type EnergyToSave = { formula: BmrFormula; factor: number; bmr: number; tdee: number; targetKcal: number; adjust: number; adjustUnit: 'kcal' | 'pct' }

type Props = {
  foods: CalcFood[]
  mode: 'patient' | 'pro'
  /** Liberações para o paciente (o nutricionista pode ocultar calorias e peso). */
  allow?: { calorias: boolean }
  defaults?: { sex?: Sex | null; age?: number | null; weightKg?: number | null; heightCm?: number | null }
  waterMlPerKg?: number
  patients?: { id: string; name: string; sex: Sex | null; age: number | null; weightKg: number | null; heightCm: number | null }[]
  onSaveEnergy?: (patientId: string, e: EnergyToSave) => Promise<{ ok?: boolean; error?: string; message?: string }>
}

const DISCLAIMER_PATIENT = 'Estimativa. Seu plano é definido pelo seu coach.'
const DISCLAIMER_PRO = 'Estimativa baseada em fórmulas de referência; confirme com a avaliação clínica.'

function NumInput({ id, label, value, onChange, unit, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; unit?: string; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {unit ? ` (${unit})` : ''}
      </label>
      <input id={id} type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  )
}

export function Calculators({ foods, mode, allow = { calorias: true }, defaults = {}, waterMlPerKg = 35, patients = [], onSaveEnergy }: Props) {
  const pro = mode === 'pro'
  const showEnergy = pro || allow.calorias
  const tabs = [
    ['porcoes', 'Porções'],
    ['imc', 'IMC e peso'],
    ...(pro ? [['cintura', 'Cintura e quadril']] : []),
    ...(showEnergy ? [['energia', 'Gasto energético'], ['macros', 'Macros']] : []),
    ['agua', 'Água'],
    ...(pro ? [['projecao', 'Projeção de meta']] : []),
  ] as [string, string][]
  const [tab, setTab] = useState('porcoes')
  const disclaimer = pro ? DISCLAIMER_PRO : DISCLAIMER_PATIENT

  // Dados pessoais compartilhados entre as calculadoras.
  const [sex, setSex] = useState<Sex>(defaults.sex ?? 'F')
  const [age, setAge] = useState(defaults.age != null ? String(defaults.age) : '')
  const [weight, setWeight] = useState(defaults.weightKg != null ? String(defaults.weightKg).replace('.', ',') : '')
  const [height, setHeight] = useState(defaults.heightCm != null ? String(defaults.heightCm) : '')
  const [patientId, setPatientId] = useState('')
  const w = parseDecimal(weight)
  const h = parseDecimal(height)
  const a = parseDecimal(age)
  const errors = {
    w: weight && !inRange(w, LIMITS.weight) ? 'Peso entre 20 e 350 kg' : null,
    h: height && !inRange(h, LIMITS.height) ? 'Altura entre 100 e 230 cm' : null,
    a: age && !inRange(a, LIMITS.age) ? 'Idade entre 2 e 110 anos' : null,
  }

  const personal = (
    <fieldset>
      <legend>Dados</legend>
      {pro && patients.length > 0 && (
        <div className="field" style={{ marginBottom: 10 }}>
          <label htmlFor="c-patient">Preencher com dados do cliente</label>
          <select
            id="c-patient"
            defaultValue=""
            onChange={(e) => {
              const p = patients.find((x) => x.id === e.target.value)
              if (!p) return
              if (p.sex) setSex(p.sex)
              setAge(p.age != null ? String(p.age) : '')
              setWeight(p.weightKg != null ? String(p.weightKg).replace('.', ',') : '')
              setHeight(p.heightCm != null ? String(p.heightCm) : '')
              setPatientId(p.id)
            }}
          >
            <option value="">Escolher…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="c-sex">Sexo</label>
          <select id="c-sex" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
        </div>
        <NumInput id="c-age" label="Idade" unit="anos" value={age} onChange={setAge} hint={errors.a ?? undefined} />
        <NumInput id="c-weight" label="Peso" unit="kg" value={weight} onChange={setWeight} hint={errors.w ?? undefined} />
        <NumInput id="c-height" label="Altura" unit="cm" value={height} onChange={setHeight} hint={errors.h ?? undefined} />
      </div>
    </fieldset>
  )

  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      <nav className="tabs" aria-label="Calculadoras">
        {tabs.map(([k, label]) => (
          <a
            key={k}
            href={`#${k}`}
            aria-current={tab === k ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault()
              setTab(k)
            }}
          >
            {label}
          </a>
        ))}
      </nav>

      {tab === 'porcoes' && <Portions foods={foods} disclaimer={disclaimer} />}

      {tab === 'imc' && (
        <section className="card stack">
          {personal}
          {w && h && !errors.w && !errors.h ? (
            <div className="calc-result" aria-live="polite">
              {(() => {
                const v = bmi(w, h)
                const c = bmiClass(v, a)
                const r = healthyWeightRange(h)
                return (
                  <>
                    <div>
                      IMC: <strong className="big">{fmt(v)}</strong> kg/m² · <strong>{c.label}</strong> <span className="small muted">({c.ref})</span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      Faixa de peso para IMC entre 18,5 e 24,9: <strong>{fmt(r.min)} kg</strong> a <strong>{fmt(r.max)} kg</strong>
                    </div>
                    <p className="disclaimer">
                      O IMC é um indicador de triagem e não avalia composição corporal. Referência OMS (adultos): abaixo de 18,5 baixo peso; 18,5–24,9 eutrofia; 25–29,9 sobrepeso; 30 ou mais
                      obesidade. Idosos (60+, Lipschitz): abaixo de 22 baixo peso; 22–27 eutrofia; acima de 27 sobrepeso. {disclaimer}
                    </p>
                  </>
                )
              })()}
            </div>
          ) : (
            <p className="muted small">Informe peso e altura.</p>
          )}
        </section>
      )}

      {tab === 'cintura' && <WaistHip sex={sex} setSex={setSex} disclaimer={disclaimer} />}

      {tab === 'energia' && (
        <Energy
          personal={personal}
          sex={sex}
          w={w}
          h={h}
          a={a}
          invalid={Boolean(errors.w || errors.h || errors.a)}
          disclaimer={disclaimer}
          pro={pro}
          patientId={patientId}
          patients={patients}
          setPatientId={setPatientId}
          onSave={onSaveEnergy}
        />
      )}

      {tab === 'macros' && <Macros weight={w} disclaimer={disclaimer} />}

      {tab === 'agua' && (
        <WaterCalc weight={weight} setWeight={setWeight} weightError={errors.w} mlPerKg={waterMlPerKg} disclaimer={disclaimer} />
      )}

      {tab === 'projecao' && <Projection disclaimer={disclaimer} />}
    </div>
  )
}

/* ------------------------------ porções ------------------------------ */

function Portions({ foods, disclaimer }: { foods: CalcFood[]; disclaimer: string }) {
  const [food, setFood] = useState<CalcFood | null>(null)
  const [qty, setQty] = useState('100')
  const [unit, setUnit] = useState<'g' | 'kg'>('g')
  const [measure, setMeasure] = useState('')
  const [mQty, setMQty] = useState('1')
  const [raw, setRaw] = useState('')
  const [cooked, setCooked] = useState('')
  const [other, setOther] = useState<CalcFood | null>(null)
  const [basis, setBasis] = useState<MacroKey | 'kcal'>('kcal')
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])
  const grams = (parseDecimal(qty) ?? 0) * (unit === 'kg' ? 1000 : 1)
  const m = food?.measures.find((x) => x.name === measure)

  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      <section className="card stack">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Gramas → nutrientes</h2>
        <FoodPicker
          foods={foods}
          label="Alimento"
          placeholder={food ? `Trocar alimento (${food.name})` : 'Buscar alimento (ex.: arroz, pão francês)'}
          onPick={(f) => {
            const full = byId.get(f.id)!
            setFood(full)
            setMeasure(full.measures[0]?.name ?? '')
            setRaw('')
            setCooked('')
          }}
        />
        {food && (
          <>
            <strong>{food.name}</strong>
            <div className="row">
              <NumInput id="p-qty" label="Quantidade" value={qty} onChange={setQty} />
              <div className="field">
                <label htmlFor="p-unit">Unidade</label>
                <select id="p-unit" value={unit} onChange={(e) => setUnit(e.target.value as 'g' | 'kg')}>
                  <option value="g">gramas (g)</option>
                  <option value="kg">quilos (kg)</option>
                </select>
              </div>
            </div>
            {grams > 0 && (
              <div className="calc-result" aria-live="polite">
                <div style={{ marginBottom: 8 }}>
                  {fmt(grams, 0)} g = <strong className="big">{fmt(scale(food.per100, grams).kcal, 0)} kcal</strong>
                </div>
                <NutriInline n={scale(food.per100, grams)} showKcal={false} />
                <div className="small muted" style={{ marginTop: 6 }}>
                  Fibras: {fmt(scale(food.per100, grams).fiber)} g · cálculo: valor por 100 g × {fmt(grams, 0)} g ÷ 100
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {food && food.measures.length > 0 && (
        <section className="card stack">
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Medida caseira ↔ gramas</h2>
          <div className="row">
            <NumInput id="m-qty" label="Quantidade" value={mQty} onChange={setMQty} />
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="m-name">Medida</label>
              <select id="m-name" value={measure} onChange={(e) => setMeasure(e.target.value)}>
                {food.measures.map((x) => (
                  <option key={x.name} value={x.name}>
                    {x.name} ({fmt(x.grams, 0)} g)
                  </option>
                ))}
              </select>
            </div>
          </div>
          {m && (
            <div className="calc-result">
              {formatMeasure(parseDecimal(mQty) ?? 0, m.name)} de {food.name.toLowerCase()} ≈ <strong className="big">{fmt((parseDecimal(mQty) ?? 0) * m.grams, 0)} g</strong> ·{' '}
              {fmt(scale(food.per100, (parseDecimal(mQty) ?? 0) * m.grams).kcal, 0)} kcal
              {grams > 0 && (
                <div className="small" style={{ marginTop: 6 }}>
                  E {fmt(grams, 0)} g equivalem a cerca de {formatMeasure(Math.round((grams / m.grams) * 2) / 2 || 0.5, m.name)}.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {food && food.cookingFactor && (
        <section className="card stack">
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Cru ↔ cozido</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Fator de cocção de {food.name.toLowerCase()}: {fmt(food.cookingFactor, 2)} (peso cozido ÷ peso cru), editável pelo coach.
          </p>
          <div className="row">
            <NumInput
              id="c-raw"
              label="Peso cru"
              unit="g"
              value={raw}
              onChange={(v) => {
                setRaw(v)
                const n = parseDecimal(v)
                setCooked(n != null ? String(Math.round(rawToCooked(n, food.cookingFactor!))) : '')
              }}
            />
            <NumInput
              id="c-cooked"
              label="Peso cozido"
              unit="g"
              value={cooked}
              onChange={(v) => {
                setCooked(v)
                const n = parseDecimal(v)
                setRaw(n != null ? String(Math.round(cookedToRaw(n, food.cookingFactor!))) : '')
              }}
            />
          </div>
        </section>
      )}

      {food && (
        <section className="card stack">
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Equivalência</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Quanto de outro alimento equivale a {fmt(grams, 0)} g de {food.name.toLowerCase()}?
          </p>
          <FoodPicker foods={foods} label="Alimento para comparar" placeholder={other ? `Trocar (${other.name})` : 'Buscar alimento para comparar'} onPick={(f) => setOther(byId.get(f.id)!)} />
          <div className="field" style={{ maxWidth: 280 }}>
            <label htmlFor="e-basis">Equivaler por</label>
            <select id="e-basis" value={basis} onChange={(e) => setBasis(e.target.value as MacroKey | 'kcal')}>
              <option value="kcal">Mesmas calorias</option>
              <option value="carbs">Mesmo carboidrato</option>
              <option value="protein">Mesma proteína</option>
              <option value="fat">Mesma gordura</option>
            </select>
            <span className="field__hint">Macro principal do grupo: {({ kcal: 'calorias', carbs: 'carboidrato', protein: 'proteína', fat: 'gordura' } as const)[GROUP_MAIN_MACRO[food.group] ?? 'kcal']}</span>
          </div>
          {other && grams > 0 && (
            <div className="calc-result">
              {(() => {
                const g = equivalentGrams(food.per100, grams, other.per100, basis)
                if (g == null) return <>Este alimento não tem esse nutriente para comparar.</>
                const near = nearestMeasure(g, other.measures)
                return (
                  <>
                    <strong className="big">{fmt(g, 0)} g</strong> de {other.name.toLowerCase()}
                    {near && near.error < 0.2 && <> (≈ {formatMeasure(near.qty, near.name)})</>}
                    <div className="small" style={{ marginTop: 6 }}>
                      <NutriInline n={scale(other.per100, g)} />
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </section>
      )}

      <Recipe foods={foods} />
      <p className="disclaimer">{disclaimer}</p>
    </div>
  )
}

function Recipe({ foods }: { foods: CalcFood[] }) {
  const [items, setItems] = useState<{ food: CalcFood; grams: string }[]>([])
  const [final, setFinal] = useState('')
  const [portions, setPortions] = useState('4')
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])
  const r = recipeNutrients(
    items.map((i) => ({ per100: i.food.per100, grams: parseDecimal(i.grams) ?? 0 })),
    parseDecimal(final) ?? 0,
    parseDecimal(portions) ?? 0,
  )
  return (
    <section className="card stack">
      <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Receita</h2>
      {items.map((it, i) => (
        <div key={i} className="row">
          <span style={{ flex: 1 }}>{it.food.name}</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Gramas de ${it.food.name}`}
            value={it.grams}
            style={{ width: 100 }}
            onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))}
          />
          <span className="small">g</span>
          <button type="button" className="icon-btn" aria-label={`Remover ${it.food.name}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <FoodPicker foods={foods} label="Adicionar ingrediente" placeholder="+ Ingrediente (busca)" onPick={(f) => setItems((l) => [...l, { food: byId.get(f.id)!, grams: '100' }])} />
      <div className="row">
        <NumInput id="r-final" label="Peso final pronto" unit="g" value={final} onChange={setFinal} />
        <NumInput id="r-portions" label="Porções" value={portions} onChange={setPortions} />
      </div>
      {items.length > 0 && (
        <div className="calc-result small">
          <div>
            Total: <NutriInline n={r.total} />
          </div>
          {r.perPortion && (
            <div>
              Por porção: <NutriInline n={r.perPortion} />
            </div>
          )}
          {r.per100 && (
            <div>
              Por 100 g do preparo: <NutriInline n={r.per100} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* ------------------------------ outras calculadoras ------------------------------ */

function WaistHip({ sex, setSex, disclaimer }: { sex: Sex; setSex: (s: Sex) => void; disclaimer: string }) {
  const [waist, setWaist] = useState('')
  const [hip, setHip] = useState('')
  const wv = parseDecimal(waist)
  const hv = parseDecimal(hip)
  return (
    <section className="card stack">
      <div className="form-grid form-grid--3">
        <div className="field">
          <label htmlFor="wh-sex">Sexo</label>
          <select id="wh-sex" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
        </div>
        <NumInput id="wh-waist" label="Cintura" unit="cm" value={waist} onChange={setWaist} />
        <NumInput id="wh-hip" label="Quadril" unit="cm" value={hip} onChange={setHip} />
      </div>
      {wv && (
        <div className="calc-result">
          <div>
            Circunferência da cintura: <strong>{waistRisk(wv, sex)}</strong>
            <span className="small muted"> (risco aumentado: {sex === 'M' ? 'H ≥ 94 cm; muito aumentado ≥ 102 cm' : 'M ≥ 80 cm; muito aumentado ≥ 88 cm'})</span>
          </div>
          {hv && (
            <div style={{ marginTop: 6 }}>
              {(() => {
                const r = waistHipRatio(wv, hv, sex)
                return (
                  <>
                    Relação cintura-quadril: <strong className="big">{fmt(r.value, 2)}</strong> · {r.increased ? 'risco aumentado' : 'sem risco aumentado'}
                    <span className="small muted"> (limite: {sex === 'M' ? '0,90' : '0,85'})</span>
                  </>
                )
              })()}
            </div>
          )}
          <p className="disclaimer">{disclaimer}</p>
        </div>
      )}
    </section>
  )
}

function Energy({
  personal,
  sex,
  w,
  h,
  a,
  invalid,
  disclaimer,
  pro,
  patientId,
  patients,
  setPatientId,
  onSave,
}: {
  personal: React.ReactNode
  sex: Sex
  w: number | null
  h: number | null
  a: number | null
  invalid: boolean
  disclaimer: string
  pro: boolean
  patientId: string
  patients: { id: string; name: string }[]
  setPatientId: (id: string) => void
  onSave?: Props['onSaveEnergy']
}) {
  const [formula, setFormula] = useState<BmrFormula>('mifflin')
  const [factor, setFactor] = useState(1.375)
  const [fat, setFat] = useState('')
  const [adjust, setAdjust] = useState('-400')
  const [unit, setUnit] = useState<'kcal' | 'pct'>('kcal')
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const needsLean = formula === 'katch' || formula === 'cunningham'
  const fatPct = parseDecimal(fat)
  const lean = w && fatPct != null ? leanMass(w, fatPct) : null
  const ready = w && h && a && !invalid && (!needsLean || lean)
  const b = ready ? bmr(formula, { sex, weightKg: w!, heightCm: h!, age: a!, leanKg: lean }) : null
  const g = b ? tdee(b, factor) : null
  const adj = parseDecimal(adjust) ?? 0
  const target = g ? calorieTarget(g, adj, unit) : null

  return (
    <section className="card stack">
      {personal}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="en-formula">Fórmula da TMB</label>
          <select id="en-formula" value={formula} onChange={(e) => setFormula(e.target.value as BmrFormula)}>
            {Object.entries(BMR_FORMULAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="en-factor">Nível de atividade</label>
          <select id="en-factor" value={factor} onChange={(e) => setFactor(Number(e.target.value))}>
            {ACTIVITY_FACTORS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label} (× {fmt(f.value, 3)})
              </option>
            ))}
          </select>
        </div>
        {needsLean && <NumInput id="en-fat" label="% de gordura corporal" value={fat} onChange={setFat} hint="Necessário para calcular a massa magra" />}
        <div className="field">
          <label htmlFor="en-adjust">Ajuste da meta (déficit negativo, superávit positivo)</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id="en-adjust" type="text" inputMode="decimal" value={adjust} onChange={(e) => setAdjust(e.target.value)} />
            <select aria-label="Unidade do ajuste" value={unit} onChange={(e) => setUnit(e.target.value as 'kcal' | 'pct')} style={{ width: 110 }}>
              <option value="kcal">kcal</option>
              <option value="pct">%</option>
            </select>
          </div>
        </div>
      </div>
      {b && g && target ? (
        <div className="calc-result" aria-live="polite">
          <div>
            TMB ({BMR_FORMULAS[formula]}): <strong>{fmt(b, 2)} kcal</strong>
          </div>
          <div>
            GET (TMB × {fmt(factor, 3)}): <strong className="big">{fmt(g, 1)} kcal</strong>
          </div>
          <div>
            Meta calórica: <strong>{fmt(target, 0)} kcal/dia</strong>
          </div>
          {lean && <div className="small muted">Massa magra: {fmt(lean)} kg</div>}
          <p className="disclaimer">{disclaimer}</p>
        </div>
      ) : (
        <p className="muted small">Preencha sexo, idade, peso e altura{needsLean ? ' e o % de gordura' : ''}.</p>
      )}
      {pro && onSave && b && g && target && (
        <div className="row">
          <select aria-label="Cliente" value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Escolher cliente…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!patientId || pending}
            onClick={() =>
              start(async () => {
                const r = await onSave(patientId, { formula, factor, bmr: b, tdee: g, targetKcal: Math.round(target), adjust: adj, adjustUnit: unit })
                setMsg(r.error ? { text: r.error } : { ok: true, text: r.message ?? 'Salvo na ficha.' })
              })
            }
          >
            {pending ? 'Salvando…' : 'Salvar na ficha do cliente'}
          </button>
        </div>
      )}
      {msg && <p className={`alert ${msg.ok ? 'alert--ok' : 'alert--error'}`}>{msg.text}</p>}
    </section>
  )
}

function Macros({ weight, disclaimer }: { weight: number | null; disclaimer: string }) {
  const [kcal, setKcal] = useState('1800')
  const [mode, setMode] = useState<'pct' | 'gkg'>('pct')
  const [pct, setPct] = useState({ protein: '25', carbs: '50', fat: '25' })
  const [gkg, setGkg] = useState({ protein: '1,6', carbs: '3', fat: '0,8' })
  const k = parseDecimal(kcal) ?? 0
  const res =
    mode === 'pct'
      ? { ...macrosFromPct(k, { protein: parseDecimal(pct.protein) ?? 0, carbs: parseDecimal(pct.carbs) ?? 0, fat: parseDecimal(pct.fat) ?? 0 }), kcal: k }
      : weight
        ? macrosFromGkg(weight, { protein: parseDecimal(gkg.protein) ?? 0, carbs: parseDecimal(gkg.carbs) ?? 0, fat: parseDecimal(gkg.fat) ?? 0 })
        : null
  const alert = res && weight ? proteinAlert(res.protein, weight) : null
  const sumPct = (parseDecimal(pct.protein) ?? 0) + (parseDecimal(pct.carbs) ?? 0) + (parseDecimal(pct.fat) ?? 0)
  return (
    <section className="card stack">
      <div className="segmented" role="group" aria-label="Modo">
        {(['pct', 'gkg'] as const).map((m) => (
          <a
            key={m}
            href="#"
            aria-current={mode === m ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault()
              setMode(m)
            }}
          >
            {m === 'pct' ? '% das calorias' : 'g/kg de peso'}
          </a>
        ))}
      </div>
      {mode === 'pct' ? (
        <div className="form-grid">
          <NumInput id="mc-kcal" label="Meta calórica" unit="kcal" value={kcal} onChange={setKcal} />
          {(['protein', 'carbs', 'fat'] as const).map((key) => (
            <NumInput key={key} id={`mc-${key}`} label={{ protein: 'Proteína', carbs: 'Carboidrato', fat: 'Gordura' }[key]} unit="%" value={pct[key]} onChange={(v) => setPct((p) => ({ ...p, [key]: v }))} />
          ))}
        </div>
      ) : (
        <div className="form-grid">
          {(['protein', 'carbs', 'fat'] as const).map((key) => (
            <NumInput key={key} id={`mg-${key}`} label={{ protein: 'Proteína', carbs: 'Carboidrato', fat: 'Gordura' }[key]} unit="g/kg" value={gkg[key]} onChange={(v) => setGkg((p) => ({ ...p, [key]: v }))} />
          ))}
          {!weight && <p className="small muted">Informe o peso na aba “IMC e peso” ou “Gasto energético”.</p>}
        </div>
      )}
      {mode === 'pct' && sumPct !== 100 && <p className="small" style={{ color: 'var(--warn)', margin: 0 }}>A soma está em {fmt(sumPct, 0)}%.</p>}
      {res && (
        <div className="calc-result">
          <MacroBars value={{ kcal: res.kcal, protein: res.protein, carbs: res.carbs, fat: res.fat, fiber: 0 }} target={{}} />
          <p className="small" style={{ margin: '8px 0 0' }}>
            Total: {fmt(res.kcal, 0)} kcal
            {weight && ` · proteína ${fmt(res.protein / weight)} g/kg`}
          </p>
          {alert && <p className="alert alert--warn small" style={{ marginTop: 8 }}>{alert}</p>}
          <p className="disclaimer">Gramas = kcal × % ÷ 4 (proteína e carboidrato) ou ÷ 9 (gordura). {disclaimer}</p>
        </div>
      )}
    </section>
  )
}

function WaterCalc({ weight, setWeight, weightError, mlPerKg, disclaimer }: { weight: string; setWeight: (v: string) => void; weightError: string | null; mlPerKg: number; disclaimer: string }) {
  const [extra, setExtra] = useState('0')
  const w = parseDecimal(weight)
  return (
    <section className="card stack">
      <div className="form-grid">
        <NumInput id="w-weight" label="Peso" unit="kg" value={weight} onChange={setWeight} hint={weightError ?? undefined} />
        <NumInput id="w-extra" label="Acréscimo em dias de treino" unit="ml" value={extra} onChange={setExtra} />
      </div>
      {w && !weightError && (
        <div className="calc-result">
          Meta diária: <strong className="big">{fmt(waterGoalMl(w, mlPerKg, parseDecimal(extra) ?? 0) / 1000, 2)} L</strong>
          <span className="small muted"> ({mlPerKg} ml × peso + acréscimo)</span>
          <p className="disclaimer">{disclaimer}</p>
        </div>
      )}
    </section>
  )
}

function Projection({ disclaimer }: { disclaimer: string }) {
  const [deficit, setDeficit] = useState('500')
  const [days, setDays] = useState('30')
  const d = parseDecimal(deficit) ?? 0
  const n = parseDecimal(days) ?? 0
  return (
    <section className="card stack">
      <div className="form-grid">
        <NumInput id="pj-def" label="Déficit diário" unit="kcal" value={deficit} onChange={setDeficit} />
        <NumInput id="pj-days" label="Período" unit="dias" value={days} onChange={setDays} />
      </div>
      <div className="calc-result">
        Estimativa: <strong className="big">{fmt(fatChangeKg(d, n))} kg</strong> de gordura em {fmt(n, 0)} dias
        <p className="disclaimer">Déficit × dias ÷ 7.700 kcal. A resposta real varia por adaptação metabólica, água e adesão; use apenas como referência. {disclaimer}</p>
      </div>
    </section>
  )
}
