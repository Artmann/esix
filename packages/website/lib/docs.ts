import fs from 'fs'
import matter from 'gray-matter'
import path from 'path'
import { remark } from 'remark'
import remarkRehype from 'remark-rehype'
import rehypeHighlight from 'rehype-highlight'
import rehypeStringify from 'rehype-stringify'

const docsDirectory = path.join(process.cwd(), 'content/docs')

export interface DocData {
  slug: string
  title: string
  description?: string
  content: string
}

export async function getDocBySlug(slug: string): Promise<DocData | null> {
  try {
    const fullPath = path.join(docsDirectory, `${slug}.md`)
    const fileContents = fs.readFileSync(fullPath, 'utf8')
    const { data, content } = matter(fileContents)

    const processedContent = await remark()
      .use(remarkRehype)
      .use(rehypeHighlight)
      .use(rehypeStringify)
      .process(content)

    return {
      slug,
      title: data.title || slug,
      description: data.description,
      content: processedContent.toString()
    }
  } catch (error) {
    return null
  }
}

export function getAllDocSlugs(): string[] {
  try {
    const fileNames = fs.readdirSync(docsDirectory)
    return fileNames
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.replace(/\.md$/, ''))
  } catch (error) {
    return []
  }
}
