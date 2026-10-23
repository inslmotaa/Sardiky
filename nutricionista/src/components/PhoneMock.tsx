/** Ilustração do app no celular (conteúdo de exemplo, só visual). */
export function PhoneMock() {
  return (
    <div className="phone-mock" aria-hidden>
      <div className="phone-mock__notch" />
      <div className="phone-mock__screen">
        <span className="phone-mock__eyebrow">Agora · 16h</span>
        <strong className="phone-mock__title">Lanche da tarde</strong>
        <ul>
          <li>
            <i className="phone-mock__dot" data-tone="1" />
            <span>Banana prata</span>
            <em>1 unidade</em>
          </li>
          <li>
            <i className="phone-mock__dot" data-tone="2" />
            <span>Morangos</span>
            <em>10 unidades</em>
          </li>
          <li>
            <i className="phone-mock__dot" data-tone="3" />
            <span>Iogurte natural</span>
            <em>1 pote</em>
          </li>
        </ul>
        <span className="phone-mock__btn">Marcar como feita</span>
        <div className="phone-mock__water">
          <span>Água</span>
          <div className="phone-mock__cups">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} data-full={i < 5} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
