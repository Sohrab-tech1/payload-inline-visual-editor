type Child = { [k: string]: unknown; type: string; version: number }

const BLOCK = { direction: null, format: '' as const, indent: 0, version: 1 }

const text = (value: string, format = 0): Child => ({
  type: 'text',
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text: value,
  version: 1,
})

export const bold = (value: string): Child => text(value, 1)
export const italic = (value: string): Child => text(value, 2)

const inline = (parts: (Child | string)[]): Child[] =>
  parts.map((part) => (typeof part === 'string' ? text(part) : part))

export const p = (...parts: (Child | string)[]): Child => ({
  type: 'paragraph',
  children: inline(parts),
  textFormat: 0,
  ...BLOCK,
})

export const h = (tag: 'h2' | 'h3', ...parts: (Child | string)[]): Child => ({
  type: 'heading',
  children: inline(parts),
  tag,
  ...BLOCK,
})

export const quote = (...parts: (Child | string)[]): Child => ({
  type: 'quote',
  children: inline(parts),
  ...BLOCK,
})

export const ul = (items: string[]): Child => ({
  type: 'list',
  children: items.map((item, index) => ({
    type: 'listitem',
    children: [text(item)],
    value: index + 1,
    ...BLOCK,
  })),
  listType: 'bullet',
  start: 1,
  tag: 'ul',
  ...BLOCK,
})

export const richText = (...children: (Child | string)[]) => ({
  root: {
    type: 'root',
    children: children.map((child) => (typeof child === 'string' ? p(child) : child)),
    ...BLOCK,
  },
})
