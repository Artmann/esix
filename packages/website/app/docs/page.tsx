import { Metadata } from 'next'

import { getDocBySlug } from '@/lib/docs'

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getDocBySlug('introduction')

  return {
    title: doc?.title ? `${doc.title} - Esix` : 'Documentation - Esix',
    description:
      doc?.description ||
      'Complete documentation for Esix, the type-safe MongoDB ORM with zero configuration.'
  }
}

export default async function DocsPage() {
  const doc = await getDocBySlug('introduction')

  if (!doc) {
    return <div className="space-y-8">Documentation not found.</div>
  }

  return (
    <div className="space-y-8">
      <div className="prose prose-invert max-w-none">
        <div dangerouslySetInnerHTML={{ __html: doc.content }} />
      </div>
    </div>
  )
}
