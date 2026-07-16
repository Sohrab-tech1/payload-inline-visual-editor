# payload-inline-visual-editor

Open-source inline visual editor plugin for Payload CMS 3.x (target `payload@^3.85`): browse the site in Live Preview, toggle edit mode, hover-highlight marked regions, click to edit fields with native Payload UI, and add/duplicate/remove/drag-reorder blocks on the page.

**`SPEC.md` is the source of truth.** Read the relevant section before designing or implementing anything: §6 protocol, §7 attributes, §8 block ops, §11 plugin config, §13 milestones.

## Workspace map (pnpm monorepo)

| Path | Package | Role |
|---|---|---|
| `packages/plugin` | `payload-inline-visual-editor` | Payload plugin: config mutation + admin-side controller (injected via `edit.beforeDocumentControls`) |
| `packages/core` | `@payload-inline-visual-editor/core` | Site SDK, vanilla TS, **zero runtime deps**: protocol, attrs, scanner, bridge, overlay |
| `packages/react` | `@payload-inline-visual-editor/react` | React adapter: `<VisualEditing/>`, `payloadEditable()` |
| `dev` | private | Next + Payload playground: `pages` collection (nested blocks), `header` global, `/client-mode/[slug]` + `/ssr-mode/[slug]` |
| `test` | private | vitest int tests (`int/`), Playwright e2e (`e2e/`, drives `dev/`) |

## Commands

- `pnpm install` then `pnpm build` (builds packages in dependency order: core → plugin/react)
- `pnpm test` — vitest int tests (**run `pnpm build` first**: everything consumes built `dist/`)
- `pnpm dev` — builds packages, then dev playground at http://localhost:3000 (admin at `/admin`, login `dev@payloadcms.com` / `test`; seeded on first run)
- `pnpm watch` — SWC watch-rebuild of all packages (run alongside `pnpm --filter dev dev` when iterating on package code)
- `pnpm --filter dev generate:importmap` — regenerate `dev/app/(payload)/admin/importMap.js` after adding/renaming admin components
- `pnpm --filter dev generate:types` — regenerate `dev/payload-types.ts` after schema changes

## Architecture invariants (do not violate)

- **The stock Live Preview data pipeline stays untouched.** Document data flows through `payload-live-preview` messages only; our `payload-visual-editor:*` protocol carries intent/metadata only (SPEC §6).
- **The overlay renders inside the site iframe** (core SDK). Never do cross-frame rect math in v1 — Live Preview scales the iframe with a CSS transform.
- **`packages/core/src/protocol.ts` is the single source of truth** for message types; the plugin imports it from `@payload-inline-visual-editor/core`.
- **Every `@payloadcms/ui` / Payload-internal import in the plugin goes through `packages/plugin/src/internal/payload-internals.ts`** — one choke point so version breakage surfaces in one file.
- **postMessage security:** explicit `targetOrigin` (never `'*'`), admin checks `event.source` against the iframe, per-load `sessionId`, SDK stays inert until a valid `hello` from the allowed origin.
- **Plugins cannot register Payload server functions** — custom server work goes through REST `endpoints` only.
- **Paths are form-state data paths** (`layout.0.heading`); row identity across frames is the stable row `id` (ObjectId hex), never a bare index. Admin re-resolves indices from form-state `rows` by id before dispatching ops.
- **DOM→data mapping is explicit `data-pve-*` attributes only** (SPEC §7). No stega/string encoding in v1.

## Conventions

- ESM only; packages use `module: NodeNext` — relative imports inside `packages/*` need explicit `.js` extensions.
- Package `exports` point at built `dist/` **always** (dev app, tests, and consumers all get the same artifact — Turbopack cannot resolve `.js`→`.ts` in linked TS sources, so src-based exports are a dead end). Build = SWC transpile + `tsc --build` for declarations (project references: plugin/react reference core, so core must build first — `pnpm build` handles order).
- Client components carry `'use client'` in the component file itself; `exports/client.ts` only re-exports.
- Admin components are registered as import-map strings (`payload-inline-visual-editor/client#VisualEditorController`); changing them requires regenerating the dev import map.

## Status

