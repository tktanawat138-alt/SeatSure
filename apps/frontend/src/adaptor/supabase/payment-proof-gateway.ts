import type { PaymentProofGateway } from '@/interfaces/payment-proof-gateway'
import { supabase } from '@/lib/supabase'

export const paymentProofGateway: PaymentProofGateway = {
  async save({ userId, bookingId, file }) {
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${userId}/${bookingId}-${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type })
    if (uploadError) throw uploadError
    const { data: existing, error: lookupError } = await supabase.from('payment_proofs').select('id, proof_path').eq('booking_id', bookingId).maybeSingle()
    if (lookupError) {
      await supabase.storage.from('payment-proofs').remove([path])
      throw lookupError
    }
    const save = existing
      ? supabase.from('payment_proofs').update({ proof_path: path, submitted_at: new Date().toISOString() }).eq('id', existing.id)
      : supabase.from('payment_proofs').insert({ booking_id: bookingId, proof_path: path })
    const { error: saveError } = await save
    if (saveError) {
      await supabase.storage.from('payment-proofs').remove([path])
      throw saveError
    }
    if (existing) await supabase.storage.from('payment-proofs').remove([existing.proof_path])
  },
  async confirm(bookingId) {
    const { error } = await supabase.rpc('confirm_transfer_payment', { p_booking_id: bookingId })
    if (error) throw error
  },
}
