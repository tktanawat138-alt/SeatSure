import type { CourseRosterGateway } from '@/interfaces/course-roster-gateway'
import type { CourseRosterRow } from '@/entities/course-roster'
import { supabase } from '@/lib/supabase'

export const courseRosterGateway: CourseRosterGateway = {
  async load(courseId) {
    const { data, error } = await supabase.from('bookings')
      .select('*, profiles(full_name), payments(*)')
      .eq('course_id', courseId)
      .order('created_at')
    if (error) throw error
    if (!data.length) return []
    const { data: proofs, error: proofError } = await supabase.from('payment_proofs')
      .select('*').in('booking_id', data.map((row) => row.id))
    if (proofError) throw proofError
    const proofViews = await Promise.all((proofs ?? []).map(async (proof) => {
      const { data: signed } = await supabase.storage.from('payment-proofs').createSignedUrl(proof.proof_path, 600)
      return { ...proof, signed_url: signed?.signedUrl ?? null }
    }))
    return data.map((row) => ({
      ...row,
      payment_proofs: proofViews.filter((proof) => proof.booking_id === row.id),
    })) as CourseRosterRow[]
  },
}
