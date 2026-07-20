import type { CollectionConfig } from 'payload'

import { layoutBlocks } from '../blocks'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

// The viewer account exercises permission gating end-to-end:
// it can open documents in the admin but cannot update them.
export const VIEWER_EMAIL = 'viewer@payloadcms.com'

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    update: ({ req }) => req.user?.email !== VIEWER_EMAIL,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      breakpoints: [
        { name: 'mobile', label: 'Mobile', width: 375, height: 667 },
        { name: 'tablet', label: 'Tablet', width: 768, height: 1024 },
        { name: 'desktop', label: 'Desktop', width: 1440, height: 900 },
      ],
      // Pages with an `ssr-` slug prefix preview through the RefreshRouteOnSave
      // route — exercises SSR-mode op latency/pending states
      url: ({ data }) =>
        `${serverURL}/${String(data?.slug ?? '').startsWith('ssr-') ? 'ssr-mode' : 'client-mode'}/${data?.slug ?? ''}`,
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
