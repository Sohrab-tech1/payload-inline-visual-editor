'use client'

import { initVisualEditing } from '@payload-inline-visual-editor/core'
import { useEffect } from 'react'

export type VisualEditingProps = {
  debug?: boolean
  serverURL: string
}

/**
 * Mounts the site SDK. Renders nothing; only activates inside an iframe
 * (the SDK additionally stays inert until the admin handshake).
 */
export const VisualEditing = ({ debug, serverURL }: VisualEditingProps): null => {
  useEffect(() => {
    if (window.self === window.top) {
      return
    }
    return initVisualEditing({ debug, serverURL })
  }, [debug, serverURL])

  return null
}
