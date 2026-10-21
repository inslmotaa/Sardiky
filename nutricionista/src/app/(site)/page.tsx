import Link from 'next/link'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { bookingLink, initials, money, whatsappLink } from '@/lib/format'
import { createLead } from '@/actions/public'
import { ActionForm, Field, FieldError, SubmitButton } from '@/components/form'
import { StoryIntro } from '@/components/StoryIntro'
import { BookingLink } from '@/components/BookingLink'
import { WhatsAppContact } from '@/components/WhatsAppContact'
import { IconCheck, IconClock, IconPin, IconVideo, IconWhatsApp } from '@/components/icons'

const MODALITY: Record<string, string> = { presencial: 'Presencial', online: 'On-line', ambos: 'Presencial ou on-line' }

export default async function HomePage() {
  const s = await getSettings()
  const [services, testimonials, faqs, packages] = await Promise.all([
    db
      .select()
      .from(schema.services)
      .where(and(eq(schema.services.active, true), eq(schema.services.isPublic, true)))
      .orderBy(asc(schema.services.sort)),
    // Só depoimentos com autorização registrada E marcados para publicação.
    db
      .select()
      .from(schema.testimonials)
      .where(and(eq(schema.testimonials.published, true), isNotNull(schema.testimonials.authorizedAt)))
      .orderBy(asc(schema.testimonials.sort)),
    db.select().from(schema.faqs).where(eq(schema.faqs.published, true)).orderBy(asc(schema.faqs.sort)),
    db.select().from(schema.packages).where(eq(schema.packages.active, true)).orderBy(asc(schema.packages.priceCents)),
  ])
  const wa = whatsappLink(s.whatsapp, 'Olá! Vim pelo site e gostaria de agendar uma consulta.')
  const booking = bookingLink(s)
  const viaWhatsapp = booking.external

  return (
    <>
      {/* --------------------- ABERTURA EM STORYTELLING --------------------- */}
      <StoryIntro name={s.professionalName} booking={booking} />

      {/* --------------------------- APRESENTAÇÃO --------------------------- */}
      <section className="hero" id="apresentacao">
        <div className="container hero__grid">
          <div>
            <span className="eyebrow">{s.professionalTitle}</span>
            <h2 className="display" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.8rem)' }}>Alimentação possível de seguir, com acompanhamento de perto.</h2>
            <p className="hero__lead">
              Sou {s.professionalName}. Construo com você um plano alimentar individualizado, que respeita sua rotina, suas
              preferências e seus objetivos — e ajusto a estratégia a cada consulta.
            </p>
            <div className="hero__actions">
              <BookingLink to={booking} className="btn btn--primary btn--lg">
                {viaWhatsapp && <IconWhatsApp />} Agendar consulta
              </BookingLink>
              {s.anamneseUrl && (
                <a href={s.anamneseUrl} className="btn btn--lg" target="_blank" rel="noopener noreferrer">
                  Preencher anamnese
                </a>
              )}
              {wa && !viaWhatsapp && (
                <a href={wa} className="btn btn--lg btn--ghost" target="_blank" rel="noopener noreferrer">
                  <IconWhatsApp /> Falar no WhatsApp
                </a>
              )}
            </div>
            <div className="hero__meta">
              {s.registry && <span>{s.registry}</span>}
              {s.modalityText && (
                <span>
                  <IconVideo /> {s.modalityText}
                </span>
              )}
            </div>
          </div>
          <div className="portrait">
            {s.photoFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/arquivos/${s.photoFileId}`} alt={`Foto de ${s.professionalName}`} />
            ) : (
              <div className="portrait__placeholder" aria-hidden>
                <div>
                  <div className="initials">{initials(s.professionalName)}</div>
                  <small className="muted">A foto profissional é enviada em Configurações</small>
                </div>
              </div>
            )}
            <div className="portrait__card">
              <strong>{s.professionalName}</strong>
              {s.specialties.slice(0, 2).join(' · ')}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ SOBRE ----------------------------- */}
      <section className="section section--alt" id="sobre">
        <div className="container grid-2" style={{ gap: 40 }}>
          <div>
            <span className="eyebrow">Sobre</span>
            <h2>Quem vai cuidar do seu acompanhamento</h2>
            <p>{s.bio}</p>
            {s.specialties.length > 0 && (
              <>
                <h3 style={{ marginTop: 24 }}>Especialidades e áreas de atendimento</h3>
                <ul className="chips">
                  {s.specialties.map((sp) => (
                    <li key={sp}>{sp}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div>
            <span className="eyebrow">Método de trabalho</span>
            <h2>Como eu trabalho</h2>
            {s.method && <p>{s.method}</p>}
            {s.differentials.length > 0 && (
              <ul className="checklist">
                {s.differentials.map((d) => (
                  <li key={d}>
                    <IconCheck /> {d}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------- SERVIÇOS ---------------------------- */}
      <section className="section" id="servicos">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Serviços</span>
            <h2>Formas de atendimento</h2>
            <p className="muted">
              {s.showPrices ? 'Valores e durações atualizados pelo próprio consultório.' : 'Valores informados no atendimento.'}{' '}
              {viaWhatsapp ? 'Agende pelo WhatsApp.' : 'Escolha o serviço ao agendar.'}
            </p>
          </div>
          <div className="grid-3">
            {services.map((svc) => (
              <article key={svc.id} className="card service-card">
                <h3 style={{ margin: 0 }}>{svc.name}</h3>
                <div className="service-card__meta">
                  <span className="row" style={{ gap: 4 }}>
                    <IconClock width={16} height={16} /> {svc.durationMinutes} min
                  </span>
                  <span>·</span>
                  <span>{MODALITY[svc.modality]}</span>
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {svc.description}
                </p>
                {s.showPrices && <div className="service-card__price">{svc.priceCents > 0 ? money(svc.priceCents) : 'Valor sob consulta'}</div>}
                <BookingLink
                  to={viaWhatsapp ? bookingLink(s, `Olá! Vim pelo site e gostaria de agendar: ${svc.name}.`) : { href: `/agendar?servico=${svc.id}`, external: false }}
                  className="btn btn--block"
                >
                  Agendar este serviço
                </BookingLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------- PLANOS DE ACOMPANHAMENTO ---------------------- */}
      {packages.length > 0 && (
        <section className="section section--alt" id="planos">
          <div className="container">
            <div className="section__head">
              <span className="eyebrow">Planos de acompanhamento</span>
              <h2>Acompanhamento contínuo, não uma consulta isolada</h2>
              <p className="muted">Todos os planos incluem o app do paciente com o plano alimentar, registro diário e mensagens.</p>
            </div>
            <div className="grid-3">
              {packages.map((pk, i) => (
                <article key={pk.id} className={`card service-card${i === 1 ? ' card--soft' : ''}`}>
                  {i === 1 && <span className="badge badge--brand" style={{ alignSelf: 'flex-start' }}>Mais escolhido</span>}
                  <h3 style={{ margin: 0 }}>{pk.name}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {pk.description}
                  </p>
                  <div className="service-card__meta">
                    <span>{pk.sessions} consultas</span>
                    <span>·</span>
                    <span>{pk.validityDays} dias de acompanhamento</span>
                  </div>
                  {s.showPrices && <div className="service-card__price">{money(pk.priceCents)}</div>}
                  <a
                    href={whatsappLink(s.whatsapp, `Olá! Tenho interesse no plano ${pk.name}.`) ?? '/agendar'}
                    className="btn btn--block btn--primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Quero este plano
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --------------------------- O APP DO PACIENTE --------------------------- */}
      <section className="section" id="app">
        <div className="container grid-2" style={{ gap: 40, alignItems: 'center' }}>
          <div>
            <span className="eyebrow">O app do paciente</span>
            <h2>Seu plano no celular, não preso na geladeira</h2>
            <p>Em até dois toques você sabe o que comer agora. E o acompanhamento continua entre as consultas.</p>
            <ul className="checklist">
              <li>
                <IconCheck /> Plano do dia por horário, com quantidades em gramas e medidas caseiras
              </li>
              <li>
                <IconCheck /> Botão “Trocar” com substituições já calculadas pelo nutricionista
              </li>
              <li>
                <IconCheck /> Registro das refeições, da água e do peso em segundos
              </li>
              <li>
                <IconCheck /> Gráficos de evolução, metas e mensagens com o nutricionista
              </li>
            </ul>
          </div>
          <div className="card" aria-hidden style={{ maxWidth: 380, justifySelf: 'center', width: '100%' }}>
            <span className="eyebrow">Agora</span>
            <h3 style={{ margin: '0 0 8px' }}>Lanche da tarde · 16h</h3>
            <ul className="list">
              <li className="row row--between">
                <span>Iogurte natural</span>
                <span className="muted">1 pote · 170 g</span>
              </li>
              <li className="row row--between">
                <span>Aveia em flocos</span>
                <span className="muted">1 colher de sopa · 15 g</span>
              </li>
              <li className="row row--between">
                <span>Banana prata</span>
                <span className="muted">1 unidade média · 60 g</span>
              </li>
            </ul>
            <span className="btn btn--primary btn--block" style={{ marginTop: 12 }}>
              Marcar como feita
            </span>
          </div>
        </div>
      </section>

      {/* -------------------------- COMO FUNCIONA ------------------------- */}
      {s.howItWorks.length > 0 && (
        <section className="section section--alt" id="como-funciona">
          <div className="container">
            <div className="section__head">
              <span className="eyebrow">Como funciona</span>
              <h2>O acompanhamento, passo a passo</h2>
            </div>
            <ol className="steps">
              {s.howItWorks.map((st) => (
                <li key={st.title}>
                  <h3>{st.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {st.text}
                  </p>
                </li>
              ))}
            </ol>
            <p className="muted small" style={{ marginTop: 20 }}>
              Os resultados variam de pessoa para pessoa e dependem de diversos fatores. Não prometemos resultados
              garantidos: trabalhamos com metas realistas e acompanhamento contínuo.
            </p>
          </div>
        </section>
      )}

      {/* --------------------------- DEPOIMENTOS -------------------------- */}
      {testimonials.length > 0 && (
        <section className="section" id="depoimentos">
          <div className="container">
            <div className="section__head">
              <span className="eyebrow">Depoimentos</span>
              <h2>O que dizem os pacientes</h2>
              <p className="muted small">Publicados com autorização. Experiências individuais não garantem resultados iguais.</p>
            </div>
            <div className="grid-3">
              {testimonials.map((t) => (
                <figure key={t.id} className="card quote">
                  <blockquote>“{t.text}”</blockquote>
                  <figcaption>{t.authorDisplay}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------ FAQ ------------------------------- */}
      {faqs.length > 0 && (
        <section className="section section--alt" id="duvidas">
          <div className="container" style={{ maxWidth: 860 }}>
            <div className="section__head">
              <span className="eyebrow">Perguntas frequentes</span>
              <h2>Dúvidas comuns</h2>
            </div>
            <div className="stack" style={{ ['--gap' as string]: '10px' }}>
              {faqs.map((f) => (
                <details key={f.id} className="disclosure">
                  <summary>{f.question}</summary>
                  <div>
                    <p style={{ margin: 0 }}>{f.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------- CONTATO ---------------------------- */}
      <section className="section" id="contato">
        <div className="container grid-2" style={{ gap: 40, alignItems: 'start' }}>
          <div>
            <span className="eyebrow">Contato</span>
            <h2>Vamos conversar?</h2>
            <p>
              {viaWhatsapp
                ? 'Agendamentos, valores e dúvidas são atendidos pelo WhatsApp.'
                : 'Agende diretamente pelo site, chame no WhatsApp ou deixe seus dados para retornarmos.'}
            </p>
            <ul className="checklist" style={{ margin: '20px 0' }}>
              {s.address && (
                <li>
                  <IconPin /> {s.address}
                </li>
              )}
              {s.hoursText && (
                <li>
                  <IconClock /> {s.hoursText}
                </li>
              )}
              {s.modalityText && (
                <li>
                  <IconVideo /> {s.modalityText}
                </li>
              )}
            </ul>
            <div className="row">
              <BookingLink to={booking} className="btn btn--primary">
                {viaWhatsapp ? (
                  <>
                    <IconWhatsApp /> Agendar pelo WhatsApp
                  </>
                ) : (
                  'Ver horários disponíveis'
                )}
              </BookingLink>
              {s.anamneseUrl && (
                <a href={s.anamneseUrl} className="btn" target="_blank" rel="noopener noreferrer">
                  Preencher anamnese
                </a>
              )}
              {wa && !viaWhatsapp && (
                <a href={wa} className="btn btn--whatsapp" target="_blank" rel="noopener noreferrer">
                  <IconWhatsApp /> WhatsApp
                </a>
              )}
            </div>
          </div>

          {viaWhatsapp && s.whatsapp ? (
            <div className="card">
              <h3>Mande uma mensagem</h3>
              <WhatsAppContact phone={s.whatsapp} interests={services.map((svc) => svc.name)} />
            </div>
          ) : (
          <div className="card">
            <h3>Quero ser contatado(a)</h3>
            <p className="muted small">Pedimos só o necessário para retornar o contato.</p>
            <ActionForm action={createLead} className="stack" resetOnSuccess>
              <Field label="Nome" name="name" required>
                <input name="name" autoComplete="name" maxLength={120} />
              </Field>
              <div className="form-grid">
                <Field label="Telefone / WhatsApp" name="phone" required>
                  <input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(11) 90000-0000" />
                </Field>
                <Field label="E-mail" name="email" hint="Opcional">
                  <input name="email" type="email" autoComplete="email" />
                </Field>
              </div>
              <Field label="Interesse" name="interest">
                <select name="interest" defaultValue="">
                  <option value="">Selecione (opcional)</option>
                  {services.map((svc) => (
                    <option key={svc.id}>{svc.name}</option>
                  ))}
                  <option>Outro assunto</option>
                </select>
              </Field>
              <Field label="Mensagem" name="message" hint="Não é necessário informar dados de saúde aqui.">
                <textarea name="message" maxLength={1500} rows={3} />
              </Field>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden />
              <label className="check">
                <input type="checkbox" name="consent" />
                <span>
                  Concordo com o uso destes dados para retorno do contato, conforme a{' '}
                  <Link href="/privacidade" target="_blank">
                    Política de Privacidade
                  </Link>
                  .
                </span>
              </label>
              <FieldError name="consent" />
              <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
            </ActionForm>
          </div>
          )}
        </div>
      </section>
    </>
  )
}
