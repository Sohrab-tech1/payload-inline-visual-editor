'use client'

import { createContext, useContext } from 'react'

import type { VisualEditorToolbarOptions } from '../../index.js'

export type PveShellContextValue = {
  exitUrl: string
  panelCollapsed: boolean
  setPanelCollapsed: (collapsed: boolean) => void
  toolbar: Required<VisualEditorToolbarOptions>
}

/** Present only inside the dedicated view — the controller adapts to the shell through it. */
export const PveShellContext = createContext<null | PveShellContextValue>(null)

export const usePveShell = (): null | PveShellContextValue => useContext(PveShellContext)

/**
 * Marks the subtree of a doc-switch drawer. The document rendered inside
 * carries its own controller instance (beforeDocumentControls renders in
 * drawers too) — it must stay quiet instead of acting like a second editor.
 */
export const PveDocDrawerContext = createContext(false)

export const usePveDocDrawer = (): boolean => useContext(PveDocDrawerContext)
