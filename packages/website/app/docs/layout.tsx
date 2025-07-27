'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const sidebarLinks = [
  { title: 'Introduction', href: '/docs' },
  { title: 'Getting Started', href: '/docs/getting-started' },
  { title: 'Configuration', href: '/docs/configuration' },
  { title: 'Defining Models', href: '/docs/defining-models' },
  { title: 'Retrieving Models', href: '/docs/retrieving-models' },
  {
    title: 'Inserting and Updating',
    href: '/docs/inserting-and-updating-models'
  },
  { title: 'Deleting Models', href: '/docs/deleting-models' },
  { title: 'Pagination', href: '/docs/pagination' },
  { title: 'Testing', href: '/docs/testing' }
]

export default function DocsLayout({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="p-6">
      <div className="w-full relative">
        <nav className="fixed z-10 hidden lg:block">
          <ul className="text-sm font-medium">
            {sidebarLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <li key={link.href}>
                  <Link
                    className={cn(
                      'inline-block py-1.5 leading-5 hover:text-white',
                      isActive ? 'text-white' : 'text-neutral-400'
                    )}
                    href={link.href}
                  >
                    {link.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <article className="w-full max-w-3xl mx-auto">{children}</article>
      </div>
    </div>
  )
}
