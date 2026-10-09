import { useEffect, useState } from 'react'
import type { Booking } from './supabase'

const bahtFormat = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
})

export const baht = (amount: number) => bahtFormat.format(amount)

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

const errorMessages: Record<string, string> = {
  course_full: 'คอร์สนี้เต็มแล้ว',
  registration_closed: 'คอร์สนี้ปิดรับสมัครแล้ว',
  already_booked: 'คุณจองคอร์สนี้ไว้แล้ว ดูได้ที่หน้า "การจองของฉัน"',
  student_name_required: 'กรุณากรอกชื่อผู้เรียน',
  already_paid: 'การจองนี้ชำระเงินแล้ว ไม่มีการเก็บเงินซ้ำ',
  booking_not_found: 'ไม่พบการจองนี้',
  capacity_below_booked: 'ลดจำนวนรับให้ต่ำกว่าที่นั่งที่จองไปแล้วไม่ได้',
  not_authenticated: 'กรุณาเข้าสู่ระบบก่อน',
  duplicate_request: 'คำขอนี้กำลังดำเนินการอยู่ รอสักครู่แล้วโหลดหน้านี้ใหม่',
  'Invalid login credentials': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
}

export const errorText = (error: { message: string }) =>
  errorMessages[error.message] ?? `ทำรายการไม่สำเร็จ (${error.message})`

/** A hold only counts while its time has not run out. */
export const holdIsLive = (booking: Pick<Booking, 'status' | 'hold_expires_at'>, now: number) =>
  booking.status === 'held' && new Date(booking.hold_expires_at).getTime() > now

/** A seat is in use by a paid booking or a live hold. */
export const holdsSeat = (booking: Pick<Booking, 'status' | 'hold_expires_at'>, now: number) =>
  booking.status === 'paid' || holdIsLive(booking, now)

export type Tone = 'ok' | 'warn' | 'bad' | 'muted'

export function bookingStatus(
  booking: Pick<Booking, 'status' | 'hold_expires_at'>,
  now: number,
): { text: string; tone: Tone } {
  if (booking.status === 'paid') return { text: 'ชำระแล้ว', tone: 'ok' }
  if (holdIsLive(booking, now)) return { text: 'รอชำระเงิน', tone: 'warn' }
  if (booking.status === 'cancelled') return { text: 'ยกเลิกแล้ว', tone: 'muted' }
  return { text: 'หมดเวลาชำระเงิน', tone: 'muted' }
}

/** Current time, refreshed every second, for hold countdowns. */
export function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function countdown(untilIso: string, now: number) {
  const seconds = Math.max(0, Math.floor((new Date(untilIso).getTime() - now) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
