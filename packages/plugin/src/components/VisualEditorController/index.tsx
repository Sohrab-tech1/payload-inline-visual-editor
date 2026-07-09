'use client'

import type { PveMessagePayloads, PveOp } from '@payload-inline-visual-editor/core'
import type { ClientBlock, Labels } from 'payload'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import type { BlockOpsOptions } from '../../index.js'
import type { FieldSchemaLike } from '../../utils/fieldPaths.js'

import {
  BlocksDrawer,
  Button,
  ConfirmationModal,
  useDocumentInfo,
  useForm,
  useLivePreviewContext,
  useLocale,
  useModal,
} from '../../internal/payload-internals.js'
import { AdminBridge } from '../../utils/adminBridge.js'
import { normalizeBlockOps, planBlockOp, resolveRowIndexById } from '../../utils/blockOps.js'
import { resolveDataPath } from '../../utils/fieldPaths.js'
import { collectRowExpansions, focusFormField, isValidDataPath, pathFromFormElement } from '../../utils/formFocus.js'
import { buildDocRef, buildPermissionSummary, collectBlockLabels } from '../../utils/helloPayload.js'

export type VisualEditorControllerProps = {
  blockOps?: BlockOpsOptions | false
  debug?: boolean
}

type PendingAdd = {
  blocks: (ClientBlock | string)[]
  labels: Labels
  opId: string
  path: string
  rowIndex: number
  schemaPath: string
}

type PendingRemove = {
  label: string
  opId: string
  path: string
  rowId?: string
  rowIndex: number
}

// The container field config resolved from the client schema carries more than
// FieldSchemaLike models — pull what BlocksDrawer needs.
type ContainerFieldLike = FieldSchemaLike & {
  blockReferences?: (ClientBlock | string)[]
  labels?: Labels
}

/**
 * Admin-side controller, mounted inside the document <Form> via
 * edit.beforeDocumentControls. Owns the "Edit on page" toggle and the admin
 * half of the editor channel: per-iframe-load handshake, edit-mode relay,
 * click-to-edit (`select` → expand/scroll/focus the form field), reverse
 * focus sync, and block ops (`op` → form row operations + `op-ack`, SPEC §8).
 */
