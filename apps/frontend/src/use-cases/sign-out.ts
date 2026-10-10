import type { AuthGateway } from '@/interfaces/auth-gateway'

export function createSignOut(gateway: AuthGateway) {
  return () => gateway.signOut()
}
