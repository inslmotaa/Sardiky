import Link from 'next/link'
import { IconLeaf } from './icons'

export function Brand({
  name,
  sub,
  logoFileId,
  href = '/',
}: {
  name: string
  sub?: string | null
  logoFileId?: string | null
  href?: string
}) {
  return (
    <Link href={href} className="brand" aria-label={`${name}, página inicial`}>
      {logoFileId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="brand__logo" src={`/arquivos/${logoFileId}`} alt="" />
      ) : (
        <span className="brand__mark">
          <IconLeaf />
        </span>
      )}
      <span className="brand__name">
        {name}
        {sub && <span className="brand__sub">{sub}</span>}
      </span>
    </Link>
  )
}
