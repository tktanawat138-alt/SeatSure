import type { AuthGateway } from '@/interfaces/auth-gateway'

export function createSignIn(gateway: AuthGateway) {
  return (email: string, password: string) => gateway.signIn(email, password)
}
