import type { SupabaseClient } from '@supabase/supabase-js'
import type { Actor } from '../../entities/actor'
import type { ProofStorage } from '../../interfaces/proof-storage'

const BUCKET = 'payment-proofs'

/** The `payment-proofs` bucket, used as the actor: its policies allow only paths under `<user id>/`. */
export function createSupabaseProofStorage(clientFor: (actor: Actor) => SupabaseClient): ProofStorage {
  return {
    async upload(actor, path, file) {
      const { error } = await clientFor(actor).storage.from(BUCKET).upload(path, file.bytes, { contentType: file.contentType })
      if (error) throw new Error(`proof upload failed: ${error.message}`)
    },

    async remove(actor, paths) {
      const { error } = await clientFor(actor).storage.from(BUCKET).remove(paths)
      if (error) throw new Error(`proof removal failed: ${error.message}`)
    },
  }
}
