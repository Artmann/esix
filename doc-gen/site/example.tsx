import React, { ReactElement, useContext } from 'react'
import { Code } from './code.js'

import { ExampleContext } from './example-provider.js'
import { Table } from './table.js'

interface ExampleProps {
  name: string
}

export function ExampleComponent({ name }: ExampleProps): ReactElement | null {
  const { getExample } = useContext(ExampleContext)

  const example = getExample(name)

  if (!example) {
    return null
  }

  const isNumber = (a: any): a is number => !isNaN(a)
  const isObject = (a: any): a is object => (typeof a === 'object' || typeof a === 'function') && (a !== null)
  const isString = (a: any): a is string => typeof a === 'string'

  const text = example.text || ''

  if (isNumber(example.output) || isString(example.output)) {
    return (
      <Code>
{ text }
{ `// => ${ example.output }` }
      </Code>
    )
  }

  // The Array check has to come before the Object one as an Array is also an Object.
  if (Array.isArray(example.output)) {
    return (
      <>
        <Code>
          { text }
        </Code>
        <Table rows={ example.output } type="array" />
      </>
    )
  }

  if (isObject(example.output)) {
    return (
      <>
        <Code code={ text } />
        <Table rows={ [ example.output ] } type="object" />
      </>
    )
  }

  return (
    <>
      <Code>
        { text }
      </Code>

      <Code>
        { JSON.stringify(example.output, null, 2) }
      </Code>
    </>
  )
}
