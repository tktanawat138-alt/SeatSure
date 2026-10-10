export type Role = 'parent' | 'teacher' | 'admin'

/** The signed-in user a request acts as. `token` is the bearer token it came with. */
export interface Actor {
  id: string
  email: string
  role: Role
  token: string
}