export const VisualEditorController = ({ blockOps, debug }: VisualEditorControllerProps) => {
  const { breakpoint, iframeRef, isLivePreviewing, loadedURL } = useLivePreviewContext()
  const { collectionSlug, docConfig, docPermissions, globalSlug, hasPublishPermission, hasSavePermission, id } =
    useDocumentInfo()
  const { addFieldRow, dispatchFields, getFields, moveFieldRow, removeFieldRow, setModified } = useForm()
  const { openModal } = useModal()
  const locale = useLocale()
  const uid = useId()

  const [editMode, setEditMode] = useState(false)
  const [connected, setConnected] = useState(false)
  const [pendingAdd, setPendingAdd] = useState<null | PendingAdd>(null)
  const [pendingRemove, setPendingRemove] = useState<null | PendingRemove>(null)
  const bridgeRef = useRef<AdminBridge | null>(null)
  const regionPathsRef = useRef<Set<string>>(new Set())
  const selectSeqRef = useRef(0)

  const blocksDrawerSlug = `pve-blocks-drawer-${uid}`
  const removeConfirmSlug = `pve-remove-row-${uid}`
  const enabledOps = useMemo(() => normalizeBlockOps(blockOps), [blockOps])

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
    blockOps: enabledOps,
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

  const ackRef = useRef<(opId: string, ok: boolean, error?: string) => void>(null!)
  ackRef.current = (opId, ok, error) => {
    bridgeRef.current?.send('op-ack', { error, ok, opId })
  }

  const handleOpRef = useRef<(op: PveOp) => void>(null!)
  handleOpRef.current = (op) => {
    const ack = ackRef.current
    if (!hasSavePermission) {
      ack(op.opId, false, 'not-allowed')
      return
    }
    const fields = getFields()
    const plan = planBlockOp({ enabledOps, fields, op })

    switch (plan.type) {
      case 'add': {
        const resolved = resolveDataPath({
          fields: (docConfig?.fields ?? []) as unknown as FieldSchemaLike[],
          path: op.containerPath,
        })
        const container = resolved?.field as ContainerFieldLike | undefined
        if (!container || (container.type !== 'array' && container.type !== 'blocks')) {
          ack(op.opId, false, 'unknown-container')
          return
        }
        if (container.type === 'array') {
          addFieldRow({ path: op.containerPath, rowIndex: plan.rowIndex, schemaPath: resolved!.schemaPath })
          ack(op.opId, true)
          return
        }
        // Blocks: the native picker takes over; the ack is sent when a block
        // is actually chosen (drawer cancel = no ack, the SDK times out)
        setPendingAdd({
          blocks: container.blockReferences ?? (container.blocks as unknown as ClientBlock[]) ?? [],
          labels: container.labels ?? { plural: 'Blocks', singular: 'Block' },
          opId: op.opId,
          path: op.containerPath,
          rowIndex: plan.rowIndex,
          schemaPath: resolved!.schemaPath,
        })
        return
      }
      case 'duplicate':
        dispatchFields({ path: op.containerPath, rowIndex: plan.rowIndex, type: 'DUPLICATE_ROW' })
        setModified(true)
        ack(op.opId, true)
        return
      case 'error':
        ack(op.opId, false, plan.error)
        return
      case 'move':
        moveFieldRow({ moveFromIndex: plan.moveFromIndex, moveToIndex: plan.moveToIndex, path: op.containerPath })
        ack(op.opId, true)
        return
      case 'noop':
        ack(op.opId, true)
        return
      case 'remove': {
        const blockType = fields[op.containerPath]?.rows?.[plan.rowIndex]?.blockType
        const labels = collectBlockLabels((docConfig?.fields ?? []) as unknown as FieldSchemaLike[])
        setPendingRemove({
          label: (blockType && (labels[blockType] ?? blockType)) || 'block',
          opId: op.opId,
          path: op.containerPath,
          rowId: op.rowId,
          rowIndex: plan.rowIndex,
        })
        return
      }
    }
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
        case 'payload-visual-editor:op':
          handleOpRef.current(message.payload)
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

  useEffect(() => {
    if (pendingAdd) {
      openModal(blocksDrawerSlug)
    }
  }, [pendingAdd, openModal, blocksDrawerSlug])

  useEffect(() => {
    if (pendingRemove) {
      openModal(removeConfirmSlug)
    }
  }, [pendingRemove, openModal, removeConfirmSlug])

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

  const confirmRemove = (): void => {
    if (!pendingRemove) {
      return
    }
    // Re-resolve by id — the form may have changed while the modal was open
    const rowIndex = pendingRemove.rowId
      ? resolveRowIndexById(getFields(), pendingRemove.path, pendingRemove.rowId)
      : pendingRemove.rowIndex
    if (rowIndex === null) {
      ackRef.current(pendingRemove.opId, false, 'unknown-row')
    } else {
      removeFieldRow({ path: pendingRemove.path, rowIndex })
      ackRef.current(pendingRemove.opId, true)
    }
    setPendingRemove(null)
  }

  const cancelRemove = (): void => {
    if (pendingRemove) {
      ackRef.current(pendingRemove.opId, false, 'cancelled')
      setPendingRemove(null)
    }
  }

  const drawerAddRow = (rowIndex: number, blockType?: string): void => {
    if (!pendingAdd) {
      return
    }
    addFieldRow({ blockType, path: pendingAdd.path, rowIndex, schemaPath: pendingAdd.schemaPath })
    ackRef.current(pendingAdd.opId, true)
    setPendingAdd(null)
  }

  return (
    <>
      <Button
        buttonStyle={editMode ? 'primary' : 'secondary'}
        disabled={!connected}
        onClick={toggleEditMode}
        size="small"
        tooltip={connected ? 'Highlight and edit marked regions on the page' : 'Waiting for the page to connect…'}
      >
        {editMode ? 'Editing on page' : 'Edit on page'}
      </Button>
      {pendingAdd ? (
        <BlocksDrawer
          addRow={drawerAddRow}
          addRowIndex={pendingAdd.rowIndex}
          blocks={pendingAdd.blocks}
          drawerSlug={blocksDrawerSlug}
          labels={pendingAdd.labels}
        />
      ) : null}
      {pendingRemove ? (
        <ConfirmationModal
          body={`Are you sure you want to remove this ${pendingRemove.label}?`}
          confirmLabel="Remove"
          heading="Remove block"
          modalSlug={removeConfirmSlug}
          onCancel={cancelRemove}
          onConfirm={confirmRemove}
        />
      ) : null}
    </>
  )
}
