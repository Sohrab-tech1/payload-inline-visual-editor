import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { payloadEditable } from '@payload-inline-visual-editor/react'
import { RichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import type {
  ContentBlock,
  CtaBlock,
  HeaderData,
  HeroBlock,
  LayoutBlock,
  PageDoc,
  SectionBlock,
} from '../lib/types'

const Hero: React.FC<{ block: HeroBlock; path: string }> = ({ block, path }) => (
  <section style={{ padding: '4rem 2rem', textAlign: 'center' }}>
    <h1 {...payloadEditable(`${path}.heading`)}>{block.heading}</h1>
    {block.subheading ? (
      <p {...payloadEditable(`${path}.subheading`)} style={{ fontSize: '1.25rem', opacity: 0.7 }}>
        {block.subheading}
      </p>
    ) : null}
  </section>
)

const Content: React.FC<{ block: ContentBlock; path: string }> = ({ block, path }) => (
  <section {...payloadEditable(`${path}.body`)} style={{ margin: '0 auto', maxWidth: '40rem', padding: '1rem 2rem' }}>
    {block.body ? <RichText data={block.body as SerializedEditorState} /> : null}
  </section>
)

const Cta: React.FC<{ block: CtaBlock; path: string }> = ({ block, path }) => (
  <section style={{ padding: '2rem', textAlign: 'center' }}>
    <a
      href={block.url}
      {...payloadEditable(`${path}.label`)}
      style={{
        background: '#111',
        borderRadius: '0.5rem',
        color: '#fff',
        display: 'inline-block',
        padding: '0.75rem 1.5rem',
        textDecoration: 'none',
      }}
    >
      {block.label}
    </a>
  </section>
)

const Section: React.FC<{ block: SectionBlock; path: string }> = ({ block, path }) => (
  <section style={{ margin: '0 auto', maxWidth: '60rem', padding: '2rem' }}>
    {block.heading ? <h2 {...payloadEditable(`${path}.heading`)}>{block.heading}</h2> : null}
    <div
      {...payloadEditable.container(`${path}.columns`)}
      style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))' }}
    >
      {block.columns?.map((column, columnIndex) => {
        const columnPath = `${path}.columns.${columnIndex}`
        return (
          <div key={column.id ?? columnIndex} {...payloadEditable(columnPath, { row: { id: column.id ?? '' } })}>
            <div {...payloadEditable.container(`${columnPath}.content`)}>
              {column.content?.map((block, blockIndex) => (
                <BlockRenderer
                  block={block}
                  key={block.id ?? blockIndex}
                  path={`${columnPath}.content.${blockIndex}`}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  </section>
)

const BlockRenderer: React.FC<{ block: LayoutBlock; path: string }> = ({ block, path }) => {
  const row = { blockType: block.blockType, id: block.id ?? '' }
  switch (block.blockType) {
    case 'content':
      return (
        <div {...payloadEditable(path, { row })}>
          <Content block={block} path={path} />
        </div>
      )
    case 'cta':
      return (
        <div {...payloadEditable(path, { row })}>
          <Cta block={block} path={path} />
        </div>
      )
    case 'hero':
      return (
        <div {...payloadEditable(path, { row })}>
          <Hero block={block} path={path} />
        </div>
      )
    case 'section':
      return (
        <div {...payloadEditable(path, { row })}>
          <Section block={block} path={path} />
        </div>
      )
    default:
      return null
  }
}

export const RenderPage: React.FC<{ header: HeaderData; page: PageDoc }> = ({ header, page }) => (
  <>
    <header
      {...payloadEditable.scope({ global: 'header' })}
      style={{ borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'center', padding: '1rem' }}
    >
      <nav {...payloadEditable.container('navItems')} style={{ display: 'flex', gap: '1.5rem' }}>
        {header.navItems?.map((item, index) => (
          <a
            href={item.url}
            key={item.id ?? index}
            {...payloadEditable(`navItems.${index}`, { row: { id: item.id ?? '' } })}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            <span {...payloadEditable(`navItems.${index}.label`)}>{item.label}</span>
          </a>
        ))}
      </nav>
    </header>
    <main {...payloadEditable.scope({ collection: 'pages', id: String(page.id) })}>
      <div {...payloadEditable.container('layout')}>
        {page.layout?.map((block, index) => (
          <BlockRenderer block={block} key={block.id ?? index} path={`layout.${index}`} />
        ))}
      </div>
    </main>
  </>
)
