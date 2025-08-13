import { ReactNode } from 'react'

interface MoreSectionProps {
  title: string
  children: ReactNode
}

export default function MoreSection({ title, children }: MoreSectionProps) {
  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase font-semibold text-gray-500 mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{children}</div>
    </section>
  )
}

