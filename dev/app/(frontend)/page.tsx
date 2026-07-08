import Link from 'next/link'
import React from 'react'

export default function IndexPage() {
  return (
    <main style={{ margin: '0 auto', maxWidth: '40rem', padding: '4rem 2rem' }}>
      <h1>Payload inline visual editor — dev playground</h1>
      <ul style={{ lineHeight: 2 }}>
        <li>
          <Link href="/client-mode/home">/client-mode/home</Link> — useLivePreview (recommended editing mode)
        </li>
        <li>
          <Link href="/ssr-mode/home">/ssr-mode/home</Link> — RefreshRouteOnSave
        </li>
        <li>
          <Link href="/admin">/admin</Link> — dev@payloadcms.com / test
        </li>
      </ul>
    </main>
  )
}
