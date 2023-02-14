import hljs from 'highlight.js'
import lodash from 'lodash'
import React, { ReactElement, isValidElement, useMemo } from 'react'

type CodeProps = {
  children?: string | string[]
  code?: string
  lang?: string
}

export function Code({ children, code, lang }: CodeProps): ReactElement {
  const rawCode = useMemo(() => {
    if (code) {
      return code
    }

    const childTexts = childrenToText(children)

    return lodash.isArray(childTexts) ? childTexts.join('\n') : childTexts
  }, [ children, code ])

  console.log({ lang, rawCode })

  //@ts-ignore
  const html = hljs.highlight(rawCode, { language: lang ?? 'typescript' }).value + '\n'

  return (
    <pre>
      <code
        className='hljs language-ts'
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  )
}

const hasChildren = (element: any) => isValidElement(element) && Boolean((element?.props as any).children as any)

const childrenToText = (children: any): string => {
  if (hasChildren(children)) {
    return childrenToText(children.props.children)
  }

  return children
}
