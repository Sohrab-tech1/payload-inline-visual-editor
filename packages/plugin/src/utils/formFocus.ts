/**
 * Admin-form DOM targeting for click-to-edit (SPEC §9, verified on 3.85):
 * field inputs/wrappers carry `id="field-${path.replace(/\./g, '__')}"`;
 * Lexical rich-text wrappers carry `data-field-path="${path}"`. Row paths
 * (`layout.0`) have no own id — the first `field-layout__0__*` descendant
 * stands in.
 */

const FIELD_ID_PREFIX = 'field-'

/** Data paths are dot-joined names/indexes; reject anything else before it reaches a selector. */
export const isValidDataPath = (path: string): boolean => /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(path)

export const fieldElementId = (path: string): string => `${FIELD_ID_PREFIX}${path.replace(/\./g, '__')}`

export const findFieldElement = (doc: Document, path: string): Element | null => {
  if (!isValidDataPath(path)) {
    return null
  }
  return (
    doc.getElementById(fieldElementId(path)) ??
    doc.querySelector(`[data-field-path="${path}"]`) ??
    doc.querySelector(`[id^="${fieldElementId(path)}__"]`)
  )
}

/** Reverse of the id/attribute conventions above, walking up from a focused/hovered node. */
export const pathFromFormElement = (start: Element): null | string => {
  for (let element: Element | null = start; element; element = element.parentElement) {
    const attrPath = element.getAttribute('data-field-path')
    if (attrPath) {
      return attrPath
    }
    if (element.id.startsWith(FIELD_ID_PREFIX)) {
      return element.id.slice(FIELD_ID_PREFIX.length).replace(/__/g, '.')
    }
  }
  return null
}

export type RowLike = {
  collapsed?: boolean
}

export type RowExpansion<R extends RowLike = RowLike> = {
  path: string
  updatedRows: R[]
}

/**
 * SET_ROW_COLLAPSED payloads that expand every collapsed ancestor row of a
 * data path (`layout.0.columns.1.heading` → rows `layout[0]`,
 * `layout.0.columns[1]`). Dispatching these does not touch collapse
 * preferences or form modified state — the expansion is transient by design.
 */
export const collectRowExpansions = <R extends RowLike>(
  fields: Record<string, { rows?: R[] } | undefined>,
  path: string,
): RowExpansion<R>[] => {
  const segments = path.split('.')
  const expansions: RowExpansion<R>[] = []
  for (let i = 1; i < segments.length; i++) {
    if (!/^\d+$/.test(segments[i]!)) {
      continue
    }
    const containerPath = segments.slice(0, i).join('.')
    const rowIndex = Number(segments[i])
    const rows = fields[containerPath]?.rows
    if (rows?.[rowIndex]?.collapsed) {
      expansions.push({
        path: containerPath,
        updatedRows: rows.map((row, index) => (index === rowIndex ? ({ ...row, collapsed: false } as R) : row)),
      })
    }
  }
  return expansions
}

/**
 * SET_ROW_COLLAPSED payloads that isolate a data path in the fields panel
 * ("show in layout"): in every ancestor container along the path, the path's
 * own row is expanded and all sibling rows collapse. Like the expansions
 * above, dispatching these is transient — no collapse preferences, no form
 * modified state.
 */
export const collectRowIsolation = <R extends RowLike>(
  fields: Record<string, { rows?: R[] } | undefined>,
  path: string,
): RowExpansion<R>[] => {
  const segments = path.split('.')
  const isolations: RowExpansion<R>[] = []
  for (let i = 1; i < segments.length; i++) {
    if (!/^\d+$/.test(segments[i]!)) {
      continue
    }
    const containerPath = segments.slice(0, i).join('.')
    const rowIndex = Number(segments[i])
    const rows = fields[containerPath]?.rows
    if (!rows?.length) {
      continue
    }
    if (rows.some((row, index) => Boolean(row.collapsed) !== (index !== rowIndex))) {
      isolations.push({
        path: containerPath,
        updatedRows: rows.map((row, index) => ({ ...row, collapsed: index !== rowIndex }) as R),
      })
    }
  }
  return isolations
}

const FOCUSABLE_SELECTOR = 'input:not([type="hidden"]), textarea, select, [contenteditable="true"]'

// Collapsed rows keep their fields mounted behind aria-hidden + inline
// display:none (Payload's AnimateHeight) — detect that without layout access.
const isDisplayed = (element: Element): boolean => {
  for (let el: Element | null = element; el; el = el.parentElement) {
    if (el instanceof HTMLElement && el.style.display === 'none') {
      return false
    }
    if (el.getAttribute('aria-hidden') === 'true') {
      return false
    }
  }
  return true
}

export const flashFormField = (element: Element): void => {
  if (typeof element.animate !== 'function') {
    return
  }
  // Payload's native blue/success accent (rgb(21,135,186)); matches the site
  // overlay highlight in packages/core (overlay/theme.ts).
  element.animate(
    [
      { boxShadow: '0 0 0 2px rgba(21, 135, 186, 0.9), 0 0 0 6px rgba(21, 135, 186, 0.25)' },
      { boxShadow: '0 0 0 2px rgba(21, 135, 186, 0), 0 0 0 6px rgba(21, 135, 186, 0)' },
    ],
    { duration: 1200, easing: 'ease-out' },
  )
}

export type FocusFormFieldArgs = {
  doc?: Document
  path: string
  pollIntervalMs?: number
  /** Aborts the poll loop when it returns false (e.g. a newer select superseded this one). */
  shouldContinue?: () => boolean
  timeoutMs?: number
}

const scrollIntoView = (element: Element): void => {
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const scrollToNearestAncestor = (doc: Document, path: string): void => {
  const segments = path.split('.')
  for (let length = segments.length - 1; length > 0; length--) {
    const ancestor = findFieldElement(doc, segments.slice(0, length).join('.'))
    if (ancestor) {
      scrollIntoView(ancestor)
      return
    }
  }
}

/**
 * Scroll/focus/flash the admin form field for a data path. Polls until the
 * target renders — ancestor rows may have just been expanded and Payload
 * lazy-renders off-screen rows, so scrolling the nearest existing ancestor
 * into view is part of making the target appear.
 */
export const focusFormField = async ({
  doc = document,
  path,
  pollIntervalMs = 100,
  shouldContinue,
  timeoutMs = 3000,
}: FocusFormFieldArgs): Promise<Element | null> => {
  const deadline = Date.now() + timeoutMs
  let scrolledAncestor = false

  while (shouldContinue?.() !== false) {
    const element = findFieldElement(doc, path)
    if (element && isDisplayed(element)) {
      const wrapper = element.closest('.field-type') ?? element
      scrollIntoView(wrapper)
      const focusable = element.matches(FOCUSABLE_SELECTOR)
        ? element
        : (wrapper.querySelector(FOCUSABLE_SELECTOR) ?? undefined)
      if (focusable instanceof HTMLElement) {
        focusable.focus({ preventScroll: true })
      }
      flashFormField(wrapper)
      return element
    }
    if (!scrolledAncestor) {
      scrolledAncestor = true
      scrollToNearestAncestor(doc, path)
    }
    if (Date.now() >= deadline) {
      return null
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
  return null
}
