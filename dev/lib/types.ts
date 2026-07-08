export type MediaDoc = {
  alt?: null | string
  id: number | string
  url?: null | string
}

export type HeroBlock = {
  blockType: 'hero'
  heading: string
  id?: null | string
  image?: MediaDoc | null | number | string
  subheading?: null | string
}

export type ContentBlock = {
  blockType: 'content'
  body?: unknown
  id?: null | string
}

export type CtaBlock = {
  blockType: 'cta'
  id?: null | string
  label: string
  url: string
}

export type SectionColumn = {
  content?: (ContentBlock | CtaBlock)[] | null
  id?: null | string
}

export type SectionBlock = {
  blockType: 'section'
  columns?: null | SectionColumn[]
  heading?: null | string
  id?: null | string
}

export type LayoutBlock = ContentBlock | CtaBlock | HeroBlock | SectionBlock

export type PageDoc = {
  id: number | string
  layout?: LayoutBlock[] | null
  slug: string
  title: string
}

export type HeaderData = {
  navItems?: { id?: null | string; label: string; url: string }[] | null
}
