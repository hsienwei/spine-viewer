interface ShareManifestTexture {
  logicalName: string
  storedName: string
  mimeType: string
  width?: number
  height?: number
}

interface ShareManifest {
  shareId: string
  createdAt: string
  expiresAt: string
  files: {
    skeleton: {
      name: string
      mimeType: string
    }
    atlas: {
      name: string
      mimeType: string
    }
    textures: ShareManifestTexture[]
  }
  watermark: {
    mode: string
    label: string
  }
}

interface ShareRecord {
  shareId: string
  createdAt: string
  expiresAt: string
  fileList: {
    skeleton: string
    atlas: string
    textures: Array<{
      logicalName: string
      storedName: string
    }>
  }
  viewCount: number
  maxViews: number | null
  revokedAt: string | null
}

interface AssetFetcher {
  fetch(input: Request | URL | string): Promise<Response>
}

interface BucketObjectBody {
  body: ReadableStream | null
  httpMetadata?: {
    contentType?: string
  }
}

interface BucketPutOptions {
  httpMetadata?: {
    contentType?: string
  }
}

interface ShareBucket { 
  put(key: string, value: ArrayBuffer | string, options?: BucketPutOptions): Promise<void> 
  get(key: string): Promise<BucketObjectBody | null> 
  delete(key: string): Promise<void>
} 

interface ShareKvNamespace { 
  get(key: string): Promise<string | null> 
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> 
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string }>
    cursor?: string
    list_complete?: boolean
  }>
} 

interface Env {
  ASSETS: AssetFetcher
  SHARE_BUCKET: ShareBucket
  SHARE_KV: ShareKvNamespace
}

const SHARE_TTL_SECONDS = 60 * 60 * 24
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
}

const createJsonResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  })
}

const createErrorResponse = (message: string, status = 400) => {
  return createJsonResponse({ error: message }, status)
}

const generateId = (bytes = 16) => {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes))
  return [...buffer].map(value => value.toString(16).padStart(2, '0')).join('')
}

const getShareRecord = async (env: Env, token: string) => {
  const raw = await env.SHARE_KV.get(`share:${token}`)
  if (!raw) return null

  return JSON.parse(raw) as ShareRecord
}

const validateShare = (record: ShareRecord | null) => { 
  if (!record) return { ok: false as const, status: 404, message: 'Share link not found' } 
  if (record.revokedAt) return { ok: false as const, status: 410, message: 'Share link revoked' } 
  if (Date.parse(record.expiresAt) <= Date.now()) { 
    return { ok: false as const, status: 410, message: 'Share link expired' } 
  }
  if (record.maxViews !== null && record.viewCount >= record.maxViews) {
    return { ok: false as const, status: 410, message: 'Share view limit reached' }
  }

  return { ok: true as const } 
} 

const isShareExpired = (record: ShareRecord) => Date.parse(record.expiresAt) <= Date.now()

const storeFile = async (bucket: ShareBucket, key: string, file: File) => {
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream'
    }
  })
}

const handleShareUpload = async (request: Request, env: Env) => {
  const formData = await request.formData()
  const skeleton = formData.get('skeleton')
  const atlas = formData.get('atlas')
  const manifestField = formData.get('manifest')

  if (!(skeleton instanceof File) || !(atlas instanceof File) || typeof manifestField !== 'string') {
    return createErrorResponse('Missing required upload fields', 400)
  }

  let manifest: ShareManifest
  try {
    manifest = JSON.parse(manifestField) as ShareManifest
  } catch {
    return createErrorResponse('Invalid manifest payload', 400)
  }

  const shareId = manifest.shareId || generateId(12)
  const token = generateId(12)
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + SHARE_TTL_SECONDS * 1000).toISOString()

  const textureEntries = manifest.files?.textures || []
  const textureFiles = new Map<string, File>()
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('texture:') || !(value instanceof File)) continue
    textureFiles.set(key.slice('texture:'.length), value)
  }

  const missingTextures = textureEntries.filter(texture => !textureFiles.has(texture.storedName))
  if (missingTextures.length > 0) {
    return createErrorResponse(`Missing processed textures: ${missingTextures.map(item => item.storedName).join(', ')}`, 400)
  }

  const finalizedManifest: ShareManifest = {
    ...manifest,
    shareId,
    createdAt,
    expiresAt
  }

  await storeFile(env.SHARE_BUCKET, `share/${shareId}/skeleton/${skeleton.name}`, skeleton)
  await storeFile(env.SHARE_BUCKET, `share/${shareId}/atlas/${atlas.name}`, atlas)

  for (const texture of textureEntries) {
    const textureFile = textureFiles.get(texture.storedName)
    if (!textureFile) continue
    await storeFile(env.SHARE_BUCKET, `share/${shareId}/textures/${texture.storedName}`, textureFile)
  }

  await env.SHARE_BUCKET.put(
    `share/${shareId}/manifest.json`,
    JSON.stringify(finalizedManifest),
    { httpMetadata: { contentType: 'application/json; charset=utf-8' } }
  )

  const record: ShareRecord = {
    shareId,
    createdAt,
    expiresAt,
    fileList: {
      skeleton: skeleton.name,
      atlas: atlas.name,
      textures: textureEntries.map(texture => ({
        logicalName: texture.logicalName,
        storedName: texture.storedName
      }))
    },
    viewCount: 0,
    maxViews: null,
    revokedAt: null
  }

  await env.SHARE_KV.put(`share:${token}`, JSON.stringify(record), {
    expirationTtl: SHARE_TTL_SECONDS
  })

  return createJsonResponse({
    shareUrl: `${new URL(request.url).origin}/s/${token}`,
    token,
    expiresAt
  })
}

