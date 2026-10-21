import { and, asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can, STAFF_PERMISSIONS } from '@/lib/auth/permissions'
import { getSettings, getWorkingHours } from '@/lib/settings'
import { integrationStatus } from '@/lib/integrations'
import { fmtDateTime, fmtDay, weekdayName } from '@/lib/time'
import {
  addTestimonial,
  deleteFaq,
  deleteTestimonial,
  inviteStaff,
  saveFaq,
  saveProfile,
  saveSchedule,
  saveService,
  saveChatSettings,
  saveClinicalSettings,
  saveTemplates,
  toggleTestimonial,
  updateStaff,
} from '@/actions/admin/settings'
import { ActionForm, Field, FieldError, SubmitButton } from '@/components/form'
import { DemoTag, NoAccess, PageHead, Tabs } from '@/components/ui'
import { titledText } from '@/lib/planos'

const SECTIONS = [
  { key: 'perfil', label: 'Perfil e identidade', perm: 'config' },
  { key: 'servicos', label: 'Serviços e valores', perm: 'config' },
  { key: 'horarios', label: 'Horários e agendamento', perm: 'config' },
  { key: 'mensagens', label: 'Mensagens', perm: 'config' },
  { key: 'chat', label: 'Chat', perm: 'config' },
  { key: 'planos', label: 'Planos, anamnese e PDF', perm: 'config' },
  { key: 'site', label: 'Depoimentos e dúvidas', perm: 'site' },
  { key: 'equipe', label: 'Equipe e permissões', perm: 'config' },
  { key: 'integracoes', label: 'Integrações', perm: 'config' },
] as const

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ secao?: string }> }) {
  const sp = await searchParams
  const user = await requireTeam()
  const visible = SECTIONS.filter((x) => can(user, x.perm))
  if (visible.length === 0) return <NoAccess />
  const sec = visible.find((x) => x.key === sp.secao) ?? visible[0]
  const s = await getSettings()

  return (
    <div>
      <PageHead title="Configurações" />
      <Tabs current={sec.key} items={visible.map((x) => ({ key: x.key, label: x.label, href: `/admin/configuracoes?secao=${x.key}` }))} />
      {sec.key === 'perfil' && <ProfileSection s={s} />}
      {sec.key === 'servicos' && <ServicesSection />}
      {sec.key === 'horarios' && <ScheduleSection s={s} />}
      {sec.key === 'mensagens' && <TemplatesSection s={s} />}
      {sec.key === 'chat' && <ChatSection s={s} />}
      {sec.key === 'planos' && <ClinicalSection s={s} />}
      {sec.key === 'site' && <SiteSection />}
      {sec.key === 'equipe' && <TeamSection tz={s.timezone} />}
      {sec.key === 'integracoes' && <IntegrationsSection />}
    </div>
  )
}

type S = Awaited<ReturnType<typeof getSettings>>

