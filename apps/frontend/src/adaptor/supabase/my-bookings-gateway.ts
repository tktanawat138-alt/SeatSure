import type { MyBookingsGateway } from '@/interfaces/my-bookings-gateway'
import { supabase } from '@/lib/supabase'

export const myBookingsGateway: MyBookingsGateway = {
  async load() {
    const [bookingResult, proofResult] = await Promise.all([
      supabase.from('bookings').select('*, courses(title, price), payments(*)').order('created_at', { ascending: false }),
      supabase.from('payment_proofs').select('*'),
    ])
    if (bookingResult.error) throw bookingResult.error
    if (proofResult.error) throw proofResult.error
    return bookingResult.data.map((booking) => ({
      ...booking,
      payment_proofs: (proofResult.data ?? []).filter((proof) => proof.booking_id === booking.id),
    }))
  },
}
