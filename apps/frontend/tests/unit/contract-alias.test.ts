import { describe, expect, expectTypeOf, it } from 'vitest'
import { LoginBody, type BookingDto, type CourseDto, type RefundReportDto, type RosterRowDto } from '@contract'
import type { Course } from '@/entities/course'
import type { MyBooking } from '@/entities/my-booking'
import type { CourseRosterRow } from '@/entities/course-roster'
import type { RefundReport } from '@/entities/payment-system'

describe('@contract alias', () => {
  it('resolves and parses a valid LoginBody', () => {
    expect(LoginBody.parse({ email: 'a@b.co', password: 'pw' })).toEqual({ email: 'a@b.co', password: 'pw' })
  })

  it('DTO types equal the frontend entity types', () => {
    expectTypeOf<CourseDto>().toEqualTypeOf<Course>()
    expectTypeOf<BookingDto>().toEqualTypeOf<MyBooking>()
    expectTypeOf<RosterRowDto>().toEqualTypeOf<CourseRosterRow>()
    expectTypeOf<RefundReportDto>().toEqualTypeOf<RefundReport>()
  })
})
