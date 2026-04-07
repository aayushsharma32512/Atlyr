import { supabase, SUPABASE_URL_FOR_FUNCTIONS } from "@/integrations/supabase/client"

const FUNCTION_BASE = `${SUPABASE_URL_FOR_FUNCTIONS}/functions/v1`

export type LikenessUploadPayload = {
  selfie: File
  fullBody: File
  height?: string | null
  weight?: string | null
  skinTone?: string | null
  candidateCount?: number
  parallelStreams?: number
  uploadBatchId?: string | null
}

export type LikenessSource = {
  type: "selfie" | "fullBody"
  path: string
  mimeType: string
}

export type LikenessCandidate = {
  index: number
  path: string
  mimeType: string
  signedUrl: string | null
  summary?: string | null
}

export type LikenessUploadResponse = {
  status: "ok"
  uploadBatchId: string
  identitySummary: string | null
  summaries?: Array<{ index: number; summary: string }>
  metadata: {
    height?: string | null
    weight?: string | null
    skinTone?: string | null
  }
  sources: LikenessSource[]
  candidates: LikenessCandidate[]
  candidateCount: number
  parallelStreams?: number
  correlationId: string
}

export type LikenessSelectResponse = {
  status: "ok"
  neutralPoseId: string
  storagePath: string
  imageUrl: string | null
  identitySummary: string | null
  isActive: boolean
  correlationId: string
}

export type LikenessPose = {
  id: string
  createdAt: string
  isActive: boolean
  imagePath: string
  imageUrl: string | null
  metadata: Record<string, unknown>
}

async function buildAuthHeaders({ json = true }: { json?: boolean } = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error("auth_required")
  }
  const headers = new Headers()
  if (json) {
    headers.set("Content-Type", "application/json")
  }
  headers.set("x-correlation-id", crypto.randomUUID())
  headers.set("Authorization", `Bearer ${session.access_token}`)
  return headers
}

async function fetchJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${FUNCTION_BASE}/${path}`, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof json?.code === "string" ? json.code : `Request failed: ${response.status}`
    throw new Error(message)
  }
  return json as T
}

export async function uploadLikeness(payload: LikenessUploadPayload): Promise<LikenessUploadResponse> {
  const formData = new FormData()
  formData.append("selfie", payload.selfie)
  formData.append("fullBody", payload.fullBody)
  if (payload.height) formData.append("height", payload.height)
  if (payload.weight) formData.append("weight", payload.weight)
  if (payload.skinTone) formData.append("skinTone", payload.skinTone)
  if (payload.uploadBatchId) formData.append("uploadBatchId", payload.uploadBatchId)
  if (payload.candidateCount) formData.append("candidateCount", String(payload.candidateCount))

  const headers = await buildAuthHeaders({ json: false })
  const response = await fetch(`${FUNCTION_BASE}/likeness-upload`, {
    method: "POST",
    headers,
    body: formData,
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof json?.code === "string" ? json.code : `upload failed: ${response.status}`
    throw new Error(message)
  }
  return json as LikenessUploadResponse
}

export async function selectLikeness(body: {
  candidateId: string
  setActive?: boolean
}): Promise<LikenessSelectResponse> {
  const headers = await buildAuthHeaders()
  return fetchJson<LikenessSelectResponse>("likeness-select", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

export async function listLikeness(): Promise<LikenessPose[]> {
  const headers = await buildAuthHeaders()
  const result = await fetchJson<{ poses: LikenessPose[] }>("likeness-list", {
    method: "GET",
    headers,
  })
  return Array.isArray(result.poses) ? result.poses : []
}

export async function setActiveLikeness(poseId: string) {
  const headers = await buildAuthHeaders()
  await fetchJson("likeness-set-active", {
    method: "POST",
    headers,
    body: JSON.stringify({ poseId }),
  })
}

export async function deleteLikeness(poseId: string) {
  const headers = await buildAuthHeaders()
  await fetchJson("likeness-delete", {
    method: "POST",
    headers,
    body: JSON.stringify({ poseId }),
  })
}

export async function signTempCandidate(path: string) {
  const headers = await buildAuthHeaders()
  const result = await fetchJson<{ signedUrl?: string }>("likeness-sign-temp", {
    method: "POST",
    headers,
    body: JSON.stringify({ path }),
  })
  return result.signedUrl ?? null
}


