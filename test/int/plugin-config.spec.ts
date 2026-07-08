import type { Config } from 'payload'

import { visualEditor } from 'payload-inline-visual-editor'
import { describe, expect, it } from 'vitest'

const CONTROLLER_PATH = 'payload-inline-visual-editor/client#VisualEditorController'

const baseConfig = (): Config =>
  ({
    collections: [
      {
        slug: 'pages',
        admin: { livePreview: { url: 'http://localhost:3000/home' } },
        fields: [],
      },
      { slug: 'posts', fields: [] },
    ],
    globals: [
      {
        slug: 'header',
        admin: { livePreview: { url: 'http://localhost:3000/home' } },
        fields: [],
      },
      { slug: 'footer', fields: [] },
    ],
    secret: 'test',
  }) as unknown as Config

type AnyEntity = {
  admin?: {
    components?: {
      edit?: { beforeDocumentControls?: unknown[] }
      elements?: { beforeDocumentControls?: unknown[] }
    }
    livePreview?: { url?: unknown }
  }
  slug: string
}

const controlsOf = (entity: AnyEntity, kind: 'edit' | 'elements') =>
  entity.admin?.components?.[kind]?.beforeDocumentControls as
    | { clientProps?: Record<string, unknown>; path: string }[]
    | undefined

describe('visualEditor config mutation', () => {
  it('injects the controller for entities with a Live Preview URL (inferred mode)', () => {
    const result = visualEditor()(baseConfig())
    const [pages, posts] = result.collections as unknown as AnyEntity[]
    const [header, footer] = result.globals as unknown as AnyEntity[]

    expect(controlsOf(pages, 'edit')).toEqual([expect.objectContaining({ path: CONTROLLER_PATH })])
    expect(controlsOf(posts, 'edit')).toBeUndefined()
    expect(controlsOf(header, 'elements')).toEqual([expect.objectContaining({ path: CONTROLLER_PATH })])
    expect(controlsOf(footer, 'elements')).toBeUndefined()
  })

  it('passes entity options through clientProps', () => {
    const result = visualEditor({
      collections: { pages: { blockOps: { move: false } } },
      debug: true,
    })(baseConfig())
    const [pages] = result.collections as unknown as AnyEntity[]

    expect(controlsOf(pages, 'edit')?.[0]?.clientProps).toEqual({
      blockOps: { move: false },
      debug: true,
    })
  })

  it('throws an actionable error when an enabled entity has no Live Preview URL', () => {
    expect(() => visualEditor({ collections: { posts: true } })(baseConfig())).toThrow(
      /posts.*Live Preview URL/s,
    )
  })

  it('injects a plugin-provided URL into the entity Live Preview config', () => {
    const url = 'http://localhost:3000/posts/preview'
    const result = visualEditor({ collections: { posts: { url } } })(baseConfig())
    const posts = (result.collections as unknown as AnyEntity[])[1]

    expect(posts.admin?.livePreview?.url).toBe(url)
    expect(controlsOf(posts, 'edit')).toEqual([expect.objectContaining({ path: CONTROLLER_PATH })])
  })

  it('respects root-level admin.livePreview entity lists', () => {
    const config = baseConfig()
    ;(config as { admin?: unknown }).admin = {
      livePreview: { collections: ['posts'], url: 'http://localhost:3000/home' },
    }
    const result = visualEditor()(config)
    const posts = (result.collections as unknown as AnyEntity[])[1]

    expect(controlsOf(posts, 'edit')).toEqual([expect.objectContaining({ path: CONTROLLER_PATH })])
  })

  it('leaves untouched entities untouched', () => {
    const config = baseConfig()
    const result = visualEditor()(config)
    const posts = (result.collections as unknown as AnyEntity[])[1]

    expect(posts.admin?.components).toBeUndefined()
  })
})
