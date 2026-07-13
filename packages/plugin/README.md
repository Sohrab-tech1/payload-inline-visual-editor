# payload-inline-visual-editor

Inline visual editing for [Payload CMS](https://payloadcms.com) 3.x — browse your site in Live Preview, toggle edit mode, hover-highlight editable regions, click to edit any field with native Payload field UI, and add / duplicate / remove / drag-reorder blocks directly on the page. Includes a dedicated full-screen editor view at `/admin/visual-editor/:collectionSlug/:id` and cross-document editing drawers.

This is the Payload plugin (admin side). Pair it with:

- [`@payload-inline-visual-editor/react`](https://www.npmjs.com/package/@payload-inline-visual-editor/react) — React/Next site adapter (`<VisualEditing/>`, `payloadEditable()`), or
- [`@payload-inline-visual-editor/core`](https://www.npmjs.com/package/@payload-inline-visual-editor/core) — framework-agnostic vanilla SDK.

## Usage

```ts
// payload.config.ts
import { visualEditor } from 'payload-inline-visual-editor'

export default buildConfig({
  // ...
  plugins: [visualEditor()],
})
```

Then regenerate your import map: `payload generate:importmap`.

By default the editor enables itself for every collection and global with a Live Preview URL. See the [full documentation](https://github.com/what-digital/payload-inline-visual-editor#readme) for site instrumentation, plugin options, draft mode, and cross-origin recipes.

## License

MIT
