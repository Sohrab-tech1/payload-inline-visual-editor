import type { Block } from 'payload'

export const heroBlock: Block = {
  slug: 'hero',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'text' },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
}

export const contentBlock: Block = {
  slug: 'content',
  fields: [{ name: 'body', type: 'richText' }],
}

export const ctaBlock: Block = {
  slug: 'cta',
  fields: [
    { name: 'label', type: 'text', required: true },
    { name: 'url', type: 'text', required: true },
  ],
}

// Nested blocks-in-arrays-in-blocks: the fixture for schema-path derivation (SPEC §8, §12)
export const sectionBlock: Block = {
  slug: 'section',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'columns',
      type: 'array',
      fields: [{ name: 'content', type: 'blocks', blocks: [contentBlock, ctaBlock] }],
    },
  ],
}

export const layoutBlocks: Block[] = [heroBlock, contentBlock, ctaBlock, sectionBlock]
