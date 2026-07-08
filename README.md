# payload-inline-visual-editor

Inline visual editing for [Payload CMS](https://payloadcms.com) 3.x — browse your site, toggle edit mode, hover-highlight editable regions, click to edit any field with native Payload field UI, and add / duplicate / remove / drag-reorder blocks directly on the page. Layered on core Live Preview; the standard save/publish/autosave/versions/locales flow keeps working unchanged.

> **Status: pre-alpha.** Scaffold stage — nothing published to npm yet. The full design lives in [SPEC.md](./SPEC.md).

## Packages

| Package | Description |
|---|---|
| `payload-inline-visual-editor` | The Payload plugin (admin side) |
| `@payload-inline-visual-editor/core` | Framework-agnostic site SDK (vanilla TS, zero deps) |
| `@payload-inline-visual-editor/react` | React/Next adapter: `<VisualEditing/>`, `payloadEditable()` |

## Development

```sh
pnpm install
pnpm build        # build packages
pnpm test         # vitest int tests
pnpm dev          # playground at http://localhost:3000
```

Playground admin: `http://localhost:3000/admin` — `dev@payloadcms.com` / `test` (seeded on first run). Open the seeded **Home** page and switch to Live Preview.

## License

[MIT](./LICENSE)
