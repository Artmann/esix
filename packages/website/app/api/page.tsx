'use client'

import { useEffect } from 'react'

export default function ApiDocsPage() {
  useEffect(() => {
    // Redirect to the actual TypeDoc index.html file
    window.location.href = '/api/index.html'
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-neutral-400">Redirecting to API documentation...</p>
      </div>
    </div>
  )
}