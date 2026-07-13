/**
 * Single choke point for every @payloadcms/ui (and other Payload-internal)
 * import in this package. When a Payload upgrade breaks an internal API, it
 * surfaces here and nowhere else (SPEC §12, §14).
 */
export {
  ActionsProvider,
  BlocksDrawer,
  BulkUploadProvider,
  Button,
  ConfirmationModal,
  Drawer,
  EntityVisibilityProvider,
  LoadingOverlay,
  useConfig,
  useDocumentDrawer,
  useDocumentDrawerContext,
  useDocumentInfo,
  useForm,
  useLivePreviewContext,
  useLocale,
  useModal,
  useServerFunctions,
} from '@payloadcms/ui'
// NOTE: deep imports like '@payloadcms/ui/elements/*' bundle a second copy of
// the UI contexts (their hooks then see no provider) — only barrel exports work
export type { RenderDocumentResult } from '@payloadcms/ui'
