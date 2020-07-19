import frontMatter from 'front-matter';
import FS, { promises as fs } from 'fs';
import { compile } from 'handlebars';
import hljs from 'highlight.js';
import marked from 'marked';
import { join } from 'path';

interface BuildConfig {
  outputPath: string;
}
interface Page {
  body: string;
  description: string;
  filename: string;
  title: string;
  url: string;
}
interface SiteData {
  pages: Page[];
}

function isString(x: any): x is string {
  return typeof x === "string";
}

let templateCache: HandlebarsTemplateDelegate;
async function getTemplate(): Promise<HandlebarsTemplateDelegate> {
  if (templateCache) {
    return templateCache;
  }

  const source = await fs.readFile(join(__dirname, 'page-template.hbs'), 'utf-8');
  const template = compile(source);

  templateCache = template;

  return templateCache;
}

async function createPage(page: Page, siteData: SiteData, buildConfig: BuildConfig): Promise<void> {
  console.log(`Generating ${ page.title }.`);

  const template = await getTemplate();

  const styles = await fs.readFile(join(__dirname, 'styles.css'), 'utf-8');

  const data = {
    analyticsId: process.env['GOOGLE_ANALYTICS'] || '',
    content: page.body,
    description: page.description,
    pages: siteData.pages,
    title: `${ page.title } - Esix`,
    styles
  };

  const html = template(data);
  const outputPath = join(buildConfig.outputPath, page.filename);

  await fs.writeFile(outputPath, html);
}

async function loadSiteData(): Promise<SiteData> {
  const data = await fs.readFile(join(__dirname, 'sidebar.json'), 'utf-8');
  const config = JSON.parse(data);

  marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: function(code, language) {
      const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';

      return hljs.highlight(validLanguage, code).value;
    },
    pedantic: false,
    gfm: true,
    breaks: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    xhtml: false
  });

  const pages = await Promise.all<Page>(
    config.links.map(async(filenameOrObject: any): Promise<Page> => {
      const filename: string = isString(filenameOrObject) ? filenameOrObject : filenameOrObject.filename;
      const newFilename = filename.replace('.md', '.html');
      const url = isString(filenameOrObject) ? `/${newFilename}` : filenameOrObject.path;

      const path = join(__dirname, 'pages', filename);
      const file = await fs.readFile(path, 'utf-8');
      const content = frontMatter(file);

      const attributes = content.attributes as any;

      return {
        body: marked(content.body),
        description: attributes.description || 'Esix is a slick ORM for MongoDB.',
        filename: newFilename,
        title: attributes.title,
        url: url
      };
    })
  );

  return {
    pages
  };
}

(async () => {
  const siteData = await loadSiteData();

  const buildConfig = {
    outputPath: join(__dirname, 'dist')
  };

  if (!FS.existsSync(buildConfig.outputPath)) {
    await fs.mkdir(buildConfig.outputPath);
  }

  await Promise.all(
    siteData.pages.map(page => createPage(page, siteData, buildConfig))
  );
})();
