/**
 * Signing layer. Runs on the same WebCrypto API in the browser and in Node.
 * Uses ECDSA P-256 with SHA-256 (ES256 in JOSE terms).
 */

const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' } as const

export interface KeyPairJwk {
  publicKey: JsonWebKey
  privateKey: JsonWebKey
}

export interface Proof {
  alg: 'ES256'
  /** Identity of the signer. Verification uses the key registered for this identity. */
  issuer: string
  signedAt: number
  signature: string
}

export type Signed<T> = T & { proof: Proof }

export async function generateKeyPair(): Promise<KeyPairJwk> {
  const pair = await crypto.subtle.generateKey(KEY_ALGORITHM, true, ['sign', 'verify'])
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.publicKey),
    crypto.subtle.exportKey('jwk', pair.privateKey),
  ])
  return { publicKey, privateKey }
}

/**
 * Deterministic JSON: keys are sorted and undefined fields dropped.
 * The same content must always produce the same bytes, or signatures cannot be verified.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`
}

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomToken(bytes = 18): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** Short readable identifier, e.g. "saign:agent:7f3a9c21". */
export function newId(kind: string): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('')
  return `saign:${kind}:${hex}`
}

/** Public key fingerprint, shown in the UI as "A1B2 C3D4 E5F6 0718". */
export async function fingerprint(publicKey: JsonWebKey): Promise<string> {
  const hex = await sha256Hex(canonicalize({ crv: publicKey.crv, kty: publicKey.kty, x: publicKey.x, y: publicKey.y }))
  return hex.slice(0, 16).toUpperCase().replace(/(.{4})/g, '$1 ').trim()
}

async function signBytes(text: string, privateKey: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', privateKey, KEY_ALGORITHM, false, ['sign'])
  const signature = await crypto.subtle.sign(SIGN_ALGORITHM, key, encoder.encode(text))
  return toBase64Url(new Uint8Array(signature))
}

/** Signs the body and returns it with the proof attached. */
export async function sign<T extends object>(body: T, issuer: string, privateKey: JsonWebKey, now: number): Promise<Signed<T>> {
  const signature = await signBytes(canonicalize(body), privateKey)
  return { ...body, proof: { alg: 'ES256', issuer, signedAt: now, signature } }
}

/**
 * Verifies the signature with a trusted public key. A key carried inside the document
 * is never trusted: the caller always supplies it from the trust registry.
 * Any error counts as invalid (fail-closed).
 */
export async function verify<T extends object>(document: Signed<T> | undefined, trustedKey: JsonWebKey | undefined): Promise<boolean> {
  if (!document?.proof || !trustedKey) return false
  try {
    const { proof, ...body } = document
    if (proof.alg !== 'ES256') return false
    const key = await crypto.subtle.importKey('jwk', trustedKey, KEY_ALGORITHM, false, ['verify'])
    return await crypto.subtle.verify(SIGN_ALGORITHM, key, fromBase64Url(proof.signature), encoder.encode(canonicalize(body)))
  } catch {
    return false
  }
}
