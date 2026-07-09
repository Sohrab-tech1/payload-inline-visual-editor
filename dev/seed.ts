import type { Payload } from 'payload'

const richText = (text: string) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text, version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
})

export const seed = async (payload: Payload): Promise<void> => {
  const { totalDocs } = await payload.count({ collection: 'users' })
  if (totalDocs > 0) {
    return
  }

  await payload.create({
    collection: 'users',
    data: { email: 'dev@payloadcms.com', password: 'test' },
  })

  await payload.create({
    collection: 'users',
    data: { email: 'viewer@payloadcms.com', password: 'test' },
  })

  await payload.create({
    collection: 'pages',
    data: {
      _status: 'published',
      layout: [
        {
          blockType: 'hero',
          heading: 'Visual editing for Payload',
          subheading: 'Hover, click, edit — right on the page.',
        },
        {
          blockType: 'content',
          body: richText(
            'This playground exercises the inline visual editor plugin. Open this page through Live Preview in the admin panel.',
          ),
        },
        {
          blockType: 'section',
          columns: [
            { content: [{ blockType: 'content', body: richText('Column one — nested blocks exercise schema-path derivation.') }] },
            { content: [{ blockType: 'cta', label: 'Read the spec', url: '/admin' }] },
          ],
          heading: 'Nested content',
        },
        { blockType: 'cta', label: 'Get started', url: '/admin' },
      ],
      slug: 'home',
      title: 'Home',
    },
  })

  await payload.updateGlobal({
    slug: 'header',
    data: {
      navItems: [
        { label: 'Client mode', url: '/client-mode/home' },
        { label: 'SSR mode', url: '/ssr-mode/home' },
      ],
    },
  })

  payload.logger.info(
    'Seeded dev user (dev@payloadcms.com / test), read-only viewer (viewer@payloadcms.com / test), home page, and header global',
  )
}
