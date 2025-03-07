import { createJwt } from './jwt'
import type { PushOptions, PushSubscription, PushSubscriptionKey } from './types'
import { base64UrlDecode, concatTypedArrays, base64UrlEncode, getPublicKeyFromJwk, base64UrlDecodeString } from './utils'

const importClientKeys = async (keys: PushSubscriptionKey) => {
  const auth = base64UrlDecode(keys.auth)
  if (auth.byteLength !== 16) {
    throw new Error(`incorrect auth length, expected 16 bytes got ${auth.byteLength}`)
  }

  const key = atob(base64UrlDecodeString(keys.p256dh))
  const p256 = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: base64UrlEncode(key.slice(1, 33)),
      y: base64UrlEncode(key.slice(33, 65)),
      ext: true
    },
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    []
  )

  return { auth, p256 }
}

const deriveSharedSecret = async (clientPublicKey: CryptoKey, localPrivateKey: CryptoKey) => {
  const sharedSecretBytes = await crypto.subtle.deriveBits(
    // @ts-expect-error typescript says it should be $public, but it doesn't work
    { name: 'ECDH', public: clientPublicKey },
    localPrivateKey,
    256
  )

  // Now that we have our bits we need to convert them into a key, in this
  // case a HKDF one:
  // https://en.wikipedia.org/wiki/HKDF

  return crypto.subtle.importKey('raw', sharedSecretBytes, { name: 'HKDF' }, false, ['deriveBits', 'deriveKey'])
}

const derivePsuedoRandomKey = async (auth: ArrayBuffer, sharedSecret: CryptoKey) => {
  const pseudoRandomKeyBytes = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: auth,
      // Adding Content-Encoding data info here is required by the Web
      // Push API
      info: new TextEncoder().encode('Content-Encoding: auth\0')
    },
    sharedSecret,
    256
  )

  return crypto.subtle.importKey('raw', pseudoRandomKeyBytes, 'HKDF', false, ['deriveBits'])
}

const createContext = async (clientPublicKey: CryptoKey, localPublicKey: CryptoKey) => {
  const [clientKeyBytes, localKeyBytes] = (await Promise.all([crypto.subtle.exportKey('raw', clientPublicKey), crypto.subtle.exportKey('raw', localPublicKey)])) as [
    ArrayBuffer,
    ArrayBuffer
  ]

  return concatTypedArrays([
    new TextEncoder().encode('P-256\0'),
    new Uint8Array([0, clientKeyBytes.byteLength]),
    new Uint8Array(clientKeyBytes),
    new Uint8Array([0, localKeyBytes.byteLength]),
    new Uint8Array(localKeyBytes)
  ])
}

const deriveNonce = async (pseudoRandomKey: CryptoKey, salt: ArrayBuffer, context: Uint8Array) => {
  const nonceInfo = concatTypedArrays([new TextEncoder().encode('Content-Encoding: nonce\0'), context])

  return crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: nonceInfo }, pseudoRandomKey, 12 * 8)
}

const deriveContentEncryptionKey = async (pseudoRandomKey: CryptoKey, salt: Uint8Array, context: Uint8Array) => {
  const cekInfo = concatTypedArrays([new TextEncoder().encode('Content-Encoding: aesgcm\0'), context])

  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: cekInfo }, pseudoRandomKey, 16 * 8)

  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt'])
}

const padPayload = (payload: Uint8Array) => {
  // Web push payloads have an overall max size of 4KB (4096 bytes). With the
  // required overhead for encryption etc our actual max payload size is 4078.
  // https://developers.google.com/web/updates/2016/03/web-push-encryption

  const MAX_PAYLOAD_SIZE = 4078

  let paddingSize = Math.round(Math.random() * 100)
  // +2 here because we use 2 bytes to indicate padding length, that's also
  // included
  const payloadSizeWithPadding = payload.byteLength + 2 + paddingSize

  if (payloadSizeWithPadding > MAX_PAYLOAD_SIZE) {
    // is our payload now too large with padding added? If so, trim down the
    // padding so it fits
    paddingSize -= payloadSizeWithPadding - MAX_PAYLOAD_SIZE
  }

  const paddingArray = new ArrayBuffer(2 + paddingSize)
  // The first 2 bytes of the array are used to store the overall length of
  // padding, so let's store that:
  new DataView(paddingArray).setUint16(0, paddingSize)

  // Then return our new payload with padding added:
  return concatTypedArrays([new Uint8Array(paddingArray), payload])
}

const encryptPayload = async (localKeys: CryptoKeyPair, salt: Uint8Array, payload: string, target: PushSubscription) => {
  const clientKeys = await importClientKeys(target.keys)

  const sharedSecret = await deriveSharedSecret(clientKeys.p256, localKeys.privateKey)
  const pseudoRandomKey = await derivePsuedoRandomKey(clientKeys.auth, sharedSecret)

  const context = await createContext(clientKeys.p256, localKeys.publicKey)
  const nonce = await deriveNonce(pseudoRandomKey, salt, context)
  const contentEncryptionKey = await deriveContentEncryptionKey(pseudoRandomKey, salt, context)

  const encodedPayload = new TextEncoder().encode(payload)
  const paddedPayload = padPayload(encodedPayload)

  return crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, contentEncryptionKey, paddedPayload)
}

const buildHeaders = async (options: PushOptions, payloadLength: number, salt: Uint8Array, localPublicKey: CryptoKey) => {
  const localPublicKeyBase64 = await crypto.subtle.exportKey('raw', localPublicKey).then(bytes => base64UrlEncode(bytes as ArrayBuffer))
  const serverPublicKey = getPublicKeyFromJwk(options.jwk)
  const jwt = await createJwt(options.jwk, options.jwt)

  const headers = new Headers({
    Encryption: `salt=${base64UrlEncode(salt)}`,
    'Crypto-Key': `dh=${localPublicKeyBase64}`,
    'Content-Length': payloadLength.toString(),
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aesgcm',
    Authorization: `vapid t=${jwt}, k=${serverPublicKey}`
  })

  if (options.ttl !== undefined) headers.append('TTL', options.ttl.toString())
  if (options.topic !== undefined) headers.append('Topic', options.topic)
  if (options.urgency !== undefined) headers.append('Urgency', options.urgency)

  return headers
}

export const buildRequest = async (options: PushOptions, target: PushSubscription): Promise<globalThis.Request> => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const localKeys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair

  const encryptedPayload = await encryptPayload(localKeys, salt, options.payload, target)

  const headers = await buildHeaders(options, encryptedPayload.byteLength, salt, localKeys.publicKey)

  return new Request(target.endpoint, {
    body: encryptedPayload,
    headers,
    method: 'POST'
  })
}

export * from './types'
export { getPublicKeyFromJwk } from './utils'
