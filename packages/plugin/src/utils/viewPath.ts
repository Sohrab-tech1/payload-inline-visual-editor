export type ViewTarget = { collectionSlug: string; id: number | string } | { globalSlug: string }

/**
 * Expands the configured view path template for a document. Globals replace
 * the `/:collectionSlug/:id` tail with `/globals/:globalSlug` — the view RSC
 * disambiguates on the `globals` segment.
 */
export const buildViewPath = (template: string, target: ViewTarget): `/${string}` =>
  ('globalSlug' in target
    ? template.replace(':collectionSlug', 'globals').replace(':id', target.globalSlug)
    : template.replace(':collectionSlug', target.collectionSlug).replace(':id', String(target.id))) as `/${string}`

/** The trailing `[entity, id]` pair of a matched view URL (`globals` marks a global). */
export const parseViewSegments = (
  segments: string[],
): null | { collectionSlug: string; id: string } | { globalSlug: string } => {
  const [entity, id] = segments.slice(-2)
  if (!entity || !id) {
    return null
  }
  return entity === 'globals' ? { globalSlug: id } : { collectionSlug: entity, id }
}
