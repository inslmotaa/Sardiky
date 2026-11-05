// Efeitos do site público na prévia em arquivo único (o mesmo código do site publicado).
import { initSiteFx } from '../../src/lib/site-fx'

initSiteFx(document)

// "Voltar ao topo" do site (na prévia, sem React no site: liga o botão aqui).
const toTop = document.querySelector<HTMLButtonElement>('#view-site .back-to-top, .back-to-top')
if (toTop) {
  let last = window.scrollY
  const set = (show: boolean) => {
    if (show) toTop.setAttribute('data-show', 'true')
    else toTop.removeAttribute('data-show')
    toTop.tabIndex = show ? 0 : -1
    toTop.toggleAttribute('aria-hidden', !show)
  }
  // Mesmo comportamento do sistema: depois de 1,5 tela, só aparece ao subir a página.
  const on = () => {
    const y = window.scrollY
    const far = y > window.innerHeight * 1.5 && !document.getElementById('view-site')?.hidden
    if (!far) set(false)
    else if (y < last - 2) set(true)
    else if (y > last + 2) set(false)
    last = y
  }
  window.addEventListener('scroll', on, { passive: true })
  toTop.addEventListener('click', () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  })
}
