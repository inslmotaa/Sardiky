// Efeitos do site público na prévia em arquivo único (o mesmo código do site publicado).
import { initSiteFx } from '../../src/lib/site-fx'

initSiteFx(document)

// "Voltar ao topo" do site (na prévia, sem React no site: liga o botão aqui).
const toTop = document.querySelector<HTMLButtonElement>('#view-site .back-to-top, .back-to-top')
if (toTop) {
  const on = () => {
    const show = window.scrollY > 480 && !document.getElementById('view-site')?.hidden
    if (show) toTop.setAttribute('data-show', 'true')
    else toTop.removeAttribute('data-show')
    toTop.tabIndex = show ? 0 : -1
  }
  on()
  window.addEventListener('scroll', on, { passive: true })
  toTop.addEventListener('click', () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  })
}
