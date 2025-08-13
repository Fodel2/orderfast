import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'

interface MoreCardProps {
  title: string
  icon?: ReactNode
  description?: string
  href?: string
  onClick?: () => void
  index?: number
}

export default function MoreCard({ title, icon, description, href, onClick, index = 0 }: MoreCardProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const content = (
    <div
      className="rounded-xl shadow bg-white p-4 h-full hover:scale-[1.02] active:scale-95 transition-transform"
    >
      {icon && <div className="mb-2 text-gray-500">{icon}</div>}
      <h3 className="font-semibold mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
  )

  return (
    <div
      className={`opacity-0 translate-y-2 transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : ''}`}
      style={{ transitionDelay: `${index * 75}ms` }}
    >
      {href ? (
        <Link href={href} aria-label={title} className="block h-full" role="link">
          {content}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-label={title}
          className="block text-left w-full h-full"
          role="button"
        >
          {content}
        </button>
      )}
    </div>
  )
}

