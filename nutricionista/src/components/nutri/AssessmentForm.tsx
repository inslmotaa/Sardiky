'use client'

import { useState } from 'react'
import type { ActionState } from '@/lib/action'
import {
  bmi,
  bmiClass,
  BODY_FAT_PROTOCOLS,
  bodyFatFromSkinfolds,
  fmt,
  leanMass,
  parseDecimal,
  protocolSites,
  SKINFOLDS,
  waistHipRatio,
  waistRisk,
  type BodyFatProtocol,
  type Sex,
  type SkinfoldKey,
  type Skinfolds,
} from '@/lib/nutricao'
import { ActionForm, Field, SubmitButton } from '@/components/form'

type Action = (state: ActionState, data: FormData) => Promise<ActionState>

const CIRCUMFERENCES = [
  ['waistCm', 'Cintura'],
  ['hipCm', 'Quadril'],
  ['abdomenCm', 'Abdômen'],
  ['armCm', 'Braço'],
  ['thighCm', 'Coxa'],
  ['calfCm', 'Panturrilha'],
  ['chestCm', 'Tórax'],
] as const

const BIA = [
  ['fatPct', 'Gordura (%)'],
  ['muscleKg', 'Massa muscular (kg)'],
  ['waterPct', 'Água corporal (%)'],
  ['visceral', 'Gordura visceral (nível)'],
  ['bmrKcal', 'Taxa metabólica (kcal)'],
] as const

/**
 * Avaliação antropométrica com cálculos ao vivo (IMC, RCQ, risco pela cintura, % de gordura por
 * dobras e massa magra). O servidor recalcula o % de gordura ao salvar; a prévia é só para conferência.
 */
