import { describe, expect, it } from 'vitest'
import { errorText } from '@/lib/format'

describe('errorText', () => {
  it.each([
    ['course_full', 'คอร์สนี้เต็มแล้ว'],
    ['already_booked', 'คุณจองคอร์สนี้ไว้แล้ว ดูได้ที่หน้า "การจองของฉัน"'],
    ['booking_not_found', 'ไม่พบการจองนี้'],
    ['forbidden', 'คุณไม่มีสิทธิ์ทำรายการนี้'],
    ['invalid_course_schedule', 'วันเวลาเรียนไม่ถูกต้อง เวลาสิ้นสุดต้องหลังเวลาเริ่ม'],
    ['course_not_found', 'ไม่พบคอร์สนี้'],
    ['proof_type_invalid', 'เลือกไฟล์ JPG, PNG หรือ WebP'],
    ['proof_size_exceeded', 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB'],
  ])('maps %s to its Thai text', (code, text) => {
    expect(errorText({ message: code })).toBe(text)
  })

  it('falls back to the raw code for an unknown error', () => {
    expect(errorText({ message: 'something_new' })).toBe('ทำรายการไม่สำเร็จ (something_new)')
  })
})
