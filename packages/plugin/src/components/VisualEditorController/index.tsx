'use client'

import type { BlockOpsOptions } from '../../index.js'

import { Button, useLivePreviewContext } from '../../internal/payload-internals.js'

export type VisualEditorControllerProps = {
  blockOps?: BlockOpsOptions | false
  debug?: boolean
}

/**
 * Admin-side controller, mounted inside the document <Form> via
 * edit.beforeDocumentControls. M0 placeholder: renders the "Edit on page"
 * toggle only while Live Preview is active. M1 adds the bridge (handshake,
 * edit-mode, hover/select relay) per SPEC §6.
 */
export const VisualEditorController = ({ debug }: VisualEditorControllerProps) => {
  const { isLivePreviewing } = useLivePreviewContext()

  if (!isLivePreviewing) {
    return null
  }

  if (debug) {
    console.debug('[payload-inline-visual-editor] controller mounted (Live Preview active)')
  }

  return (
    <Button buttonStyle="secondary" disabled size="small" tooltip="Inline visual editing lands in M1">
      Edit on page
    </Button>
  )
}
