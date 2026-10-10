import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../frontend/src/lib/database.types'

export type Client = SupabaseClient<Database>
type Role = Database['public']['Enums']['user_role']

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }

/** Bypasses row level security. For arranging and inspecting data only. */
export const admin: Client = createClient<Database>(url, serviceKey, clientOptions)

/** A visitor who has not signed in. */
export const visitor = (): Client => createClient<Database>(url, anonKey, clientOptions)

export interface TestUser {
  id: string
  client: Client
}

const PASSWORD = 'test-password-123'
const runId = randomUUID().slice(0, 8)
let sequence = 0
const created = { users: [] as string[], courses: [] as string[], proofs: [] as string[] }

export async function createUser(role: Role = 'parent'): Promise<TestUser> {
  const n = ++sequence
  const email = `test-${runId}-${n}@seatsure.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Test ${role} ${n}` },
  })
  if (error) throw error
  const id = data.user.id
  created.users.push(id)

  if (role !== 'parent') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', id)
    if (roleError) throw roleError
  }

  const client = visitor()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInError) throw signInError
  return { id, client }
}

export const createUsers = (count: number, role: Role = 'parent') =>
  Promise.all(Array.from({ length: count }, () => createUser(role)))

export async function createCourse(options: {
  capacity: number
  teacherId?: string
  registrationOpen?: boolean
}) {
  const { data, error } = await admin
    .from('courses')
    .insert({
      title: `Test course ${runId}-${++sequence}`,
      capacity: options.capacity,
      price: 1500,
      teacher_id: options.teacherId ?? null,
      registration_open: options.registrationOpen ?? true,
    })
    .select()
    .single()
  if (error) throw error
  created.courses.push(data.id)
  return data
}

export const book = (user: TestUser, courseId: string) =>
  user.client.rpc('book_seat', { p_course_id: courseId, p_student_name: 'นักเรียนทดสอบ' })

/** Retired: card payment is off, only bank transfer with a proof image is accepted. */
export const pay = (user: TestUser, bookingId: string, idempotencyKey: string = randomUUID()) =>
  user.client.rpc('pay_booking', { p_booking_id: bookingId, p_idempotency_key: idempotencyKey })

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

/** Uploads a proof image and records it for the booking, as the parent would. */
export async function attachProof(user: TestUser, bookingId: string) {
  const path = `${user.id}/${bookingId}.png`
  const { error: uploadError } = await user.client.storage.from('payment-proofs').upload(path, PNG, { contentType: 'image/png' })
  if (uploadError) throw new Error(`proof upload failed: ${uploadError.message}`)
  created.proofs.push(path)
  const { error } = await user.client.from('payment_proofs').insert({ booking_id: bookingId, proof_path: path })
  if (error) throw new Error(`proof insert failed: ${error.message}`)
}

/** The parent presses "confirm payment". */
export const confirmPayment = (user: TestUser, bookingId: string) =>
  user.client.rpc('confirm_transfer_payment', { p_booking_id: bookingId })

/** Books a seat and returns the booking, failing the test if the booking is refused. */
export async function mustBook(user: TestUser, courseId: string) {
  const { data, error } = await book(user, courseId)
  if (error) throw new Error(`book_seat failed: ${error.message}`)
  return data
}

/** Makes a hold look as if its 10 minutes ran out a minute ago. */
export async function expireHold(bookingId: string) {
  const { error } = await admin
    .from('bookings')
    .update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', bookingId)
  if (error) throw error
}

/** Seats in use right now: paid bookings plus holds that have not run out. */
export async function seatsTaken(courseId: string) {
  const { data, error } = await admin.rpc('seats_taken', { p_course_id: courseId })
  if (error) throw error
  return data
}

export async function getBooking(bookingId: string) {
  const { data, error } = await admin.from('bookings').select().eq('id', bookingId).single()
  if (error) throw error
  return data
}

export async function paymentsFor(bookingId: string) {
  const { data, error } = await admin.from('payments').select().eq('booking_id', bookingId)
  if (error) throw error
  return data
}

/** Removes everything this test file created. Payments and bookings go first (no cascade). */
export async function cleanup() {
  if (created.courses.length > 0) {
    const { data: bookings } = await admin.from('bookings').select('id').in('course_id', created.courses)
    const bookingIds = (bookings ?? []).map((b) => b.id)
    if (bookingIds.length > 0) {
      await admin.from('payment_proofs').delete().in('booking_id', bookingIds)
      await admin.from('payments').delete().in('booking_id', bookingIds)
      await admin.from('bookings').delete().in('id', bookingIds)
    }
    await admin.from('courses').delete().in('id', created.courses)
  }
  if (created.proofs.length > 0) await admin.storage.from('payment-proofs').remove(created.proofs)
  await Promise.all(created.users.map((id) => admin.auth.admin.deleteUser(id)))
}
