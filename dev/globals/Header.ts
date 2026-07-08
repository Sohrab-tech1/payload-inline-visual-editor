import type { GlobalConfig } from 'payload'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

export const Header: GlobalConfig = {
  slug: 'header',
  admin: {
    livePreview: {
      url: () => `${serverURL}/client-mode/home`,
    },
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
  ],
}
