import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { HeaderData, PostDoc } from '@/lib/types'

import { PostClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const [posts, header] = await Promise.all([
    payload.find({
      collection: 'posts',
      depth: 2,
      draft: true,
      limit: 1,
      where: { slug: { equals: slug } },
    }),
    payload.findGlobal({ slug: 'header', draft: true }),
  ])

  const post = posts.docs[0] as PostDoc | undefined
  if (!post) {
    notFound()
  }

  return <PostClient header={header as HeaderData} initialPost={post} />
}
