import type { CollectionConfig, Config, GlobalConfig, LivePreviewConfig } from 'payload'

export type BlockOpsOptions = {
  add?: boolean
  duplicate?: boolean
  move?: boolean
  remove?: boolean
}

export type VisualEditorEntityOptions = {
  blockOps?: BlockOpsOptions | false
  url?: LivePreviewConfig['url']
}

export type VisualEditorOptions = {
  breakpoints?: 'inherit' | LivePreviewConfig['breakpoints']
  collections?: Record<string, true | VisualEditorEntityOptions>
  debug?: boolean
  globals?: Record<string, true | VisualEditorEntityOptions>
}

export type VisualEditorClientProps = {
  blockOps?: BlockOpsOptions | false
  debug?: boolean
}

const CONTROLLER_PATH = 'payload-inline-visual-editor/client#VisualEditorController'

type EntityKind = 'collections' | 'globals'

type Entity = CollectionConfig | GlobalConfig

const normalizeEntityOptions = (value: true | VisualEditorEntityOptions): VisualEditorEntityOptions =>
  value === true ? {} : value

const hasLivePreviewURL = (entity: Entity, config: Config, kind: EntityKind): boolean => {
  if (entity.admin?.livePreview?.url) {
    return true
  }
  const root = config.admin?.livePreview
  if (!root?.url) {
    return false
  }
  const slugs = kind === 'collections' ? root.collections : root.globals
  return Boolean(slugs?.includes(entity.slug))
}

const resolveEntityOptions = (
  explicit: Record<string, true | VisualEditorEntityOptions> | undefined,
  entity: Entity,
  config: Config,
  kind: EntityKind,
): null | VisualEditorEntityOptions => {
  if (explicit) {
    const value = explicit[entity.slug]
    if (!value) {
      return null
    }
    const entityOptions = normalizeEntityOptions(value)
    if (!entityOptions.url && !hasLivePreviewURL(entity, config, kind)) {
      const scope = kind === 'collections' ? 'Collection' : 'Global'
      throw new Error(
        `[payload-inline-visual-editor] ${scope} "${entity.slug}" is enabled for the visual editor but has no Live Preview URL. ` +
          `Set admin.livePreview.url on the ${scope.toLowerCase()} (or list it in config.admin.livePreview), ` +
          `or pass a url in visualEditor({ ${kind}: { ${entity.slug}: { url } } }).`,
      )
    }
    return entityOptions
  }
  return hasLivePreviewURL(entity, config, kind) ? {} : null
}

const withEntityLivePreview = <T extends Entity>(entity: T, url: LivePreviewConfig['url'] | undefined): T =>
  url
    ? {
        ...entity,
        admin: {
          ...entity.admin,
          livePreview: { ...entity.admin?.livePreview, url },
        },
      }
    : entity

const controllerComponent = (entityOptions: VisualEditorEntityOptions, pluginOptions: VisualEditorOptions) => ({
  clientProps: {
    blockOps: entityOptions.blockOps,
    debug: pluginOptions.debug,
  } satisfies VisualEditorClientProps,
  path: CONTROLLER_PATH,
})

/**
 * Enables the inline visual editor for collections/globals that have a Live
 * Preview URL (or are explicitly listed). Injects the controller inside the
 * document <Form> via edit.beforeDocumentControls (SPEC §3, §11).
 */
export const visualEditor =
  (pluginOptions: VisualEditorOptions = {}) =>
  (config: Config): Config => {
    const collections = (config.collections ?? []).map((collection) => {
      const entityOptions = resolveEntityOptions(pluginOptions.collections, collection, config, 'collections')
      if (!entityOptions) {
        return collection
      }
      const withUrl = withEntityLivePreview(collection, entityOptions.url)
      return {
        ...withUrl,
        admin: {
          ...withUrl.admin,
          components: {
            ...withUrl.admin?.components,
            edit: {
              ...withUrl.admin?.components?.edit,
              beforeDocumentControls: [
                ...(withUrl.admin?.components?.edit?.beforeDocumentControls ?? []),
                controllerComponent(entityOptions, pluginOptions),
              ],
            },
          },
        },
      }
    })

    const globals = (config.globals ?? []).map((global) => {
      const entityOptions = resolveEntityOptions(pluginOptions.globals, global, config, 'globals')
      if (!entityOptions) {
        return global
      }
      const withUrl = withEntityLivePreview(global, entityOptions.url)
      return {
        ...withUrl,
        admin: {
          ...withUrl.admin,
          components: {
            ...withUrl.admin?.components,
            elements: {
              ...withUrl.admin?.components?.elements,
              beforeDocumentControls: [
                ...(withUrl.admin?.components?.elements?.beforeDocumentControls ?? []),
                controllerComponent(entityOptions, pluginOptions),
              ],
            },
          },
        },
      }
    })

    return { ...config, collections, globals }
  }
