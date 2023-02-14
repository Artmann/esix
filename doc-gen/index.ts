import { compile } from '@mdx-js/mdx'
import fs from 'fs'
import matter from 'gray-matter'
import { basename, join } from 'path'
import process from 'process'
import { createElement } from 'react'
import * as ReactDOMServer from 'react-dom/server'
import rehypeHighlight from 'rehype-highlight'
import remarkFrontmatter from 'remark-frontmatter'
import rimraf from 'rimraf'
import { ServerStyleSheet } from 'styled-components'

import { PageLayout } from './site/index.js'
import { Page } from './site/page.js'
import { loadExamples } from '../example-lib/index.js'

export async function build(inputPath: string): Promise<void> {
  const basePath = join(process.cwd(), inputPath)
  const cachePath = join(process.cwd(), '.cache')

  const pages = await loadPages(join(basePath, 'pages'))

  const examples = await loadExamples(join(basePath, 'examples'))

  const outputPath = join(basePath, 'dist')

  // if (fs.existsSync(outputPath)){
  //   rimraf.sync(outputPath)
  // }

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath)
  }

  if (!fs.existsSync(join(outputPath, 'public'))) {
    fs.mkdirSync(join(outputPath, 'public'))
  }

  if (!fs.existsSync(cachePath)){
    fs.mkdirSync(cachePath)
  }

  const highlightStyles = await fs.promises.readFile(join(basePath, '..', 'node_modules', 'highlight.js', 'styles', 'github-dark.css'), 'utf-8')

  for (const page of pages) {
    const slug = basename(page.filename, '.mdx')
    const path = join(outputPath, `${ slug }.html`)

    console.log(`Creating page: ${ slug }`)

    if (!page.title) {
      console.log('Missing Title.')

      return
    }

    const content = await fs.promises.readFile(page.path, 'utf-8')

    const js = await compile(content, {
      remarkPlugins: [
        remarkFrontmatter
      ],
      rehypePlugins: [
        // rehypeHighlight
      ]
    })

    const jsPath = join(cachePath, `${ slug }.js`)

    await fs.promises.writeFile(jsPath, js.value, 'utf-8')

    // @ts-ignore
    const { default: mdxComponent } = await import(`../.cache/${ slug }.js`)

    const contentElement = createElement(mdxComponent, {})

    const sheet = new ServerStyleSheet()

    const pageElement = createElement(Page, {
      children: contentElement,
      slug,
      title: page.title
    })

    const layoutElement = createElement(PageLayout, {
      children: pageElement,
      examples,
      extraStyles: [
        highlightStyles
      ],
      title: `${ page.title } - Esix`
    })

    let markup = ReactDOMServer.renderToStaticMarkup(sheet.collectStyles(layoutElement))

    const styleTags = sheet.getStyleTags()

    markup = markup.replace('<style></style>', styleTags)

    markup = '<!DOCTYPE html>\n' + markup

    await fs.promises.writeFile(path, markup, 'utf-8')
  }

}

type PageInfo = {
  filename: string
  path: string

  title?: string
  description?: string
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

    const document = matter(content)

    return {
      description: document.data.description,
      filename,
      path,
      title: document.data.title
    }
  } catch (error) {
    console.error('Failed to load Page Info.', path)
    console.error(error)
  }

  return undefined
}
