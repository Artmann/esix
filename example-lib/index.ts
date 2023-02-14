import fs from 'fs'
import lodash from 'lodash'
import { basename, resolve } from 'path'
import ts from 'typescript'
import { pathToFileURL } from 'url'

const { get } = lodash

export type Example = {
  code: () => Promise<any>
  dataset: Record<string, any[]>
  output: any
  name: string
  text: string
}

export async function loadExamples(examplesDirectoryPath: string): Promise<Example[]> {
  const files = await listFilesInDirectory(examplesDirectoryPath)

  const exampleFiles = files.filter(path => path.endsWith('.ts'))

  const promises = exampleFiles.map(loadExample)
  const examples = await Promise.all(promises)

  return examples
}

async function loadExample(path: string): Promise<Example> {
  const name = basename(path, '.ts')

  const source =  await fs.promises.readFile(path, 'utf8')

  const node = ts.createSourceFile(
    `${ name }.ts`,
   source,
    ts.ScriptTarget.Latest
  )

  const [ exportNode ] = findNodes(node, { kind: ts.SyntaxKind.ExportAssignment })
  const [ codeNode ] = findNodes(exportNode, {
    kind: ts.SyntaxKind.PropertyAssignment,
    'name.escapedText': 'code'
  })
  const [ functionNode ] = findNodes(codeNode, { kind: ts.SyntaxKind.ArrowFunction })

  const method = functionNode.getFullText(node)
  const code = method.slice(7)

  const url = pathToFileURL(path)

  const { default: config } = (await import(url.toString()))

  const example: Example = {
    code: config.code,
    dataset: config.dataset,
    output: config.output,
    name,
    text: code
  }

  return example
}

function findNodes(root: ts.Node, filter: Record<string, any> = {}, nodes: ts.Node[] = []): ts.Node[] {
  const matchesFilter = (n: ts.Node): boolean => {
    for (const [key, value] of Object.entries(filter)) {
      const v = get(n, key)

      if (v !== value) {
        return false
      }
    }

    return true
  }

  if (matchesFilter(root)) {
    return [
      ...nodes,
      root
    ]
  }

  let children: ts.Node[] = []

  root.forEachChild(child => {
    const c = findNodes(child, filter, nodes)

    children = [
      ...children,
      ...c
    ]
  })

  return [
    ...nodes,
    ...children
  ]
}

async function listFilesInDirectory(base: string, recursive = false): Promise<string[]> {
  const entries = await fs.promises.readdir(base, { withFileTypes: true })

  const files = await Promise.all(
    entries.map((entry: fs.Dirent): any => {
      const path = resolve(base, entry.name)

      if (!recursive) {
        return path
      }

      return entry.isDirectory() ? listFilesInDirectory(path) : path
    })
  )

  return files.flat()
}
