import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDocBySlug, getAllDocSlugs } from '@/lib/docs'

interface DocPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = getAllDocSlugs()
  return slugs.map((slug) => ({
    slug: slug
  }))
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params
  const doc = await getDocBySlug(slug)
  
  if (!doc) {
    return {
      title: 'Page Not Found'
    }
  }

  return {
    title: `${doc.title} - Esix Documentation`,
    description: doc.description || `Learn about ${doc.title} in the Esix ORM documentation.`
  }
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params
  const doc = await getDocBySlug(slug)

  if (!doc) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <div className="prose prose-invert max-w-none">
        <div dangerouslySetInnerHTML={{ __html: doc.content }} />
      </div>
    </div>
  )
}
