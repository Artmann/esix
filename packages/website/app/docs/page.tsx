import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Documentation - Esix',
  description:
    'Complete documentation for Esix, the type-safe MongoDB ORM with zero configuration.'
}

export default function DocsPage() {
  return <div className="space-y-8">Foo</div>
}
