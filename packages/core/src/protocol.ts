export const PROTOCOL_VERSION = 1

export const MESSAGE_TYPE_PREFIX = 'payload-visual-editor'

export const SDK_VERSION = '0.0.0'

export type PveDocRef = {
  collection?: string
  global?: string
  id?: string
}

export type PveFieldPermissions = {
  update: boolean
}

export type PvePermissionSummary = {
  canPublish: boolean
  canSave: boolean
  fields: Record<string, PveFieldPermissions>
}

export type PveRegionKind = 'container' | 'field' | 'row'

export type PveRegion = {
  blockType?: string
  kind: PveRegionKind
  path: string
  regionId: string
  rowId?: string
  scope: string
}

export type PveOpKind = 'add' | 'duplicate' | 'move' | 'remove'

export type PveOp = {
  blockType?: string
  containerPath: string
  moveFromIndex?: number
  moveToIndex?: number
  op: PveOpKind
  opId: string
  rowId?: string
  rowIndex?: number
  scope: string
}

export type PveMessagePayloads = {
  breakpoint: { breakpoint: string }
  'doc-status': { isDirty: boolean; publishedStatus?: string; saving: boolean }
  'doc-switch-request': { scope: string }
  'edit-mode': { enabled: boolean }
  focus: { path: string }
  hello: {
    breakpoint?: string
    docs: PveDocRef[]
    editMode: boolean
    labels: Record<string, string>
    locale?: string
    permissions: PvePermissionSummary
  }
  'hello-ack': { draft?: boolean; sdkVersion: string }
  hover: { path: string; regionId: string; scope: string } | null
  locale: { locale: string }
  op: PveOp
  'op-ack': { error?: string; ok: boolean; opId: string }
  regions: { regions: PveRegion[] }
  select: { path: string; regionId: string; scope: string }
}

export type PveMessageType = keyof PveMessagePayloads

export type PveMessage<T extends PveMessageType = PveMessageType> = {
  [K in T]: {
    payload: PveMessagePayloads[K]
    sessionId: string
    type: `${typeof MESSAGE_TYPE_PREFIX}:${K}`
    version: number
  }
}[T]

export const createPveMessage = <T extends PveMessageType>(
  type: T,
  sessionId: string,
  payload: PveMessagePayloads[T],
): PveMessage<T> =>
  ({
    payload,
    sessionId,
    type: `${MESSAGE_TYPE_PREFIX}:${type}`,
    version: PROTOCOL_VERSION,
  }) as PveMessage<T>

export const isPveMessage = (data: unknown): data is PveMessage => {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const message = data as Record<string, unknown>
  return (
    typeof message.type === 'string' &&
    message.type.startsWith(`${MESSAGE_TYPE_PREFIX}:`) &&
    typeof message.sessionId === 'string' &&
    typeof message.version === 'number' &&
    'payload' in message
  )
}

export const hasCompatibleVersion = (message: PveMessage): boolean =>
  message.version === PROTOCOL_VERSION
