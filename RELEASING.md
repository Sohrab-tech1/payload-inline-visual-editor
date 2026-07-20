# Releasing

Manual release checklist (no CI publishing).

## Pre-flight

1. **Naming** (first release only): confirm the final npm names — `payload-visual-editor` and `payloadcms-visual-editor` are taken; current working name is `payload-inline-visual-editor` + the `@payload-inline-visual-editor/*` scope. The scope must exist as an npm org before publishing.
2. Bump the version in `packages/{core,plugin,react}/package.json` (keep all three in lockstep) and `SDK_VERSION` in `packages/core/src/protocol.ts`.
3. Verify everything from a clean state:

   ```sh
   pnpm clean && pnpm install && pnpm build
   pnpm test
   pnpm e2e     # starts the dev playground itself
   ```

4. Inspect what would be published (README, LICENSE, and `dist/` only):

   ```sh
   pnpm -r --filter './packages/*' exec npm pack --dry-run
   ```

## Publish

`pnpm publish -r` publishes in dependency order (core first) and rewrites `workspace:*` ranges to the real versions:

```sh
pnpm publish -r --access public
```

## After publishing

- Tag the release: `git tag v0.1.0 && git push origin v0.1.0`.
- Add the `payload-plugin` topic to the GitHub repository (Settings → Topics) so the plugin is discoverable.
- Smoke-test the published artifacts in a scratch Payload app: install the plugin, run `payload generate:importmap`, open Live Preview, toggle edit mode.
