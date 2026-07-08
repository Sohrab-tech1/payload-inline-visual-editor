/**
 * Single choke point for every @payloadcms/ui (and other Payload-internal)
 * import in this package. When a Payload upgrade breaks an internal API, it
 * surfaces here and nowhere else (SPEC §12, §14).
 */
export { Button, useDocumentInfo, useForm, useLivePreviewContext, useLocale } from '@payloadcms/ui'
