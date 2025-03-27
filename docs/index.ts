import cpy from 'cpy'
import frontMatter from 'front-matter'
import FS, { promises as fs } from 'fs'
import handlebarsPkg from 'handlebars'
import hljs from 'highlight.js'
import { marked } from 'marked'
import { join } from 'path'

const { compile } = handlebarsPkg
const __dirname = import.meta.dirname

interface BuildConfig {
  outputPath: string
}
interface Page {
  body: string
  description: string
  filename: string
  title: string
  url: string
}
interface SiteData {
  pages: Page[]
}

function isString(x: any): x is string {
  return typeof x === 'string'
}

let templateCache: { [index: string]: HandlebarsTemplateDelegate } = {}
async function getTemplate(name: string): Promise<HandlebarsTemplateDelegate> {
  if (!templateCache[name]) {
    const source = await fs.readFile(join(__dirname, name), 'utf-8')
    const template = compile(source)

    templateCache[name] = template
  }

  return templateCache[name]
}

async function createPage(
  page: Page,
  siteData: SiteData,
  buildConfig: BuildConfig
): Promise<void> {
  console.log(`Generating ${page.title}.`)

  const template = await getTemplate('page.hbs')

  const styles = await fs.readFile(join(__dirname, 'styles.css'), 'utf-8')

  const data = {
    analyticsId: process.env['GOOGLE_ANALYTICS'] || '',
    content: page.body,
    description: page.description,
    pages: siteData.pages,
    title: `${page.title} - Esix`,
    styles
  }

  const html = template(data)
  const outputPath = join(buildConfig.outputPath, page.filename)

  await fs.writeFile(outputPath, html)
}

async function copyPublicFiles(outputPath: string): Promise<void> {
  await cpy([join(__dirname, 'public', '*')], outputPath)
  await cpy([join(__dirname, 'public', 'images')], join(outputPath, 'images'))
}

async function loadSiteData(): Promise<SiteData> {
  const data = await fs.readFile(join(__dirname, 'sidebar.json'), 'utf-8')
  const config = JSON.parse(data)

  marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: function (code, language) {
      const validLanguage = hljs.getLanguage(language) ? language : 'ts'

      return hljs.highlight(validLanguage, code).value
    },
    pedantic: false,
    gfm: true,
    breaks: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    xhtml: false
  })

  const pages = await Promise.all<Page>(
    config.links.map(async (filenameOrObject: any): Promise<Page> => {
      const filename: string = isString(filenameOrObject)
        ? filenameOrObject
        : filenameOrObject.filename
      const newFilename = filename.replace('.md', '.html')
      const url = isString(filenameOrObject)
        ? `/${newFilename}`
        : filenameOrObject.path

      const path = join(__dirname, 'pages', filename)
      const file = await fs.readFile(path, 'utf-8')
      const content = frontMatter(file)

      const attributes = content.attributes as any

      return {
        body: marked(content.body),
        description:
          attributes.description || 'Esix is a slick ORM for MongoDB.',
        filename: newFilename,
        title: attributes.title,
        url: url
      }
    })
  )

  return {
    pages
  }
}

async function generateSitemap(
  siteData: SiteData,
  buildConfig: BuildConfig
): Promise<void> {
  console.log(`Generating Sitemap.`)

  const template = await getTemplate('sitemap.hbs')

  const d = Date.now()
  const ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d)
  const mo = new Intl.DateTimeFormat('en', { month: 'short' }).format(d)
  const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d)

  const modifiedAt = `${da}-${mo}-${ye}`

  const html = template({
    urls: siteData.pages.map((page) => ({
      modifiedAt,
      url: `https://esix.netlify.app${page.url}`
    }))
  })
  const outputPath = join(buildConfig.outputPath, 'sitemap.xml')

  await fs.writeFile(outputPath, html)
}

;(async () => {
  const siteData = await loadSiteData()

  const buildConfig = {
    outputPath: join(__dirname, 'dist')
  }

  if (!FS.existsSync(buildConfig.outputPath)) {
    await fs.mkdir(buildConfig.outputPath)
  }

  await Promise.all(
    siteData.pages.map((page) => createPage(page, siteData, buildConfig))
  )

  await copyPublicFiles(buildConfig.outputPath)

  await generateSitemap(siteData, buildConfig)
})()
