# Payload Inline Visual Editor — Implementation Spec

An open-source plugin for Payload CMS 3.x that adds enterprise-style inline visual editing: browse your site, toggle edit mode, hover-highlight editable regions, click to edit any field with native Payload field UI, and add / duplicate / remove / drag-reorder blocks directly on the page.

Status: spec (pre-implementation) · Target: `payload@^3.85` · License: MIT (open source)

---

## 1. Context

Payload promotes a "Visual Editor" as an enterprise feature (https://payloadcms.com/enterprise/visual-editor), but as of July 2026 it is unreleased ("Coming Soon", demo-gated). Everything needed to build it exists in open-source Payload 3.x:

- **Live Preview** (core OSS): renders the frontend in an iframe inside the admin document edit view and streams form-state data to it via `postMessage` on every keystroke. It is strictly one-directional — there is no click-to-edit, no iframe→admin channel beyond a `ready` handshake. A repo-wide search confirms no hidden visual-editor code exists in core.
- **Form machinery**: the admin form exposes everything needed for block operations (`addFieldRow`, `moveFieldRow`, `removeFieldRow`, `DUPLICATE_ROW`) and per-field state keyed by data paths (`layout.0.title`).
- **Plugin surface**: plugins can inject components inside the document `<Form>`, add custom admin views, and add REST endpoints.

Nearest community prior art (`omaroubari/payloadcms-visual-editor`) is text-fields-only with no block reordering; `pemedia/payload-visual-editor` is Payload 2.x-only and predates core Live Preview. The gap this plugin fills: **full field-type coverage + block ops + permission gating, layered on core Live Preview.**

### Decisions made (with rationale)

| Decision | Choice |
|---|---|
| Editor shell | **Admin-hosted iframe** (extend Live Preview) — reuses auth, field components, form state, drafts, autosave. A frontend-hosted django-style toolbar is a possible later addition, not v1. |
| Edit UX | **Overlay + native Payload field editing** (click-to-edit focuses real field UI; block ops on overlay). No contenteditable inline editing in v1. |
| Site-side SDK | **Framework-agnostic vanilla-TS core + React/Next adapter** (mirrors `@payloadcms/live-preview` / `-react` split). |
| DOM→data mapping | **Explicit data attributes** via developer helpers (Directus/Storyblok-style). No stega string encoding in v1. |

---

## 2. Product definition

### Editor flow (v1 — inside the document edit view)

1. Editor opens a document in the admin; Live Preview mode shows the site in an iframe.
2. A new **"Edit on page"** toggle appears in the document controls bar. Enabling it activates the overlay in the iframe.
3. Hovering marked elements shows highlight rects + labels. Clicking a field region expands/scrolls/focuses the corresponding field in the admin form panel (Tina-style). Hovering/focusing a field in the form flashes the element on the page (reverse sync).
4. Block/array rows get a floating chip: **add above/below · duplicate · remove · drag handle**. Dragging reorders within the container with a drop indicator; empty containers show an "add" affordance. Adding a block opens Payload's native block picker.
5. All changes flow through the standard form → Live Preview data stream → the page re-renders live. Save/publish/autosave/versions/locales work exactly as in the normal edit view (audit trail for free).

### Editor flow (v2 — dedicated full-screen view)

`/admin/visual-editor/:collectionSlug/:id` — a bare custom admin view (no admin nav): full-bleed iframe, top toolbar (document title/status, save/publish, locale switcher, breakpoint selector, exit), and a floating field panel. Clicking a region opens a near-cursor popover editing just that field (same Form context). Clicking a region belonging to another document (e.g. a global header) opens it in a `DocumentDrawer`. Same protocol, SDK, and controller as v1 — only the host shell changes.

### Non-goals (v1)

- Contenteditable/in-place rich-text editing on the page (v3+ candidate at most).
- Moving blocks *between* different containers.
- Frontend-hosted editing without the admin panel.
- Visual style editing (spacing/colors) — this is a content editor, not a page builder.

---

## 3. Verified foundations in Payload 3.x

All paths relative to the payload repo root; verified against the `3.x` branch (3.85.x). Behavior is identical on `main` (4.0 beta) for everything listed — see §14 for version strategy.

### Render tree — where a plugin can reach the Form (the load-bearing fact)

```
RootLayout (packages/next/src/layouts/Root/index.tsx)
└─ RootProvider (ServerFunctions → Config → Auth → Locale → Theme → Modal → …)
   └─ admin.components.providers            ← ABOVE the document: NO Form/DocumentInfo access
      └─ DocumentView (packages/next/src/views/Document/index.tsx)
         └─ DocumentInfoProvider → LivePreviewProvider
            └─ DefaultEditView (packages/ui/src/views/Edit/index.tsx)
               └─ <Form>
                  ├─ DocumentControls (renders edit.beforeDocumentControls, editMenuItems…)
                  ├─ DocumentFields
                  └─ LivePreviewWindow (iframe; posts form values on every change)
```

Components registered at `collection.admin.components.edit.beforeDocumentControls` (and the globals equivalent) render **inside `<Form>`** — they can use `useForm()`, `useAllFormFields()`, `useDocumentInfo()` (incl. `docPermissions`), and `useLivePreviewContext()` (which exposes `iframeRef`, `url`, `appIsReady`, `isLivePreviewing`, `breakpoint`, `zoom`). This is the plugin's injection point. Root-level `admin.components.providers` sit above the document view and are the *wrong* place.

Fallback mount (also verified inside `<Form>`): the `views.edit.livePreview.Component` slot (`packages/next/src/views/Document/renderDocumentSlots.tsx`) can replace the Live Preview window; our component would render the exported `LivePreviewWindow` plus the controller. Keep as plan B.

### Live Preview message channel

- Admin→iframe on every form-state change: `{ type: 'payload-live-preview', data: reduceFieldsToValues(formState, true), collectionSlug, globalSlug, locale }` (`packages/ui/src/elements/LivePreview/Window/index.tsx`).
- Admin→iframe on save/autosave: `{ type: 'payload-document-event' }`.
- Iframe→admin: only `{ type: 'payload-live-preview', ready: true }` (`packages/live-preview/src/ready.ts`).
- Site SDK: `@payloadcms/live-preview` `subscribe`/`unsubscribe`/`ready`/`mergeData`; `mergeData` populates relationships by POSTing partial data to `/api/{slug}/{id}` with header `X-Payload-HTTP-Method-Override: GET` (`findByID` skips the DB and runs population on the passed data). React: `useLivePreview` (client mode) or `RefreshRouteOnSave` (SSR mode → `router.refresh()`).
- Handlers filter on exact `type` strings (`isLivePreviewEvent.ts` / `isDocumentEvent.ts`) — a new message namespace coexists safely.

### Form operations (packages/ui/src/forms/Form/types.ts + fieldReducer.ts)

- `addFieldRow({ path, schemaPath, blockType?, rowIndex?, subFieldState? })`
- `moveFieldRow({ moveFromIndex, moveToIndex, path })`
- `removeFieldRow({ path, rowIndex })`, `replaceFieldRow(…)`
- `dispatchFields({ type: 'DUPLICATE_ROW' | 'ADD_ROW' | 'MOVE_ROW' | 'REMOVE_ROW' | 'UPDATE' | … })`
- Rows carry a stable ObjectId-hex `id` + `blockType` in both form state (`rows: Row[]`) and document JSON — the reliable cross-frame row identifier.
- Field inputs in the admin carry `id="field-${path.replace(/\./g, '__')}"` (container fields put it on the wrapper div; Lexical rich text uses `data-field-path` instead; wrappers have no path class) — deterministic scroll/focus targeting.

### Other primitives we reuse

- `getFormState` ('form-state' server fn → `buildFormState`) — form-state rebuilds; `'render-field'` server fn renders a single field's server components on demand (the Lexical-blocks pattern; powers v2 popover).
- `useDocumentDrawer` / `DocumentDrawer` ('render-document' server fn) — full document editing in a drawer (used for cross-document and relationship editing).
- `BlocksDrawer` (`@payloadcms/ui`, props `{ addRow, addRowIndex, blocks, drawerSlug, labels }`) — the native block picker.
- Custom admin views: `admin.components.views.x = { Component: 'pkg/rsc#View', path: '/visual-editor/:collectionSlug/:id' }` — unmatched routes render **bare** (no nav template) inside `PageConfigProvider`, still under `RootProvider`; `path-to-regexp` params supported. Receives `initPageResult` (req, permissions, locale), `params`, `searchParams`, `importMap`.
- Plugins **cannot register server functions** (the generated app layout owns that map) — any custom server work goes through REST `endpoints` (`{ path, method, handler(req: PayloadRequest) => Response }` at root or collection level).
- Component registration: import-map strings `'my-pkg/client#Export'` (+ `clientProps`); consuming apps run `payload generate:importmap`.
- Draft infrastructure: `collection.versions.drafts` (+ `autosave.interval`), `PATCH ?draft=true&autosave=true`, preview-secret + Next `draftMode()` route pattern (see `templates/website/src/app/(frontend)/next/preview/route.ts` and `generatePreviewPath.ts`). Versions give the audit trail.
- Packaging: `templates/plugin` — SWC + tsc dual build, `.` / `./client` / `./rsc` export maps with `publishConfig` overrides, `dev/` Next playground, vitest + Playwright.
- `@payloadcms/admin-bar` — existing frontend bar pattern (checks `/api/users/me`, links to admin) for a later "Edit this page" affordance on the site.

---

## 4. Architecture overview

```
┌────────────────────────── Admin panel (parent frame) ──────────────────────────┐
│ Document edit view (v1) or dedicated Visual Editor view (v2)                   │
│                                                                                │
│  <Form>  ←── all editing happens here, with native Payload field components    │
│    ├─ VisualEditorController (injected via edit.beforeDocumentControls)        │
│    │    • "Edit on page" toggle in DocumentControls                            │
│    │    • bridge: postMessage ↔ iframe (protocol §6)                           │
│    │    • executes block ops via useForm()                                     │
│    │    • scroll/expand/focus fields on `select`                               │
│    │    • BlocksDrawer for add-block, confirm modal for remove                 │
│    │    • builds permission summary from useDocumentInfo().docPermissions      │
│    └─ LivePreviewWindow (stock, untouched — keeps streaming form data)         │
└──────────────────────────────┬─────────────────────────────────────────────────┘
                               │ postMessage (two protocols coexist)
                               │  • payload-live-preview (stock data stream)
                               │  • payload-visual-editor:* (our intent/metadata)
┌──────────────────────────────▼─────────────────────────────────────────────────┐
│ Site iframe (frontend, any framework)                                          │
│  @payload-inline-visual-editor/core (vanilla TS, zero deps)                    │
│    • bridge: handshake, origin validation, inert until valid `hello`           │
│    • scanner: finds data-pve-* attributes, builds region registry              │
│      (MutationObserver / ResizeObserver / scroll → rescan + rect refresh)      │
│    • overlay: single position:fixed pointer-events:none layer on body          │
│      highlight rects, labels, row chips, drag handling, drop indicators        │
│  @payload-inline-visual-editor/react: <VisualEditing/>, payloadEditable(),     │
│    recipes wrapping useLivePreview / RefreshRouteOnSave                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Key properties:

- **The stock Live Preview data pipeline is untouched.** The editor protocol carries *intent and metadata only*; document data continues to flow through `payload-live-preview` messages and `useLivePreview`/`RefreshRouteOnSave`.
- **The overlay renders inside the iframe** (site-side SDK), not admin-side. Live Preview scales the iframe with `transform: scale(zoom)` inside a DeviceContainer; in-iframe overlays inherit scaling and scrolling for free and keep all rect math local. The admin panel remains where actual editing happens.
- **The iframe is untrusted.** Messages can request operations; the admin form + Payload access control decide. Server-side access control revalidates everything on save regardless.

---

## 5. Repo & package structure

pnpm monorepo. Naming note: npm names `payload-visual-editor` (pemedia, 2.x) and `payloadcms-visual-editor` (omaroubari) are taken. Working names below use the repo name; a shorter brand can be decided before first publish.

```
payload-inline-visual-editor/
  packages/
    plugin/    → "payload-inline-visual-editor"            # the Payload plugin
      src/index.ts                 # visualEditor() config mutation (see §13)
      src/exports/client.ts        # VisualEditorController, toolbar, (v2) view components
      src/exports/rsc.ts           # (v2) VisualEditorView
      src/internal/payload-internals.ts   # single choke-point for @payloadcms/ui internals
    core/      → "@payload-inline-visual-editor/core"      # site SDK, vanilla TS, zero deps
      src/protocol.ts              # message types + constants + PROTOCOL_VERSION (shared;
                                   #   plugin package imports this — single source of truth)
      src/attrs.ts                 # pveAttr helpers + attribute parser
      src/scanner.ts               # region registry, observers
      src/overlay/                 # renderer, chips, drag, drop indicators
      src/bridge.ts                # handshake, origin validation, send/receive
    react/     → "@payload-inline-visual-editor/react"     # React/Next adapter
      src/VisualEditing.tsx        # mounts core; renders nothing in production
      src/payloadEditable.ts       # attribute helper (spreadable props)
  dev/                             # Next playground: pages collection (nested blocks layout),
                                   # header global, media; TWO frontend routes:
                                   # /client-mode (useLivePreview) and /ssr-mode (RefreshRouteOnSave)
  test/                            # vitest int tests; playwright e2e specs drive dev/
```

- Build: copied from `templates/plugin` — SWC transpile + `tsc --emitDeclarationOnly`, export maps `.` / `./client` / `./rsc` pointing at `./src/*.ts` in dev with `publishConfig.exports` → `./dist` on publish.
- Peer deps: plugin → `payload ^3.85`, `@payloadcms/ui ^3.85`, `react ^19`, `react-dom ^19`. core → none. react → `react ^19`.
- `sideEffects: ["*.css", "*.scss"]` on plugin; `false` on core/react.

---

## 6. postMessage protocol

Namespace `payload-visual-editor:*` — never collides with `payload-live-preview` / `payload-document-event` (their handlers filter on exact `type`).

```ts
type PveMessage<T extends string, P> = {
  type: `payload-visual-editor:${T}`
  version: 1            // PROTOCOL_VERSION; on mismatch degrade to read-only overlay + console warning
  sessionId: string     // random per iframe load; both sides drop messages from stale sessions
  payload: P
}
```

**Security invariants**
- Explicit `targetOrigin` both directions: origin of the resolved `livePreview.url` on the admin side; the configured `serverURL` on the site side. Never `'*'`.
- Admin additionally checks `event.source === iframeRef.current?.contentWindow`.
- The SDK is fully inert (no overlay, no listeners beyond the handshake) until a valid `hello` arrives from the allowed origin.

**Messages**

| Direction | `type` suffix | Payload |
|---|---|---|
| admin→iframe | `hello` | `{ editMode, docs: [{collection?, global?, id?}], locale, breakpoint, permissions: { canSave, canPublish, fields: {[path]: {update: boolean}} }, labels: {[blockSlug]: string}, blockOps?: {add, duplicate, move, remove} }` — sent on iframe ready/load; `blockOps` mirrors plugin config (omitted = all enabled) |
| iframe→admin | `hello-ack` | `{ sdkVersion, draft?: boolean }` — SDK begins scanning; `draft:false` triggers an admin warning banner |
| admin→iframe | `edit-mode` | `{ enabled }` |
| iframe→admin | `regions` | `{ regions: Region[] }` — debounced re-report after mutations; `Region = { regionId, scope, kind: 'field'\|'row'\|'container', path, rowId?, blockType? }` (no rects — overlay is in-iframe) |
| iframe→admin | `hover` / `select` | `{ regionId, path, scope }` — hover sync + click-to-edit |
| admin→iframe | `focus` | `{ path }` — admin-side field hover/focus → flash element on page |
| iframe→admin | `op` | `{ opId, op: 'add'\|'duplicate'\|'remove'\|'move', containerPath, scope, rowId?, rowIndex?, blockType?, moveFromIndex?, moveToIndex? }` |
| admin→iframe | `op-ack` | `{ opId, ok, error? }` |
| iframe→admin | `doc-switch-request` | `{ scope }` — user clicked a region of a different document (e.g. global header) |
| admin→iframe | `doc-status` | `{ isDirty, saving, publishedStatus }` — overlay status hints |
| admin→iframe | `locale` / `breakpoint` | mirror admin toolbar changes |

**Row-index race protection:** ops carry `rowId`; the admin resolves the *current* index from form-state `rows` by id before dispatching, falling back to the transmitted index. Ops referencing unknown ids get `op-ack { ok: false }`.

---

## 7. Data attribute schema & helper API

Directus-style, pure strings (RSC/SSR-safe). Paths are full data paths relative to the scope's document root, matching form-state paths (`layout.0.heading`).

| Attribute | Meaning | Example |
|---|---|---|
| `data-pve-scope` | document scope; nearest ancestor wins | `"collection:pages;id:665f…"`, `"global:header"` |
| `data-pve-field` | editable leaf field | `"layout.0.heading"` |
| `data-pve-field` + `data-pve-row` + `data-pve-block-type` | block/array row wrapper | `"layout.0"` + row ObjectId + `"hero"` |
| `data-pve-container` | array/blocks container (empty-state add button, drop zone bounds) | `"layout"` |

**Vanilla helpers** (`@payload-inline-visual-editor/core`): `pveAttr.scope(…)`, `pveAttr.field(path)`, `pveAttr.row(path, { id, blockType? })`, `pveAttr.container(path)` — each returns `Record<string, string>`.

**React helpers** (`@payload-inline-visual-editor/react`):

```tsx
payloadEditable('layout.0.heading')                          // → spreadable props
payloadEditable('layout.0', { row: { id, blockType } })
payloadEditable.scope({ collection: 'pages', id })
payloadEditable.container('layout')
configurePayloadEditable({ enabled })   // e.g. enabled: (await draftMode()).isEnabled
```

When `enabled` is false all helpers return `{}` → zero attributes in production HTML. Defense in depth: leaked attributes are inert anyway (SDK requires a validated handshake). The row helper *requires* `row.id`; a dev-mode console warning fires if a frontend transform dropped ids.

---

## 8. Block operations mechanics

Overlay = one `position: fixed; pointer-events: none` layer appended to `document.body` (site CSS never mutated). Hit-testing via `elementsFromPoint` + `closest('[data-pve-field],[data-pve-row]')`; rects from `getBoundingClientRect`, refreshed on scroll/resize/`ResizeObserver`/`MutationObserver`. Chips re-enable `pointer-events` locally.

- **Reorder:** HTML5 DnD can't cross frames, so the drag is overlay-driven: pointer-drag on the handle → drop index computed from sibling row rect midpoints (same container only) → drop-indicator line → `op { move, rowId, moveFromIndex, moveToIndex }` → admin `moveFieldRow` → synchronous local reducer → stock `LivePreviewWindow` effect posts fresh data → site re-renders → SDK rescans → overlay settles.
- **Add:** `op { add, containerPath, rowIndex }` → controller resolves the container field from the client config schema; blocks open `BlocksDrawer` (`addRow` → `addFieldRow({ path, rowIndex, schemaPath, blockType })`); plain arrays add directly. `schemaPath` derivation follows `packages/payload/src/fields/getFieldPaths.ts` conventions (int-tested against nested fixtures early).
- **Duplicate / remove:** `dispatchFields({ type: 'DUPLICATE_ROW', … })` / `removeFieldRow`, with an admin-side confirm modal for remove.

**Site-mode latency:**

| Mode | Behavior after an op | v1 stance |
|---|---|---|
| Client (`useLivePreview`) | Local reducer → new data posted immediately; latency ≈ re-render + population fetch | **Recommended editing mode**; docs and dev app lead with it |
| SSR (`RefreshRouteOnSave`) | Change appears after autosave → `router.refresh()` (1–3 s) | Supported: per-container pending shimmer until rescan; block ops require drafts+autosave in this mode. Optimistic FLIP-style DOM moves behind a flag (v2 candidate) |

---

## 9. Field editing flows

- **v1 — focus-in-form:** `select { path }` → controller expands collapsed ancestor rows, scrolls `#field-${path.replace(/\./g,'__')}` (or `[data-field-path]`) into view in `DocumentFields`, focuses the first focusable input, flashes a highlight. Reverse: form field hover/focus → `focus { path }` → SDK flashes the page element. Every field type — Lexical, uploads, relationships, custom plugin fields — gets native editing for free.
- **v2 — near-cursor popover:** admin-side popover (position translated through iframe zoom/DeviceContainer offset from `useLivePreviewContext().zoom`/`measuredDeviceSize`) rendering just the clicked field subtree via `RenderFields` bound to the **same** Form context; server-rendered custom field components fetched on demand via the `'render-field'` server function.
- **Cross-document & relationships:** clicking a region of another document (`doc-switch-request`) or "edit related doc" opens `useDocumentDrawer` for that entity; after drawer save, the stock `payload-document-event` triggers the site refresh path.

---

## 10. Permissions & safety

- Controller builds a paths-only permission summary from `useDocumentInfo().docPermissions.fields` + `hasSavePermission`/`hasPublishPermission` and ships it in `hello`; the SDK hides affordances for non-updatable paths. For large docs, send denied paths + a default.
- Field-level access control is therefore enforced twice: affordance-level (overlay) and authoritative (server on save).
- Edit mode can only be enabled from an authenticated admin session (the controller only exists inside the admin document view).
- Draft enforcement: the iframe URL should load draft content — reuse `admin.livePreview.url` pointing at a preview-secret + `draftMode()` route (the `templates/website` pattern). The SDK reports `draft: false` in `hello-ack` when its adapter knows draft mode is off → warning banner instead of enabled ops.
- Cross-origin deployments (site and admin on different origins): document the required `config.cors` origins + `config.csrf` origins + `credentials: 'include'` + `sameSite: 'None'` cookie settings. Same-origin single-Next-app is the default documented path.

---

## 11. Plugin config API

```ts
visualEditor({
  collections?: { [slug: string]: true | {
    url?: LivePreviewConfig['url'],       // override; default: entity's admin.livePreview.url
    blockOps?: false | { add?: boolean; duplicate?: boolean; remove?: boolean; move?: boolean },
  }},
  globals?: { [slug: string]: true | { … } },
  // default: inferred from config.admin.livePreview.collections/globals + per-entity admin.livePreview
  breakpoints?: 'inherit' | Breakpoint[],   // default 'inherit'
  toolbar?: { locale?: boolean; breakpoint?: boolean; exit?: boolean },   // v2 dedicated view
  view?: { enabled?: boolean; path?: string },  // v2; default '/visual-editor/:collectionSlug/:id'
  debug?: boolean,
})
```

Config mutation per enabled entity:
1. Validate a Live Preview URL exists (throw with an actionable message otherwise).
2. Inject `admin.components.edit.beforeDocumentControls` (collections) / the globals equivalent with `clientProps` carrying per-entity options.
3. (v2) Register the custom view + reserve REST endpoint namespace `/api/visual-editor/*` for anything not covered by built-in server functions.

The plugin follows the classic `(options) => (config) => config` shape (what `templates/plugin` uses), spread-based mutation, `onInit` chaining if needed.

---

## 12. Testing & verification

- **Unit/int (vitest):** config mutation output; attribute helpers + parser round-trip; protocol guards (origin, session, version); schema-path derivation against nested fixtures (blocks-in-blocks, arrays-in-blocks, localized fields); endpoint handlers.
- **E2E (Playwright, driving `dev/`):** using `frameLocator` on the Live Preview iframe — toggle edit mode; hover-highlight; select → admin field focused/scrolled; add (via BlocksDrawer) / duplicate / remove / drag-reorder reflected on page and in form state; permission-gated read-only user sees no affordances; both `/client-mode` and `/ssr-mode` routes; save → published document correct.
- **Version matrix (CI):** latest `3.x` stable + canary; all `@payloadcms/ui` internal imports isolated in `payload-internals.ts` so breakage surfaces in one file.
- **Manual verification loop:** `pnpm dev` in `dev/`, open `/admin`, edit the seeded page — the full editor flow end-to-end.

---

## 13. Milestones

| # | Milestone | Scope | Size |
|---|---|---|---|
| M0 | Scaffold | Monorepo, plugin-template port, dev app (pages + header global + media, both site modes), CI | S |
| M1 | Bridge spike | Controller injection, handshake + edit-mode toggle, SDK scanner + hover outlines; schema-path derivation validated on nested fixtures. **Exit: hover-highlight works inside admin Live Preview** | M |
| M2 | Click-to-edit | `select` → expand/scroll/focus form field; reverse `focus` flash; permission gating end-to-end | M |
| M3 | Block ops | Row chips, BlocksDrawer add flow, duplicate/remove, overlay drag-reorder + drop indicators, `op-ack`, SSR pending states | L |
| M4 | v1 release | `payloadEditable` ergonomics + prod stripping, docs (draft mode, CORS recipes), e2e hardening, npm publish v0.1, `payload-plugin` GitHub topic | M |
| M5 | v2 dedicated view | Bare `/admin/visual-editor/:collectionSlug/:id` via `render-document`, top toolbar (save/publish/status/locale/breakpoint/exit), doc-switch drawers | L |
| M6 | v2 popover editing | `RenderFields` popover on shared Form context, `render-field` for server components, upload/relationship drawer flows | L |

---

## 14. Risks

| Risk | L/I | Mitigation |
|---|---|---|
| Payload internals drift (form actions, `field-*` class, `BlocksDrawer` props, LivePreview context) 3.x→4 | High/Med | Pin `^3.85`; isolate internals in `payload-internals.ts`; CI matrix incl. canary. Note: 3.x and 4.0-beta already share the current Live Preview architecture (server-side population, no `fieldSchemaToJSON`), so the core design carries forward |
| `beforeDocumentControls` unsuitable in some layouts (drawer-rendered docs) | Med/Low | Verified plan-B mount: `views.edit.livePreview` slot wrapping exported `LivePreviewWindow` |
| SSR-mode reorder latency feels broken | High/Med | Recommend client mode for editing; pending shimmer + `op-ack`; optimistic moves flagged v2 |
| Frontend transforms drop row `id`s | Med/Med | Helper requires `row.id`; index fallback + dev-mode warning |
| Zoom/DeviceContainer coordinate math (v2 popover anchoring) | Med/Low | v1 avoids cross-frame geometry entirely (in-iframe overlay); v2 uses `zoom`/`measuredDeviceSize` from LivePreview context |
| Deep nesting schema-path edge cases | Med/Med | Reuse `getFieldPaths` conventions; nested fixtures tested in M1 |
| Message spoofing | Low/High | Strict origin + `event.source` checks, per-load `sessionId`, no `'*'` targets, SDK inert without handshake |

---

## 15. Open items

- **npm naming:** `payload-visual-editor` and `payloadcms-visual-editor` are taken; decide final brand before M4 publish (current working name: `payload-inline-visual-editor` + `@payload-inline-visual-editor/*` scope).
- **Vue/Svelte adapters:** community-friendly after v1 (core is framework-agnostic by design).
- **Frontend-hosted toolbar** (`@payloadcms/admin-bar`-style "Edit this page" that deep-links into the editor): cheap add-on after M5.
- **Stega auto-mapping** as an opt-in zero-instrumentation mode: explicitly out of v1; revisit after attribute-based flow is proven.
