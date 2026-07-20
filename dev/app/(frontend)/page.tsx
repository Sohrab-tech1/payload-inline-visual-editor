import config from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

export const dynamic = 'force-dynamic'

export default async function IndexPage() {
  const payload = await getPayload({ config })
  const [pages, posts] = await Promise.all([
    payload.find({ collection: 'pages', depth: 0, limit: 50, sort: 'slug' }),
    payload.find({ collection: 'posts', depth: 0, limit: 50, sort: '-publishedAt' }),
  ])

  return (
    <main style={{ margin: '0 auto', maxWidth: '44rem', padding: '4rem 2rem' }}>
      <h1>Payload inline visual editor — dev playground</h1>

      <h2>Pages</h2>
      <ul style={{ lineHeight: 2 }}>
        {pages.docs.map((page) => {
          const slug = String(page.slug)
          const href = slug.startsWith('ssr-') ? `/ssr-mode/${slug}` : `/client-mode/${slug}`
          return (
            <li key={String(page.id)}>
              <Link href={href}>{href}</Link>
              {slug.startsWith('ssr-') ? ' — RefreshRouteOnSave' : ' — useLivePreview'}
            </li>
          )
        })}
      </ul>

      <h2>Posts</h2>
      <ul style={{ lineHeight: 2 }}>
        {posts.docs.map((post) => (
          <li key={String(post.id)}>
            <Link href={`/posts/${String(post.slug)}`}>/posts/{String(post.slug)}</Link> — {String(post.title)}
          </li>
        ))}
      </ul>

      <h2>Admin</h2>
      <ul style={{ lineHeight: 2 }}>
        <li>
          <Link href="/admin">/admin</Link> — dev@payloadcms.com / test (editor), viewer@payloadcms.com / test
          (read-only)
        </li>
      </ul>
    </main>
  )
}
