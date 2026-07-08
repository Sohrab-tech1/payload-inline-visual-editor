import type { CollectionConfig } from 'payload'

import { layoutBlocks } from '../blocks'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      breakpoints: [
        { name: 'mobile', label: 'Mobile', width: 375, height: 667 },
        { name: 'tablet', label: 'Tablet', width: 768, height: 1024 },
        { name: 'desktop', label: 'Desktop', width: 1440, height: 900 },
      ],
      url: ({ data }) => `${serverURL}/client-mode/${data?.slug ?? ''}`,
    },
    useAsTitle: 'title',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', index: true, required: true, unique: true },
    { name: 'layout', type: 'blocks', blocks: layoutBlocks },
  ],
  versions: {
    drafts: {
      autosave: { interval: 800 },
    },
  },
}
