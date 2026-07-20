import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const Media: CollectionConfig = {
  slug: 'media',
  // Pages render through the Local API (access control bypassed), but the browser
  // pulls files over REST — without this every <img> 403s for anonymous visitors.
  access: { read: () => true },
  admin: { defaultColumns: ['filename', 'alt', 'updatedAt'] },
  fields: [
    { name: 'alt', type: 'text', required: true },
    { name: 'caption', type: 'text' },
  ],
  upload: {
    focalPoint: true,
    imageSizes: [
      { name: 'thumbnail', height: 300, position: 'centre', width: 400 },
      { name: 'card', height: 600, position: 'centre', width: 900 },
      { name: 'feature', height: 900, position: 'centre', width: 1600 },
    ],
    mimeTypes: ['image/*'],
    staticDir: path.resolve(dirname, '../media'),
  },
}
