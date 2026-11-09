import { ImageResponse } from 'next/og'
import { getSettings } from '@/lib/settings'

/**
 * Imagem de compartilhamento (Open Graph e Twitter Card), 1200×630, na identidade verde:
 * aparece quando o link do site é enviado no WhatsApp, Instagram, Facebook ou X.
 */
export const OG_SIZE = { width: 1200, height: 630 }
/** Igual a DEFAULT_OG_IMAGE.alt (src/lib/seo.ts); literal aqui porque o Next lê "alt" do arquivo da imagem. */
export const OG_ALT = 'André Farion, Coach: alimentação, rotina e bem-estar, com atendimento on-line'

const HEX = /^#[0-9a-fA-F]{6}$/

export async function ogImage(opts: { title?: string; kicker?: string } = {}) {
  const s = await getSettings()
  const green = HEX.test(s.brandColor) ? s.brandColor : '#1f5e3b'
  const title = opts.title ?? 'Mais que dieta, um estilo de vida.'
  const kicker = opts.kicker ?? `${s.professionalTitle} · alimentação, rotina e bem-estar`.toUpperCase()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: `linear-gradient(135deg, ${green} 0%, #174a2e 100%)`,
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Anéis finos de fundo (sem ícones genéricos). */}
        <div style={{ position: 'absolute', right: -160, top: -160, width: 560, height: 560, borderRadius: 9999, border: '2px solid rgba(255,255,255,0.14)', display: 'flex' }} />
        <div style={{ position: 'absolute', right: -60, top: -60, width: 360, height: 360, borderRadius: 9999, border: '2px solid rgba(255,255,255,0.10)', display: 'flex' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 9999, background: '#ffffff', display: 'flex' }} />
          <div style={{ fontSize: 30, letterSpacing: 8, display: 'flex' }}>{s.siteName.toUpperCase()}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 980 }}>
          <div style={{ fontSize: 22, letterSpacing: 3, opacity: 0.85, display: 'flex' }}>{kicker}</div>
          <div style={{ fontSize: title.length > 60 ? 56 : 76, lineHeight: 1.06, letterSpacing: -1.5, maxWidth: title.length > 60 ? 1000 : 860, display: 'flex' }}>{title}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 26 }}>
          <div style={{ display: 'flex' }}>
            {s.professionalName} · {s.professionalTitle}
          </div>
          <div style={{ display: 'flex', padding: '10px 22px', borderRadius: 9999, border: '2px solid rgba(255,255,255,0.6)', fontSize: 22 }}>Atendimento on-line</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  )
}
