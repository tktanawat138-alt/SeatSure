import type { Actor } from '../entities/actor'
import type { ProofFile } from '../entities/payment'

/** Proof image objects, stored as the actor. Paths start with the actor's id. */
export interface ProofStorage {
  upload(actor: Actor, path: string, file: ProofFile): Promise<void>
  remove(actor: Actor, paths: string[]): Promise<void>
}
