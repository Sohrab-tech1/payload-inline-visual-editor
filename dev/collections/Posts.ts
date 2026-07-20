import type { CollectionConfig } from 'payload'

import { postBlocks } from '../blocks'
import { VIEWER_EMAIL } from './Pages'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    update: ({ req }) => req.user?.email !== VIEWER_EMAIL,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'publishedAt', 'updatedAt'],
    livePreview: {
      breakpoints: [
        { name: 'mobile', label: 'Mobile', width: 375, height: 667 },
        { name: 'tablet', label: 'Tablet', width: 768, height: 1024 },
        { name: 'desktop', label: 'Desktop', width: 1440, height: 900 },
      ],
      url: ({ data }) => `${serverURL}/posts/${data?.slug ?? ''}`,
    },
    useAsTitle: 'title',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', index: true, required: true, unique: true },
    { name: 'excerpt', type: 'textarea' },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    {
      type: 'row',
      fields: [
        { name: 'author', type: 'relationship', admin: { width: '50%' }, relationTo: 'users' },
        {
          name: 'publishedAt',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayOnly' }, width: '50%' },
        },
      ],
    },
    { name: 'categories', type: 'relationship', hasMany: true, relationTo: 'categories' },
    { name: 'content', type: 'blocks', blocks: postBlocks },
  ],
  versions: {
    drafts: {
      autosave: { interval: 800 },
    },
  },
}
