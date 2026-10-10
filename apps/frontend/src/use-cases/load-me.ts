import type { AuthGateway } from '@/interfaces/auth-gateway'

export function createLoadMe(gateway: AuthGateway) {
  return () => gateway.me()
}