const handleShareManifest = async (env: Env, token: string) => {
  const record = await getShareRecord(env, token)
  const validation = validateShare(record)
  if (!validation.ok) {
    return createErrorResponse(validation.message, validation.status)
  }
  const activeRecord = record as ShareRecord

  const object = await env.SHARE_BUCKET.get(`share/${activeRecord.shareId}/manifest.json`)
  if (!object) {
    return createErrorResponse('Manifest not found', 404)
  }

  return new Response(object.body, {
    headers: {
      ...JSON_HEADERS
    }
  })
}

const handleShareObject = async (env: Env, token: string, filename: string) => {
  const record = await getShareRecord(env, token)
  const validation = validateShare(record)
  if (!validation.ok) {
    return createErrorResponse(validation.message, validation.status)
  }
  const activeRecord = record as ShareRecord

  const decodedName = decodeURIComponent(filename)
  const shareId = activeRecord.shareId

  let key = ''
  let contentType = 'application/octet-stream'
  if (decodedName === activeRecord.fileList.skeleton) {
    key = `share/${shareId}/skeleton/${decodedName}`
    contentType = 'application/json'
  } else if (decodedName === activeRecord.fileList.atlas) {
    key = `share/${shareId}/atlas/${decodedName}`
    contentType = 'text/plain; charset=utf-8'
  } else {
    const texture = activeRecord.fileList.textures.find(item => item.logicalName === decodedName || item.storedName === decodedName)
    if (!texture) {
      return createErrorResponse('Asset not found', 404)
    }
    key = `share/${shareId}/textures/${texture.storedName}`
    contentType = 'image/webp'
  }

  const object = await env.SHARE_BUCKET.get(key)
  if (!object) {
    return createErrorResponse('Asset not found', 404)
  }

  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType || contentType,
      'cache-control': 'no-store',
      'content-disposition': `inline; filename="${decodedName}"`
    }
  })
}

const handleShareRevoke = async (env: Env, token: string) => { 
  const record = await getShareRecord(env, token) 
  if (!record) { 
    return createErrorResponse('Share link not found', 404) 
  }
  if (record.revokedAt) {
    return createJsonResponse({ revoked: true, revokedAt: record.revokedAt })
  }

  const revokedAt = new Date().toISOString()
  const nextRecord: ShareRecord = {
    ...record,
    revokedAt
  }

  await env.SHARE_KV.put(`share:${token}`, JSON.stringify(nextRecord), {
    expirationTtl: SHARE_TTL_SECONDS
  })

  return createJsonResponse({ revoked: true, revokedAt }) 
} 

const handleSharePage = async (request: Request, env: Env) => {
  return env.ASSETS.fetch(new URL('/', request.url))
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/api/share/upload') {
      return handleShareUpload(request, env)
    }

    const manifestMatch = url.pathname.match(/^\/api\/share\/([^/]+)\/manifest$/)
    if (request.method === 'GET' && manifestMatch) {
      return handleShareManifest(env, manifestMatch[1])
    }

    const objectMatch = url.pathname.match(/^\/api\/share\/([^/]+)\/object\/(.+)$/)
    if (request.method === 'GET' && objectMatch) {
      return handleShareObject(env, objectMatch[1], objectMatch[2])
    }

    const revokeMatch = url.pathname.match(/^\/api\/share\/([^/]+)\/revoke$/) 
    if (request.method === 'POST' && revokeMatch) { 
      return handleShareRevoke(env, revokeMatch[1]) 
    } 

    const sharePageMatch = url.pathname.match(/^\/s\/[^/]+$/) 
    if (request.method === 'GET' && sharePageMatch) { 
      return handleSharePage(request, env) 
    } 

    return env.ASSETS.fetch(request) 
  }
}
