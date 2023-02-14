import React, { ReactElement } from 'react'

import { Example } from '../../example-lib/index.js'
import { ExampleProvider } from './example-provider.js'

export interface PageLayoutProps {
  children: ReactElement
  examples: Example[]
  extraStyles: string[]
  title: string
}

export function PageLayout({ children, examples, extraStyles, title }: PageLayoutProps): ReactElement {
  return (
    <html lang='en'>
      <head>
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link rel='preconnect' href='https://fonts.gstatic.com' />

        <title>{ title }</title>

        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="description" content="Esix is the most productive way to interact with your Mongo Database in TypeScript. 🚀" />

        <link rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;900&family=Source+Code+Pro&display=swap' />
        <link rel='manifest' href='/manifest.webmanifest'/>
        <link rel='icon' href='/favicon-16x16.png'/>

        <style></style>
      </head>
      <body>
        <ExampleProvider examples={ examples }>
          { children }
        </ExampleProvider>

        {
          extraStyles.map((style, index) => (
            <style key={ index }>
              { style }
            </style>
          ))
        }
      </body>
    </html>
  )
}
