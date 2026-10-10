import { backendEnv } from './env'

// Service-role access to PostgREST and Storage over plain fetch, for arranging and cleaning up
// test data. Bypasses row level security.

async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, serviceKey } = backendEnv()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
      ...init.headers,
    },
  })
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`)
  const text = await response.text()
  return (text ? JSON.parse(text) : null) as T
}

const inList = (ids: string[]) => `in.(${ids.join(',')})`

async function removeProofObjects(paths: string[]) {
  if (paths.length === 0) return
  const { url, serviceKey } = backendEnv()
  await fetch(`${url}/storage/v1/object/payment-proofs`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  })
}

/** Deletes bookings with their refund reports, proofs (rows and images) and payments. No cascades exist. */
export async function deleteBookings(bookingIds: string[]) {
  if (bookingIds.length === 0) return
  const ids = inList(bookingIds)
  const proofs = await rest<{ proof_path: string }[]>(`payment_proofs?select=proof_path&booking_id=${ids}`)
  await rest(`refund_reports?booking_id=${ids}`, { method: 'DELETE' })
  await rest(`payment_proofs?booking_id=${ids}`, { method: 'DELETE' })
  await rest(`payments?booking_id=${ids}`, { method: 'DELETE' })
  await rest(`bookings?id=${ids}`, { method: 'DELETE' })
  await removeProofObjects(proofs.map((p) => p.proof_path))
}

/** Deletes the courses and everything that hangs off them. */
export async function deleteCourses(courseIds: string[]) {
  if (courseIds.length === 0) return
  const ids = inList(courseIds)
  const bookings = await rest<{ id: string }[]>(`bookings?select=id&course_id=${ids}`)
  await deleteBookings(bookings.map((b) => b.id))
  await rest(`refund_reports?course_id=${ids}`, { method: 'DELETE' })
  await rest(`courses?id=${ids}`, { method: 'DELETE' })
}

export async function courseIdsByTitlePrefix(prefix: string) {
  const rows = await rest<{ id: string }[]>(`courses?select=id&title=like.${encodeURIComponent(`${prefix}*`)}`)
  return rows.map((r) => r.id)
}

/** Removes every course whose title starts with `prefix`, with its bookings, payments, proofs and refunds. */
export async function cleanupByTitlePrefix(prefix: string) {
  await deleteCourses(await courseIdsByTitlePrefix(prefix))
}
