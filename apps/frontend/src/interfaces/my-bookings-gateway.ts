import type { MyBooking } from '@/entities/my-booking'

export interface MyBookingsGateway {
  load(): Promise<MyBooking[]>
}
