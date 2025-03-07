import { UnknownStripePriceId } from '../const/err'

export async function turnstileAuth(ip: string, token: string, serverKey: string): Promise<void> {
  let formData = new FormData()
  formData.append('secret', serverKey)
  formData.append('response', token)
  formData.append('remoteip', ip)
  formData.append('idempotency_key', crypto.randomUUID())
  if (!token) throw UnknownStripePriceId()
  const resp = (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    body: formData,
    method: 'POST'
  })) as Response

  if (!resp.ok) {
    throw UnknownStripePriceId()
  }

  const data = await resp.json()
  if (!data.success) {
    throw UnknownStripePriceId()
  }
}