M0 (scaffold), M1 (bridge spike), M2 (click-to-edit), and M3 (block ops) done: admin↔SDK handshake with per-load sessions (`AdminBridge` in plugin, `SiteBridge` in core), "Edit on page" toggle, region registry + hover outlines/labels, schema-path derivation (`resolveDataPath`); `select` → expand collapsed ancestor rows (`SET_ROW_COLLAPSED`) + scroll/focus/flash the admin field (`plugin/src/utils/formFocus.ts`); reverse `focus` flash; permission gating end-to-end (`core/src/permissions.ts`; read-only `viewer@payloadcms.com` in the dev seed exercises it in e2e). M3: row chips (add above/below · duplicate · remove · drag, `core/src/overlay/chips.ts`), overlay drag-reorder with drop indicator (`overlay/dnd.ts` pure gap math + drag session), empty-container add affordances + per-container pending shimmer for SSR mode (`overlay/indicators.ts`); admin executes ops via `planBlockOp` (`plugin/src/utils/blockOps.ts` — validates untrusted ops, re-resolves row index by id) → `addFieldRow`/BlocksDrawer/`DUPLICATE_ROW`/`removeFieldRow`-with-`ConfirmationModal`/`moveFieldRow`, then `op-ack`; `hello` now carries `blockOps` (plugin config gating); dev seed adds an `ssr-home` page (slug prefix `ssr-` previews through `/ssr-mode/`). M4 (v1 release prep) done code-side: `payloadEditable`/`pveAttr` accept nullable row ids + numeric scope ids straight from generated Payload types (runtime fallback + dev warning unchanged); `draft` flag threaded SDK→`hello-ack`→admin warning (`VisualEditing draft={...}`); README rewritten as full v1 docs (quick start, client vs SSR, draft-mode + cross-origin recipes) + per-package READMEs; Playwright hardened (`webServer` auto-start via root `pnpm e2e`, retries/traces in CI mode) + publish round-trip e2e (ops → draft only → Publish changes → REST-verified published layout); packages at 0.1.0 with publish metadata + per-package LICENSE, `RELEASING.md` has the manual checklist. **No GitHub CI — user explicitly declined workflows.** Remaining for v1 ship (user actions): final npm naming decision (SPEC §15), `pnpm publish -r --access public`, `payload-plugin` GitHub topic. Milestone table: SPEC §13.

M5 (v2 dedicated view) done: bare custom view at `/visual-editor/:collectionSlug/:id` (+ `…/globals/:globalSlug`) registered via `admin.components.views` (`exports/rsc.ts#VisualEditorView` — custom views bypass Payload's auth gate, the RSC enforces login itself); options snapshot travels via `admin.custom` (`visualEditorRuntime()`, reaches both RSC and client config); client shell (`VisualEditorScreen`) fetches the stock edit view through the `render-document` server function (DocumentDrawer pattern, no `drawerSlug` → includes DocumentControls + LivePreviewWindow) and restyles it via `styles.css` (`.pve-shell`; doc-header hidden, fields panel docked/collapsible, controls bar = toolbar) — it must replicate DefaultTemplate's provider stack (EntityVisibility/BulkUpload/Actions); controller in shell mode (`PveShellContext`) forces `setIsLivePreviewing(true)`, auto-enables edit mode, adds LocaleSwitcher (hand-rolled — see internals memory on deep-import context duplication) + panel toggle + Exit; v1 edit view gets an "Open visual editor" link. Doc-switch (SPEC §9): SDK sends `doc-switch-request` on foreign-scope clicks (hover shows the entity name); controller opens stock `useDocumentDrawer` for collections, hand-rolled `Drawer`+`render-document` (`paramsOverride: { segments: ['globals', slug] }`, **no docID** — it leaks into the save URL) for globals; drawers sever the shell context (`PveDocDrawerContext`) so nested controller instances stay inert. Plugin now peers on `next` (`next/navigation.js` import — extensioned, next has no exports map).

M6 (v2 popover editing) done: in shell mode, `select` (now carrying `point`/`rect` iframe-viewport geometry) opens a near-cursor popover (`plugin/src/components/FieldPopover`) instead of the panel focus flow — leaf regions render the single field, row regions the block/array subfields, via `RenderFields` bound to the same document Form (custom server components incl. Lexical resolve reactively from form-state `customComponents`; upload/relationship drawers just work). Target/permission resolution is pure and int-tested (`utils/popoverTarget.ts` — schema walk on top of `resolveDataPath`, `SanitizedFieldsPermissions` subtree walk, `blocksMap` string-reference support); anchoring math in `utils/popoverPosition.ts` (effective scale = iframe `boundingRect.width / offsetWidth`, so Live Preview zoom needs no context read). RichText fallback: stock client `RichTextField` renders null, so when form state lacks `customComponents.Field` the popover fetches it via `_internal_renderField` ('render-field' server fn, RenderLexical pattern, schemaPath `collection.<slug>.<fieldSchemaPath>`). New symmetric `deselect` protocol message: SDK lock-clear (Escape / empty-space click / region gone) ↔ admin popover close; popover is non-modal, never closes on outside click (its drawers portal outside), Escape is gated on `useModal().oneModalIsOpen`. Popover inputs duplicate panel `field-*` DOM ids (stock inputs hard-code them) — same-doc-drawer parity, harmless. v2 scope complete; remaining ship items unchanged (npm naming, publish, GitHub topic).
