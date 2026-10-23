/**
 * Nome no estilo do logo: primeira palavra preenchida, o resto só com contorno, e um traço que pisca.
 * Com data-fit, o site-fx ajusta o tamanho para ocupar exatamente a largura disponível.
 */
export function Wordmark({ name, as: Tag = 'span', className }: { name: string; as?: 'h1' | 'span'; className?: string }) {
  const [first, ...rest] = name.trim().toLocaleUpperCase('pt-BR').split(/\s+/)
  return (
    <Tag className={`wm${className ? ` ${className}` : ''}`} data-fit="">
      <span className="sr-only">{name}</span>
      <span className="wm__inner" aria-hidden>
        <span className="wm__line wm__solid">{first}</span>
        {rest.length > 0 && (
          <>
            {' '}
            <span className="wm__line wm__out">
              {rest.join(' ')}
              <span className="wm__cursor" />
            </span>
          </>
        )}
      </span>
    </Tag>
  )
}
