export * from './attrs.js'
export * from './bridge.js'
export * from './overlay/index.js'
export * from './protocol.js'
export * from './scanner.js'

import { SiteBridge } from './bridge.js'
import { OverlayRenderer } from './overlay/index.js'
import { scanRegions, toProtocolRegions } from './scanner.js'

export type VisualEditingOptions = {
  debug?: boolean
  serverURL: string
}

/**
 * Entry point for the site SDK. Wires bridge + scanner + overlay; stays fully
 * inert until the admin sends a valid `hello`. Returns a teardown function.
 */
export const initVisualEditing = (options: VisualEditingOptions): (() => void) => {
  const bridge = new SiteBridge({ serverURL: options.serverURL })
  const overlay = new OverlayRenderer()

  const setEditMode = (enabled: boolean): void => {
    if (enabled) {
      overlay.mount()
      bridge.send('regions', { regions: toProtocolRegions(scanRegions()) })
    } else {
      overlay.unmount()
    }
  }

  const offMessage = bridge.onMessage((message) => {
    if (options.debug) {
      console.debug('[payload-inline-visual-editor]', message.type, message.payload)
    }
    switch (message.type) {
      case 'payload-visual-editor:edit-mode':
        setEditMode(message.payload.enabled)
        break
      case 'payload-visual-editor:hello':
        setEditMode(message.payload.editMode)
        break
    }
  })
  const disconnect = bridge.connect()

  return () => {
    offMessage()
    overlay.unmount()
    disconnect()
  }
}
