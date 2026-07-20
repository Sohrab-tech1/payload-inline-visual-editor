import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'email',
  },
  fields: [
    { name: 'name', type: 'text' },
    { name: 'bio', type: 'textarea' },
  ],
}
