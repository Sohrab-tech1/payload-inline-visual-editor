'use client'

import type { PveMessagePayloads } from '@payload-inline-visual-editor/core'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { BlockOpsOptions } from '../../index.js'
import type { FieldSchemaLike } from '../../utils/fieldPaths.js'

import {
  Button,
  useDocumentInfo,
  useForm,
  useLivePreviewContext,
  useLocale,
} from '../../internal/payload-internals.js'
import { AdminBridge } from '../../utils/adminBridge.js'
import { collectRowExpansions, focusFormField, isValidDataPath, pathFromFormElement } from '../../utils/formFocus.js'
import { buildDocRef, buildPermissionSummary, collectBlockLabels } from '../../utils/helloPayload.js'

export type VisualEditorControllerProps = {
  blockOps?: BlockOpsOptions | false
  debug?: boolean
}

/**
 * Admin-side controller, mounted inside the document <Form> via
 * edit.beforeDocumentControls. Owns the "Edit on page" toggle and the admin
 * half of the editor channel: per-iframe-load handshake, edit-mode relay,
 * click-to-edit (`select` → expand/scroll/focus the form field), and reverse
 * focus sync (form field focus/hover → flash on page).
 */
export const VisualEditorController = ({ debug }: VisualEditorControllerProps) => {
  const { breakpoint, iframeRef, isLivePreviewing, loadedURL } = useLivePreviewContext()
  const { collectionSlug, docConfig, docPermissions, globalSlug, hasPublishPermission, hasSavePermission, id } =
    useDocumentInfo()
  const { dispatchFields, getFields } = useForm()
  const locale = useLocale()

  const [editMode, setEditMode] = useState(false)
  const [connected, setConnected] = useState(false)
  const bridgeRef = useRef<AdminBridge | null>(null)
  const regionPathsRef = useRef<Set<string>>(new Set())
  const selectSeqRef = useRef(0)

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

  const handleSelectRef = useRef<(path: string) => void>(null!)
  handleSelectRef.current = (path) => {
    if (!isValidDataPath(path)) {
      return
    }
    for (const expansion of collectRowExpansions(getFields(), path)) {
      dispatchFields({ path: expansion.path, type: 'SET_ROW_COLLAPSED', updatedRows: expansion.updatedRows })
    }
    const seq = ++selectSeqRef.current
    void focusFormField({ path, shouldContinue: () => selectSeqRef.current === seq })
  }

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
        case 'payload-visual-editor:regions':
          regionPathsRef.current = new Set(message.payload.regions.map((region) => region.path))
          break
        case 'payload-visual-editor:select':
          handleSelectRef.current(message.payload.path)
          break
      }
    })

    const startSession = (): void => {
      setConnected(false)
      regionPathsRef.current = new Set()
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

  // Reverse sync: focusing/hovering a marked field in the form flashes it on the page
  useEffect(() => {
    if (!editMode || !connected) {
      return
    }
    let lastSentPath: null | string = null

    const sendFocus = (target: EventTarget | null, force: boolean): void => {
      if (!(target instanceof Element)) {
        return
      }
      const path = pathFromFormElement(target)
      if (!path || !regionPathsRef.current.has(path)) {
        lastSentPath = null
        return
      }
      if (!force && lastSentPath === path) {
        return
      }
      lastSentPath = path
      bridgeRef.current?.send('focus', { path })
    }

    const onFocusIn = (event: FocusEvent): void => sendFocus(event.target, true)
    const onPointerOver = (event: PointerEvent): void => sendFocus(event.target, false)

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('pointerover', onPointerOver, { passive: true })
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('pointerover', onPointerOver)
    }
  }, [editMode, connected])

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
