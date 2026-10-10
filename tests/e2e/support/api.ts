import { API_URL, PASSWORD, PNG } from './env'

// Arranges preconditions through the real API, as the users themselves would.

export interface Session {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

type Envelope<T> = { success: true; data: T } | { success: false; message: string }

export async function api<T>(method: string, path: string, { token, body }: { token?: string; body?: unknown } = {}) {
  const raw = body instanceof Buffer
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': raw ? 'image/png' : 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : raw ? new Uint8Array(body) : JSON.stringify(body),
  })
  const envelope = (await response.json()) as Envelope<T>
  if (!envelope.success) throw new Error(`${method} ${path}: ${response.status} ${envelope.message}`)
  return envelope.data
}

export const apiLogin = (email: string) => api<Session>('POST', '/auth/login', { body: { email, password: PASSWORD } })

export const email = (account: string) => `${account}@seatsure.test`

/** A schedule a week from now, one hour long. */
export function schedule(daysAhead = 7) {
  const startsAt = new Date(Date.now() + daysAhead * 86_400_000)
  startsAt.setUTCMinutes(0, 0, 0)
  const endsAt = new Date(startsAt.getTime() + 3_600_000)
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }
}

/** teacher1 submits the course and admin01 approves it, which opens registration. */
export async function createApprovedCourse(title: string, capacity: number, price = 1500) {
  const teacher = await apiLogin(email('teacher1'))
  const course = await api<{ id: string }>('POST', '/courses', {
    token: teacher.accessToken,
    body: { title, description: 'สร้างโดยชุดทดสอบ e2e', capacity, price, ...schedule() },
  })
  const admin01 = await apiLogin(email('admin01'))
  await api('POST', `/courses/${course.id}/approval`, { token: admin01.accessToken, body: { approved: true } })
  return course
}

export const book = (token: string, courseId: string, studentName: string) =>
  api<{ id: string }>('POST', '/bookings', { token, body: { courseId, studentName } })

/** Books a seat, attaches a proof image and confirms the transfer: the booking ends up paid. */
export async function bookAndPay(token: string, courseId: string, studentName: string) {
  const booking = await book(token, courseId, studentName)
  await api('PUT', `/bookings/${booking.id}/proof`, { token, body: PNG })
  await api('POST', `/bookings/${booking.id}/confirm-payment`, { token })
  return booking
}
