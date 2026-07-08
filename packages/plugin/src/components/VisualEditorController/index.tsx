'use client'

import type { PveMessagePayloads } from '@payload-inline-visual-editor/core'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { BlockOpsOptions } from '../../index.js'
import type { FieldSchemaLike } from '../../utils/fieldPaths.js'

import { Button, useDocumentInfo, useLivePreviewContext, useLocale } from '../../internal/payload-internals.js'
import { AdminBridge } from '../../utils/adminBridge.js'
import { buildDocRef, buildPermissionSummary, collectBlockLabels } from '../../utils/helloPayload.js'

export type VisualEditorControllerProps = {
  blockOps?: BlockOpsOptions | false
  debug?: boolean
}

/**
 * Admin-side controller, mounted inside the document <Form> via
 * edit.beforeDocumentControls. Owns the "Edit on page" toggle and the admin
 * half of the editor channel: per-iframe-load handshake, edit-mode relay,
 * and (M2+) hover/select handling.
 */
export const VisualEditorController = ({ debug }: VisualEditorControllerProps) => {
  const { breakpoint, iframeRef, isLivePreviewing, loadedURL } = useLivePreviewContext()
  const { collectionSlug, docConfig, docPermissions, globalSlug, hasPublishPermission, hasSavePermission, id } =
    useDocumentInfo()
  const locale = useLocale()

  const [editMode, setEditMode] = useState(false)
  const [connected, setConnected] = useState(false)
  const bridgeRef = useRef<AdminBridge | null>(null)

  const targetOrigin = useMemo(() => {
    if (!loadedURL) {
      return null
    }
    try {
      return new URL(loadedURL, window.location.href).origin
    } catch {
      return null
    }
  }, [loadedURL])

  const buildHelloRef = useRef<() => PveMessagePayloads['hello']>(null!)
  buildHelloRef.current = () => ({
    breakpoint,
    docs: [buildDocRef({ collectionSlug, globalSlug, id })],
    editMode,
    labels: collectBlockLabels((docConfig?.fields ?? []) as unknown as FieldSchemaLike[]),
    locale: locale?.code,
    permissions: buildPermissionSummary({
      canPublish: Boolean(hasPublishPermission),
      canSave: Boolean(hasSavePermission),
      docPermissions,
    }),
  })

  useEffect(() => {
    if (!isLivePreviewing || !targetOrigin) {
      return
    }
    const iframe = iframeRef.current
    const bridge = new AdminBridge({
      getTargetWindow: () => iframeRef.current?.contentWindow,
      targetOrigin,
    })
    bridgeRef.current = bridge

    const offMessage = bridge.onMessage((message) => {
      if (debug) {
        console.debug('[payload-inline-visual-editor] admin ←', message.type, message.payload)
      }
      switch (message.type) {
        case 'payload-visual-editor:hello-ack':
          setConnected(true)
          if (message.payload.draft === false) {
            console.warn(
              '[payload-inline-visual-editor] The preview is not rendering draft content — edits will not appear until published.',
            )
          }
          break
        // hover/select/regions are consumed in M2+ (field focus, block ops)
      }
    })

    const startSession = (): void => {
      setConnected(false)
      bridge.startSession(buildHelloRef.current())
    }
    startSession()
    iframe?.addEventListener('load', startSession)

    return () => {
      iframe?.removeEventListener('load', startSession)
      offMessage()
      bridge.destroy()
      bridgeRef.current = null
      setConnected(false)
    }
  }, [debug, iframeRef, isLivePreviewing, loadedURL, targetOrigin])

  if (!isLivePreviewing) {
    return null
  }

  const toggleEditMode = (): void => {
    const enabled = !editMode
    setEditMode(enabled)
    bridgeRef.current?.send('edit-mode', { enabled })
  }

  return (
    <Button
      buttonStyle={editMode ? 'primary' : 'secondary'}
      disabled={!connected}
      onClick={toggleEditMode}
      size="small"
      tooltip={connected ? 'Highlight and edit marked regions on the page' : 'Waiting for the page to connect…'}
    >
      {editMode ? 'Editing on page' : 'Edit on page'}
    </Button>
  )
}