export function AssessmentForm({ action, sex, age, lastHeight, today }: { action: Action; sex: Sex | null; age: number | null; lastHeight: number | null; today: string }) {
  const [v, setV] = useState<Record<string, string>>({ heightCm: lastHeight != null ? String(lastHeight).replace('.', ',') : '' })
  const n = (k: string) => parseDecimal(v[k])
  const protocol = (v.skinfoldProtocol || '') as BodyFatProtocol | ''
  const folds: Skinfolds = {}
  for (const k of Object.keys(SKINFOLDS) as SkinfoldKey[]) {
    const x = n(`sk_${k}`)
    if (x != null) folds[k] = x
  }
  const weight = n('weightKg')
  const height = n('heightCm')
  const waist = n('waistCm')
  const hip = n('hipCm')
  const imc = weight && height ? bmi(weight, height) : null
  const fold = protocol && sex && age != null ? bodyFatFromSkinfolds(protocol, sex, age, folds) : null
  const fatPct = fold?.pct ?? n('bodyFatPct') ?? n('bia_fatPct')
  const fatSource = fold ? BODY_FAT_PROTOCOLS[protocol as BodyFatProtocol] : n('bodyFatPct') != null ? 'informado' : n('bia_fatPct') != null ? 'bioimpedância' : null
  const sites = protocol && sex ? protocolSites(protocol, sex) : []

  return (
    <ActionForm action={action} className="stack" resetOnSuccess>
      <div
        className="stack"
        onChange={(e) => {
          const t = e.target as HTMLInputElement
          if (t.name) setV((cur) => ({ ...cur, [t.name]: t.value }))
        }}
      >
        <fieldset>
          <legend>Peso e altura</legend>
          <div className="form-grid form-grid--3">
            <Field label="Data" name="date" required>
              <input type="date" name="date" defaultValue={today} />
            </Field>
            <Field label="Peso (kg)" name="weightKg">
              <input name="weightKg" inputMode="decimal" />
            </Field>
            <Field label="Altura (cm)" name="heightCm">
              <input name="heightCm" inputMode="decimal" defaultValue={v.heightCm} />
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <legend>Circunferências (cm)</legend>
          <div className="form-grid form-grid--4">
            {CIRCUMFERENCES.map(([k, label]) => (
              <Field key={k} label={label} name={k}>
                <input name={k} inputMode="decimal" />
              </Field>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Dobras cutâneas (mm)</legend>
          <Field label="Protocolo" name="skinfoldProtocol" hint={!sex || age == null ? 'Para calcular, o cadastro precisa ter sexo e data de nascimento.' : 'As dobras usadas pelo protocolo ficam destacadas.'}>
            <select name="skinfoldProtocol" defaultValue="">
              <option value="">Não calcular por dobras</option>
              {Object.entries(BODY_FAT_PROTOCOLS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid form-grid--4" style={{ marginTop: 10 }}>
            {(Object.keys(SKINFOLDS) as SkinfoldKey[]).map((k) => (
              <Field key={k} label={`${SKINFOLDS[k]}${sites.includes(k) ? ' •' : ''}`} name={`sk_${k}`}>
                <input name={`sk_${k}`} inputMode="decimal" className={sites.includes(k) ? 'input--highlight' : undefined} />
              </Field>
            ))}
          </div>
        </fieldset>

        <details className="disclosure">
          <summary>Bioimpedância (opcional)</summary>
          <div className="form-grid form-grid--3">
            {BIA.map(([k, label]) => (
              <Field key={k} label={label} name={`bia_${k}`}>
                <input name={`bia_${k}`} inputMode="decimal" />
              </Field>
            ))}
          </div>
        </details>

        <details className="disclosure">
          <summary>Percentual de gordura informado (outro método)</summary>
          <div className="form-grid">
            <Field label="Gordura corporal (%)" name="bodyFatPct" hint="Usado só quando não houver cálculo por dobras.">
              <input name="bodyFatPct" inputMode="decimal" />
            </Field>
            <Field label="Método" name="bodyFatMethod">
              <input name="bodyFatMethod" list="fat-methods" maxLength={80} />
            </Field>
          </div>
          <datalist id="fat-methods">
            <option value="Bioimpedância" />
            <option value="DEXA" />
            <option value="Pesagem hidrostática" />
          </datalist>
        </details>

        <fieldset>
          <legend>Outros indicadores (opcional)</legend>
          <div className="stack" style={{ ['--gap' as string]: '8px' }}>
            {[0, 1].map((i) => (
              <div key={i} className="form-grid form-grid--3">
                <input name={`extraLabel_${i}`} placeholder="Indicador (ex.: circ. pescoço)" aria-label={`Nome do indicador ${i + 1}`} />
                <input name={`extraValue_${i}`} placeholder="Valor" inputMode="decimal" aria-label={`Valor do indicador ${i + 1}`} />
                <input name={`extraUnit_${i}`} placeholder="Unidade" aria-label={`Unidade do indicador ${i + 1}`} />
              </div>
            ))}
          </div>
        </fieldset>
        <Field label="Observações" name="notes">
          <textarea name="notes" rows={2} />
        </Field>
      </div>

      <section className="calc-result" aria-live="polite" aria-label="Resultados calculados">
        <dl className="kv">
          <dt>IMC</dt>
          <dd>{imc ? `${fmt(imc, 1)} (${bmiClass(imc, age).label})` : '—'}</dd>
          <dt>Relação cintura-quadril</dt>
          <dd>{waist && hip && sex ? `${fmt(waistHipRatio(waist, hip, sex).value, 2)}${waistHipRatio(waist, hip, sex).increased ? ' · risco aumentado' : ''}` : '—'}</dd>
          <dt>Cintura</dt>
          <dd>{waist && sex ? waistRisk(waist, sex) : '—'}</dd>
          <dt>Gordura corporal</dt>
          <dd>
            {fatPct != null ? `${fmt(fatPct, 1)}% (${fatSource})` : '—'}
            {fold && <span className="small muted"> · soma {fmt(fold.sumMm, 0)} mm · densidade {fmt(fold.density, 4)}</span>}
          </dd>
          <dt>Massa magra</dt>
          <dd>{weight && fatPct != null ? `${fmt(leanMass(weight, fatPct), 1)} kg` : '—'}</dd>
        </dl>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          Fórmulas: Jackson-Pollock (3 e 7 dobras) e Durnin-Womersley → densidade → Siri (%G = 495 ÷ D − 450). Confira os valores antes de usar clinicamente.
        </p>
      </section>
      <div>
        <SubmitButton>Salvar avaliação</SubmitButton>
      </div>
    </ActionForm>
  )
}
