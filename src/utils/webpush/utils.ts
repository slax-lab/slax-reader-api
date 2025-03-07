export const stringFromArrayBuffer = (s: ArrayBuffer) => {
  let result = ''
  for (const code of new Uint8Array(s)) result += String.fromCharCode(code)

  return result
}

export const base64UrlEncode = (s: string | ArrayBuffer) => {
  const text = typeof s === 'string' ? s : stringFromArrayBuffer(s)

  return btoa(text).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export const base64UrlDecodeString = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)

export const base64UrlDecode = (s: string) =>
  new Uint8Array(
    atob(base64UrlDecodeString(s))
      .split('')
      .map(char => char.charCodeAt(0))
  ).buffer

export const concatTypedArrays = (arrays: Uint8Array[]) => {
  const length = arrays.reduce((accumulator, current) => accumulator + current.byteLength, 0)

  let index = 0
  const targetArray = new Uint8Array(length)
  for (const array of arrays) {
    targetArray.set(array, index)
    index += array.byteLength
  }

  return targetArray
}

export const getPublicKeyFromJwk = (jwk: JsonWebKey) => base64UrlEncode('\x04' + atob(base64UrlDecodeString(jwk.x!)) + atob(base64UrlDecodeString(jwk.y!)))
