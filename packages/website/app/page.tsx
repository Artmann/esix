'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'

import { Button } from '@/components/ui/button'

hljs.registerLanguage('typescript', typescript)

export default function Home() {
  const codeRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current)
    }
  }, [])

  return (
    <div className="w-full overflow-x-hidden p-6">
      <section className="w-full max-w-4xl mx-auto text-center py-16 md:py-24 lg:py-48">
        <div className="flex flex-col gap-6 md:gap-8">
          <h1 className="mb-8 font-black text-balance text-2xl md:text-6xl text-white">
            <span className="text-pink-500">The MongoDB ORM</span>
            <br />
            <span>that feels like magic</span>
          </h1>

          <div className="w-full flex flex-col gap-4 text-center text-base md:text-lg max-w-lg mx-auto">
            <div className="text-white font-semibold">
              Zero configuration. Full type safety. Pure elegance.
            </div>

            <div className="text-neutral-400">
              Stop wrestling with verbose drivers and complex ORMs. Esix brings
              the beloved simplicity of ActiveRecord to MongoDB with complete
              TypeScript support. Just extend BaseModel, and get automatic type
              inference, fluent queries, and seamless database operations—no
              setup, no boilerplate, no compromises.
            </div>
          </div>

          <div className="mx-auto py-8">
            <Button
              asChild
              className="bg-pink-700 text-white hover:bg-pink-800 focus:ring-pink-700 focus:ring-offset-pink-100"
            >
              <Link
                href="/docs/getting-started"
                className="w-full"
              >
                Get Started
              </Link>
            </Button>
          </div>

          <div className="w-full mx-auto max-w-2xl prose prose-invert text-left py-8 px-4">
            <pre className="overflow-x-auto whitespace-pre max-w-full !bg-transparent !p-0">
              <code
                ref={codeRef}
                className="language-typescript block whitespace-pre min-w-full"
              >
                {`class User extends BaseModel {
  name = ''
  email = ''
  age = 0
}

const user = await User.create({ name: 'John', email: 'john@example.com' })

const activeUsers = await User.where('isActive', true).get()
`}
              </code>
            </pre>
          </div>
        </div>
      </section>
    </div>
  )
}
