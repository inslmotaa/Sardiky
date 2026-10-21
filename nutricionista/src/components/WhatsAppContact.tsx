'use client'

import { useState } from 'react'
import { whatsappLink } from '@/lib/format'
import { IconWhatsApp } from './icons'

/**
 * Contato direto pelo WhatsApp: monta a mensagem no próprio navegador e abre a conversa.
 * Nada do que é digitado aqui é enviado ao servidor do site.
 */
export function WhatsAppContact({ phone, interests }: { phone: string; interests: string[] }) {
  const [name, setName] = useState('')
  const [interest, setInterest] = useState('')
  const [message, setMessage] = useState('')
  const text = [
    `Olá! Vim pelo site${name.trim() ? ` e meu nome é ${name.trim()}` : ''}.`,
    interest ? `Tenho interesse em: ${interest}.` : 'Gostaria de mais informações sobre o acompanhamento.',
    message.trim(),
  ]
    .filter(Boolean)
    .join(' ')
  const href = whatsappLink(phone, text)!
  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="wa-name">Seu nome</label>
        <input id="wa-name" type="text" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="wa-interest">Interesse</label>
        <select id="wa-interest" value={interest} onChange={(e) => setInterest(e.target.value)}>
          <option value="">Selecione (opcional)</option>
          {interests.map((i) => (
            <option key={i}>{i}</option>
          ))}
          <option>Outro assunto</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="wa-message">Mensagem</label>
        <textarea id="wa-message" maxLength={1000} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        <span className="field__hint">Não é necessário informar dados de saúde aqui.</span>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn--whatsapp btn--block">
        <IconWhatsApp /> Continuar no WhatsApp
      </a>
      <p className="muted small" style={{ margin: 0 }}>
        A conversa segue no WhatsApp. Nada do que você digitar aqui fica salvo no site.
      </p>
    </div>
  )
}
