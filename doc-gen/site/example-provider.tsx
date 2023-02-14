import React, { ReactElement, createContext } from 'react'

import { Example } from '../../example-lib/index.js'

type ExampleContextProps = {
  getExample: (name: string) => Example | undefined
}

export const ExampleContext = createContext<ExampleContextProps>({} as ExampleContextProps)

type ExampleProviderProps = {
  children: ReactElement
  examples: Example[]
}

export function ExampleProvider({ children, examples }: ExampleProviderProps): ReactElement {
  const getExample = (name: string): Example | undefined => examples.find(example => example.name === name)

  const context = {
    getExample
  }

  return (
    <ExampleContext.Provider value={ context }>
      { children }
    </ExampleContext.Provider>
  )
}
