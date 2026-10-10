/** The signed-in account, as `GET /me` returns it. */
export interface CurrentUser {
  id: string
  email: string
  fullName: string
  role: 'parent' | 'teacher' | 'admin'
}