function ProfileSection({ s }: { s: S }) {
  return (
    <ActionForm action={saveProfile} className="stack" encType="multipart/form-data">
      <section className="card stack">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Profissional</h2>
        <div className="form-grid">
          <Field label="Nome de exibição" name="professionalName" required>
            <input name="professionalName" defaultValue={s.professionalName} />
          </Field>
          <Field label="Título" name="professionalTitle" required>
            <input name="professionalTitle" defaultValue={s.professionalTitle} />
          </Field>
          <Field label="Registro profissional (CRN)" name="registry" hint="Ex.: CRN-3 12345">
            <input name="registry" defaultValue={s.registry ?? ''} />
          </Field>
          <Field label="Cor principal" name="brandColor" hint="Usada em botões, destaques e gráficos.">
            <input type="color" name="brandColor" defaultValue={s.brandColor} />
          </Field>
        </div>
        <Field label="Apresentação" name="bio">
          <textarea name="bio" rows={4} defaultValue={s.bio} />
        </Field>
        <div className="form-grid">
          <Field label="Especialidades e áreas de atendimento" name="specialties" hint="Uma por linha.">
            <textarea name="specialties" rows={4} defaultValue={s.specialties.join('\n')} />
          </Field>
          <Field label="Diferenciais" name="differentials" hint="Um por linha.">
            <textarea name="differentials" rows={4} defaultValue={s.differentials.join('\n')} />
          </Field>
        </div>
        <Field label="Método de trabalho" name="method">
          <textarea name="method" rows={3} defaultValue={s.method} />
        </Field>
        <Field label="Como funciona o acompanhamento" name="howItWorks" hint="Uma etapa por linha, no formato: Título | descrição">
          <textarea name="howItWorks" rows={4} defaultValue={s.howItWorks.map((h) => `${h.title} | ${h.text}`).join('\n')} />
        </Field>
        <div className="form-grid">
          <Field label="Foto profissional" name="photo" hint="JPG, PNG ou WebP até 5 MB. Aparece no site.">
            <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" />
          </Field>
          <Field label="Logotipo" name="logo" hint="Substitui o ícone padrão no cabeçalho.">
            <input type="file" name="logo" accept="image/jpeg,image/png,image/webp" />
          </Field>
        </div>
        <div className="row">
          {s.photoFileId && (
            <label className="check">
              <input type="checkbox" name="removePhoto" /> Remover foto atual
            </label>
          )}
          {s.logoFileId && (
            <label className="check">
              <input type="checkbox" name="removeLogo" /> Remover logotipo atual
            </label>
          )}
        </div>
      </section>
      <section className="card stack">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Atendimento e contato</h2>
        <div className="form-grid">
          <Field label="Endereço" name="address">
            <input name="address" defaultValue={s.address ?? ''} />
          </Field>
          <Field label="Horários (texto do site)" name="hoursText">
            <input name="hoursText" defaultValue={s.hoursText ?? ''} />
          </Field>
          <Field label="Modalidades (texto do site)" name="modalityText">
            <input name="modalityText" defaultValue={s.modalityText ?? ''} />
          </Field>
          <Field label="WhatsApp" name="whatsapp" hint="Com 55 e DDD, só números. Ex.: 5511999999999">
            <input name="whatsapp" inputMode="numeric" defaultValue={s.whatsapp ?? ''} />
          </Field>
          <Field label="Instagram (link)" name="instagram">
            <input name="instagram" type="url" defaultValue={s.instagram ?? ''} />
          </Field>
          <Field label="E-mail de contato" name="contactEmail">
            <input name="contactEmail" type="email" defaultValue={s.contactEmail ?? ''} />
          </Field>
          <Field label="Contato do encarregado de dados (LGPD)" name="privacyContact">
            <input name="privacyContact" defaultValue={s.privacyContact ?? ''} />
          </Field>
          <Field label="Link do formulário de anamnese" name="anamneseUrl" hint="Google Forms, Typeform, Tally… Aparece no site, no primeiro acesso e no app.">
            <input name="anamneseUrl" type="url" defaultValue={s.anamneseUrl ?? ''} />
          </Field>
          <Field label="Meta padrão de água (ml por kg)" name="waterMlPerKg" hint="Usada no contador de água do app e nas calculadoras.">
            <input name="waterMlPerKg" inputMode="numeric" defaultValue={s.waterMlPerKg} />
          </Field>
        </div>
        <Field label="Botão “Agendar consulta” do site" name="bookingChannel" hint="Pelo WhatsApp, a agenda on-line fica desligada e todos os botões de agendar e o contato abrem a conversa.">
          <select name="bookingChannel" defaultValue={s.bookingChannel}>
            <option value="whatsapp">Abre o WhatsApp do consultório</option>
            <option value="site">Abre a agenda on-line do site</option>
          </select>
        </Field>
        <label className="check">
          <input type="checkbox" name="showPrices" defaultChecked={s.showPrices} /> Mostrar os valores das consultas no site
        </label>
        <label className="check">
          <input type="checkbox" name="showPlanPrices" defaultChecked={s.showPlanPrices} /> Mostrar os valores dos planos de acompanhamento no site (os planos são editados em Financeiro)
        </label>
        <Field label="Todos os planos incluem" name="plansIncluded" hint="Um item por linha, no formato Título | texto. Aparece abaixo dos planos no site.">
          <textarea name="plansIncluded" rows={4} defaultValue={titledText(s.plansIncluded)} />
        </Field>
        <label className="check">
          <input type="checkbox" name="demoBanner" defaultChecked={s.demoBanner} /> Exibir a faixa “versão de demonstração” no site (desmarque ao publicar com dados reais)
        </label>
      </section>
      <div>
        <SubmitButton>Salvar perfil</SubmitButton>
      </div>
    </ActionForm>
  )
}

