export type PackingDraft = {
  id: string
  sessionId: string
  sequenceNo: number
  blob: Blob
  createdAt: string
}

type StoredPackingDraft = Omit<PackingDraft, 'blob'> & {
  blob?: Blob
  blobBytes?: ArrayBuffer
  mimeType?: string
}

const DB_NAME = 'nomo-packing'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

function openPackingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('packing database could not be opened'))
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('sessionId', 'sessionId')
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function completeTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('packing database transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('packing database transaction was aborted'))
  })
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('packing draft blob could not be read'))
    reader.readAsArrayBuffer(blob)
  })
}

export async function serializePackingDraft(draft: PackingDraft): Promise<StoredPackingDraft> {
  const { blob, ...metadata } = draft
  return {
    ...metadata,
    blobBytes: await blobToArrayBuffer(blob),
    mimeType: blob.type || 'image/jpeg',
  }
}

export function deserializePackingDraft(stored: StoredPackingDraft): PackingDraft {
  const { blob: legacyBlob, blobBytes, mimeType, ...metadata } = stored
  const blob = legacyBlob instanceof Blob
    ? legacyBlob
    : new Blob(blobBytes ? [blobBytes] : [], { type: mimeType || 'image/jpeg' })
  return { ...metadata, blob }
}

export async function savePackingDraft(draft: PackingDraft): Promise<void> {
  const database = await openPackingDatabase()
  try {
    const storedDraft = await serializePackingDraft(draft)
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(storedDraft)
    await completeTransaction(transaction)
  } finally {
    database.close()
  }
}

export async function listPackingDrafts(sessionId: string): Promise<PackingDraft[]> {
  const database = await openPackingDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).index('sessionId').getAll(sessionId)
    const drafts = await new Promise<PackingDraft[]>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as StoredPackingDraft[]).map(deserializePackingDraft))
      request.onerror = () => reject(request.error ?? new Error('packing drafts could not be read'))
    })
    await completeTransaction(transaction)
    return drafts.sort((left, right) => left.sequenceNo - right.sequenceNo)
  } finally {
    database.close()
  }
}

export async function deletePackingDraft(id: string): Promise<void> {
  const database = await openPackingDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    await completeTransaction(transaction)
  } finally {
    database.close()
  }
}
