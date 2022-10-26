import frontMatter from 'front-matter'
import fs from 'fs'
import { join } from 'path'
import process from 'process'

export async function build(inputPath: string): Promise<void> {
  const basePath = join(process.cwd(), inputPath)

  const pages = await loadPages(join(basePath, 'pages'))

  console.log(pages)
}

type PageInfo = {
  filename: string
  path: string
}

async function loadPages(pagesPath: string): Promise<PageInfo[]> {
  const filenames = await fs.promises.readdir(pagesPath)

  const pageInfoList = await Promise.all(filenames.map(filename => {
    return loadPageInfo(
      filename,
      join(pagesPath, filename)
    )
  }))

  return pageInfoList.filter((pageInfo): pageInfo is PageInfo => pageInfo !== undefined)
}

async function loadPageInfo(filename: string, path: string): Promise<PageInfo | undefined> {
  try {
    const content = await fs.promises.readFile(path, 'utf-8')

    /**
    const x = await compile(content, {
      jsx: true,
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter]
    })
    **/

    const data = frontMatter(content)

    console.table(data)

    return {
      filename,
      path
    }
  } catch (error) {
    console.error('Failed to load Page Info.', path)
    console.error(error)
  }

  return undefined
}