async function ServicesSection() {
  const services = await db.select().from(schema.services).orderBy(asc(schema.services.sort))
  const form = (svc?: typeof schema.services.$inferSelect) => (
    <ActionForm action={saveService} className="stack">
      {svc && <input type="hidden" name="id" value={svc.id} />}
      <div className="form-grid form-grid--3">
        <Field label="Nome" name="name">
          <input name="name" defaultValue={svc?.name} />
        </Field>
        <Field label="Modalidade" name="modality">
          <select name="modality" defaultValue={svc?.modality ?? 'ambos'}>
            <option value="ambos">Presencial e on-line</option>
            <option value="presencial">Somente presencial</option>
            <option value="online">Somente on-line</option>
          </select>
        </Field>
        <Field label="Duração (min)" name="durationMinutes">
          <input name="durationMinutes" inputMode="numeric" defaultValue={svc?.durationMinutes ?? 60} />
        </Field>
        <Field label="Valor (R$)" name="price">
          <input name="price" inputMode="decimal" defaultValue={svc ? (svc.priceCents / 100).toFixed(2).replace('.', ',') : ''} />
        </Field>
        <Field label="Ordem" name="sort">
          <input name="sort" inputMode="numeric" defaultValue={svc?.sort ?? services.length + 1} />
        </Field>
      </div>
      <Field label="Descrição" name="description">
        <input name="description" defaultValue={svc?.description} maxLength={500} />
      </Field>
      <div className="row">
        <label className="check">
          <input type="checkbox" name="isPublic" defaultChecked={svc?.isPublic ?? true} /> Exibir no site e no agendamento on-line
        </label>
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={svc?.active ?? true} /> Ativo
        </label>
      </div>
      <div>
        <SubmitButton>{svc ? 'Salvar' : 'Adicionar serviço'}</SubmitButton>
      </div>
    </ActionForm>
  )
  return (
    <div className="stack">
      {services.map((svc) => (
        <details key={svc.id} className="disclosure">
          <summary>
            {svc.name} · {svc.durationMinutes} min · {(svc.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            {!svc.active && ' · inativo'}
            {svc.active && !svc.isPublic && ' · interno'}
          </summary>
          <div>{form(svc)}</div>
        </details>
      ))}
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Novo serviço</h2>
        {form()}
      </section>
    </div>
  )
}

async function ScheduleSection({ s }: { s: S }) {
  const hours = await getWorkingHours()
  return (
    <ActionForm action={saveSchedule} className="stack">
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Horário de atendimento</h2>
        <p className="muted small">Até dois períodos por dia (ex.: manhã e tarde). Deixe em branco os dias sem atendimento.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>1º período</th>
                <th>2º período</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                const w = hours.filter((h) => h.weekday === wd)
                return (
                  <tr key={wd}>
                    <td style={{ textTransform: 'capitalize' }}>
                      {weekdayName(wd)}
                      <FieldError name={`d${wd}`} />
                    </td>
                    {[1, 2].map((n) => (
                      <td key={n}>
                        <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                          <input type="time" name={`d${wd}_s${n}`} defaultValue={w[n - 1]?.start ?? ''} aria-label={`${weekdayName(wd)}, início do ${n}º período`} />
                          <span>às</span>
                          <input type="time" name={`d${wd}_e${n}`} defaultValue={w[n - 1]?.end ?? ''} aria-label={`${weekdayName(wd)}, fim do ${n}º período`} />
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Regras do agendamento on-line</h2>
        <div className="form-grid">
          <Field label="Intervalo entre horários oferecidos (min)" name="slotStepMinutes">
            <input name="slotStepMinutes" inputMode="numeric" defaultValue={s.slotStepMinutes} />
          </Field>
          <Field label="Folga entre consultas (min)" name="bufferMinutes">
            <input name="bufferMinutes" inputMode="numeric" defaultValue={s.bufferMinutes} />
          </Field>
          <Field label="Antecedência mínima (horas)" name="minNoticeHours">
            <input name="minNoticeHours" inputMode="numeric" defaultValue={s.minNoticeHours} />
          </Field>
          <Field label="Agendar até quantos dias à frente" name="maxDaysAhead">
            <input name="maxDaysAhead" inputMode="numeric" defaultValue={s.maxDaysAhead} />
          </Field>
        </div>
        <p className="small muted">A duração e o valor de cada consulta são definidos em “Serviços e valores”.</p>
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Módulos e retenção de dados</h2>
        <label className="check">
          <input type="checkbox" name="financeEnabled" defaultChecked={s.financeEnabled} /> Ativar módulo financeiro
        </label>
        <div style={{ maxWidth: 360, marginTop: 12 }}>
          <Field label="Eliminar contatos de interessados não convertidos após (dias)" name="leadRetentionDays">
            <input name="leadRetentionDays" inputMode="numeric" defaultValue={s.leadRetentionDays} />
          </Field>
        </div>
      </section>
      <div>
        <SubmitButton>Salvar horários e regras</SubmitButton>
      </div>
    </ActionForm>
  )
}

async function ClinicalSection({ s }: { s: S }) {
  const templates = await db.select({ id: schema.formTemplates.id, title: schema.formTemplates.title, kind: schema.formTemplates.kind }).from(schema.formTemplates).where(eq(schema.formTemplates.active, true))
  return (
    <section className="card">
      <ActionForm action={saveClinicalSettings} className="stack">
        <Field label="Refeições padrão dos planos novos (uma por linha: nome e horário)" name="defaultMeals" hint="Ex.: Café da manhã 07:00. Um plano “em branco” já começa com essas refeições.">
          <textarea name="defaultMeals" rows={6} defaultValue={s.defaultMeals.map((m) => `${m.name} ${m.time}`).join('\n')} />
        </Field>
        <Field label="Anamnese enviada automaticamente a cada paciente novo" name="autoAnamnesisTemplateId" hint="Modelos criados em Formulários. Com o link externo (Google Forms) configurado no Perfil, os dois convivem.">
          <select name="autoAnamnesisTemplateId" defaultValue={s.autoAnamnesisTemplateId ?? ''}>
            <option value="">Não enviar automaticamente</option>
            {templates
              .filter((t) => t.kind === 'anamnese')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </Field>
        <fieldset>
          <legend>Assinatura no PDF do plano</legend>
          <Field label="Texto abaixo da assinatura (opcional)" name="signatureText" hint="Ex.: Nutricionista — CRN-0 00000 · contato@…">
            <input name="signatureText" maxLength={300} defaultValue={s.signatureText ?? ''} />
          </Field>
          <Field label="Imagem da assinatura (PNG ou JPG, fundo branco ou transparente)" name="signature">
            <input type="file" name="signature" accept="image/png,image/jpeg" />
          </Field>
          {s.signatureFileId && (
            <div className="row" style={{ alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/arquivos/${s.signatureFileId}`} alt="Assinatura atual" style={{ maxHeight: 56, background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 4 }} />
              <label className="check">
                <input type="checkbox" name="removeSignature" /> Remover imagem
              </label>
            </div>
          )}
        </fieldset>
        <p className="small muted" style={{ margin: 0 }}>
          Logo, cor da marca, nome e registro profissional ficam em “Perfil e identidade” e também aparecem no PDF.
        </p>
        <div>
          <SubmitButton>Salvar</SubmitButton>
        </div>
      </ActionForm>
    </section>
  )
}

function ChatSection({ s }: { s: S }) {
  const h = s.chatHours
  return (
    <section className="card">
      <ActionForm action={saveChatSettings} className="stack">
        <Field label="Respostas rápidas (uma por linha)" name="quickReplies" hint="Aparecem como atalhos no chat e no painel de Acompanhamento. Use {nome} para o primeiro nome do paciente.">
          <textarea name="quickReplies" rows={5} defaultValue={s.quickReplies.join('\n')} />
        </Field>
        <fieldset>
          <legend>Horário de atendimento do chat</legend>
          <div className="row" style={{ gap: 10 }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <label key={d} className="check">
                <input type="checkbox" name="chatDays" value={d} defaultChecked={h ? h.weekdays.includes(d) : d >= 1 && d <= 5} /> {weekdayName(d)}
              </label>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: 10 }}>
            <Field label="Das" name="chatStart" hint="Deixe em branco para não limitar o horário.">
              <input type="time" name="chatStart" defaultValue={h?.start ?? ''} />
            </Field>
            <Field label="Até" name="chatEnd">
              <input type="time" name="chatEnd" defaultValue={h?.end ?? ''} />
            </Field>
          </div>
        </fieldset>
        <Field label="Resposta automática fora do horário" name="chatAutoReply" hint="Enviada no máximo uma vez a cada 12 horas por paciente.">
          <textarea
            name="chatAutoReply"
            rows={2}
            maxLength={500}
            defaultValue={s.chatAutoReply ?? ''}
            placeholder="Oi! Recebi sua mensagem e respondo no próximo horário de atendimento. Em caso de urgência, procure um serviço de saúde."
          />
        </Field>
        <div>
          <SubmitButton>Salvar chat</SubmitButton>
        </div>
      </ActionForm>
    </section>
  )
}

function TemplatesSection({ s }: { s: S }) {
  const email = integrationStatus().email
  return (
    <section className="card">
      <p className="muted small">
        Variáveis disponíveis: <code>{'{nome}'}</code> <code>{'{data}'}</code> <code>{'{hora}'}</code> <code>{'{servico}'}</code> <code>{'{codigo}'}</code>.{' '}
        {email ? 'As mensagens são enviadas por e-mail.' : 'Enquanto o e-mail não estiver configurado, os textos são usados no botão “Enviar pelo WhatsApp” da consulta e nos avisos da área do paciente.'}
      </p>
      <ActionForm action={saveTemplates} className="stack">
        <Field label="Confirmação de consulta" name="confirmacao">
          <textarea name="confirmacao" rows={3} defaultValue={s.templates.confirmacao} />
        </Field>
        <Field label={<>Lembrete (enviado na véspera {!integrationStatus().cron || !email ? <DemoTag>requer e-mail e tarefa agendada</DemoTag> : null})</>} name="lembrete">
          <textarea name="lembrete" rows={3} defaultValue={s.templates.lembrete} />
        </Field>
        <Field label="Cancelamento" name="cancelamento">
          <textarea name="cancelamento" rows={3} defaultValue={s.templates.cancelamento} />
        </Field>
        <div>
          <SubmitButton>Salvar modelos</SubmitButton>
        </div>
      </ActionForm>
    </section>
  )
}

async function SiteSection() {
  const [testimonials, faqs] = await Promise.all([
    db.select().from(schema.testimonials).orderBy(asc(schema.testimonials.sort)),
    db.select().from(schema.faqs).orderBy(asc(schema.faqs.sort)),
  ])
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <section className="stack">
        <h2 style={{ fontSize: '1.1rem' }}>Depoimentos</h2>
        <p className="alert alert--info small">Publique apenas depoimentos com autorização expressa do paciente, sem promessas de resultado e sem expor dados de saúde identificáveis.</p>
        <ul className="card list">
          {testimonials.map((t) => (
            <li key={t.id}>
              <div className="row row--between">
                <strong>{t.authorDisplay}</strong>
                <span className={`badge ${t.published ? 'badge--ok' : 'badge--plain'}`}>{t.published ? 'Publicado' : 'Oculto'}</span>
              </div>
              <div className="small">“{t.text}”</div>
              <div className="small muted">{t.authorizedAt ? `Autorizado em ${fmtDay(t.authorizedAt)}` : 'Sem autorização registrada — não pode ser publicado'}</div>
              <div className="row small" style={{ marginTop: 4 }}>
                {t.authorizedAt && (
                  <form action={toggleTestimonial.bind(null, t.id)}>
                    <button className="link-btn" type="submit">
                      {t.published ? 'Ocultar' : 'Publicar'}
                    </button>
                  </form>
                )}
                <form action={deleteTestimonial.bind(null, t.id)}>
                  <button className="link-btn" type="submit">
                    Excluir
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <div className="card">
          <h3>Novo depoimento</h3>
          <ActionForm action={addTestimonial} className="stack" resetOnSuccess>
            <Field label="Identificação do autor" name="authorDisplay" hint="Prefira iniciais. Ex.: M. S.">
              <input name="authorDisplay" maxLength={80} />
            </Field>
            <Field label="Depoimento" name="text">
              <textarea name="text" rows={3} maxLength={800} />
            </Field>
            <Field label="Data da autorização" name="authorizedAt">
              <input type="date" name="authorizedAt" />
            </Field>
            <label className="check">
              <input type="checkbox" name="published" /> Publicar no site
            </label>
            <div>
              <SubmitButton>Salvar depoimento</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </section>
      <section className="stack">
        <h2 style={{ fontSize: '1.1rem' }}>Perguntas frequentes</h2>
        {faqs.map((f) => (
          <details key={f.id} className="disclosure">
            <summary>
              {f.question}
              {!f.published && ' (oculta)'}
            </summary>
            <div className="stack">
              <ActionForm action={saveFaq} className="stack">
                <input type="hidden" name="id" value={f.id} />
                <Field label="Pergunta" name="question">
                  <input name="question" defaultValue={f.question} />
                </Field>
                <Field label="Resposta" name="answer">
                  <textarea name="answer" rows={3} defaultValue={f.answer} />
                </Field>
                <div className="row">
                  <Field label="Ordem" name="sort">
                    <input name="sort" inputMode="numeric" defaultValue={f.sort} style={{ width: 90 }} />
                  </Field>
                  <label className="check" style={{ alignSelf: 'flex-end' }}>
                    <input type="checkbox" name="published" defaultChecked={f.published} /> Publicada
                  </label>
                </div>
                <div>
                  <SubmitButton className="btn btn--sm btn--primary">Salvar</SubmitButton>
                </div>
              </ActionForm>
              <form action={deleteFaq.bind(null, f.id)}>
                <button className="btn btn--danger btn--sm" type="submit">
                  Excluir
                </button>
              </form>
            </div>
          </details>
        ))}
        <div className="card">
          <h3>Nova pergunta</h3>
          <ActionForm action={saveFaq} className="stack" resetOnSuccess>
            <Field label="Pergunta" name="question">
              <input name="question" />
            </Field>
            <Field label="Resposta" name="answer">
              <textarea name="answer" rows={3} />
            </Field>
            <input type="hidden" name="sort" value={faqs.length + 1} />
            <input type="hidden" name="published" value="on" />
            <div>
              <SubmitButton>Adicionar</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </section>
    </div>
  )
}

async function TeamSection({ tz }: { tz: string }) {
  const team = await db
    .select()
    .from(schema.users)
    .where(and(inArray(schema.users.role, ['admin', 'staff'])))
    .orderBy(asc(schema.users.role), asc(schema.users.name))
  const perms = Object.entries(STAFF_PERMISSIONS)
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <p className="alert alert--info small">
        O nutricionista (administrador) tem acesso total. Membros da equipe veem apenas as áreas liberadas abaixo. Dados clínicos devem ser liberados somente a
        profissionais que participam do atendimento e estão sujeitos a sigilo.
      </p>
      {team.map((u) => (
        <section key={u.id} className="card">
          <div className="row row--between">
            <div>
              <strong>{u.name}</strong> <span className="muted">· {u.email}</span>
              <div className="small muted">
                {u.role === 'admin' ? 'Administrador' : 'Equipe'} · último acesso: {u.lastLoginAt ? fmtDateTime(u.lastLoginAt, tz) : 'nunca'}
              </div>
            </div>
            {!u.isActive && <span className="badge badge--plain">Desativado</span>}
          </div>
          {u.role === 'staff' && (
            <ActionForm action={updateStaff.bind(null, u.id)} className="stack" >
              <div className="choice-grid" style={{ marginTop: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {perms.map(([k, label]) => (
                  <label key={k} className="check">
                    <input type="checkbox" name="permissions" value={k} defaultChecked={u.permissions.includes(k)} /> {label}
                  </label>
                ))}
              </div>
              <label className="check">
                <input type="checkbox" name="isActive" defaultChecked={u.isActive} /> Acesso ativo
              </label>
              <label className="check">
                <input type="checkbox" name="ownPatientsOnly" defaultChecked={u.ownPatientsOnly} /> Nutricionista: vê só os próprios pacientes (ficha, planos, diário, chat, acompanhamento e agenda)
              </label>
              <div>
                <SubmitButton className="btn btn--sm btn--primary">Salvar permissões</SubmitButton>
              </div>
            </ActionForm>
          )}
        </section>
      ))}
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Convidar membro da equipe</h2>
        <ActionForm action={inviteStaff} className="stack" resetOnSuccess>
          <div className="form-grid">
            <Field label="Nome" name="name">
              <input name="name" />
            </Field>
            <Field label="E-mail" name="email">
              <input name="email" type="email" />
            </Field>
          </div>
          <fieldset>
            <legend>Permissões</legend>
            <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {perms.map(([k, label]) => (
                <label key={k} className="check">
                  <input type="checkbox" name="permissions" value={k} defaultChecked={k === 'agenda'} /> {label}
                </label>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" name="ownPatientsOnly" /> Nutricionista: vê só os próprios pacientes
            </label>
          </fieldset>
          <div>
            <SubmitButton>Gerar convite</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  )
}

function IntegrationsSection() {
  const st = integrationStatus()
  const rows: [string, boolean, string][] = [
    ['Banco de dados PostgreSQL', Boolean(process.env.DATABASE_URL), process.env.DATABASE_URL ? 'Conectado via DATABASE_URL.' : 'Usando banco embutido de desenvolvimento (PGlite). Em produção, configure DATABASE_URL.'],
    ['E-mail transacional (Resend)', st.email, st.email ? 'Confirmações, convites e redefinição de senha são enviados por e-mail.' : 'Não configurado: nenhum e-mail é enviado. Defina RESEND_API_KEY e EMAIL_FROM.'],
    ['Tarefa agendada (lembretes)', st.cron, st.cron ? 'Rota /api/cron protegida por CRON_SECRET. Chame a cada 5 minutos (lembretes de refeição, água e consultas).' : 'Não configurada. Defina CRON_SECRET e agende /api/cron a cada 5 minutos.'],
    ['Notificações push', st.push, st.push ? (process.env.VAPID_PUBLIC_KEY ? 'Chaves VAPID configuradas.' : 'Usando chaves locais de desenvolvimento. Em produção, defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT (npx web-push generate-vapid-keys).') : 'Não configurado. Defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT.'],
    ['WhatsApp (envio automático)', st.whatsappApi, 'Não implementado. Hoje o sistema abre conversas no WhatsApp com a mensagem pronta (envio manual).'],
    ['Pagamentos on-line', st.payments, 'Não implementado. O financeiro registra lançamentos internos.'],
    ['Videoconferência', st.video, 'Não integrado. Cole o link da sala (Meet, Zoom, Jitsi) na consulta on-line.'],
  ]
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Integração</th>
            <th>Situação</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, ok, text]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{ok ? <span className="badge badge--ok">Ativa</span> : <span className="badge badge--warn">Não configurada</span>}</td>
              <td className="small">{text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

