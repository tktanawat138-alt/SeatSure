import type { AppDeps } from '../../../src/app'
import { fakeAuthProvider } from './fake-auth-provider'

/** A port nobody faked: any method call fails loudly instead of silently returning nothing. */
const unfaked = (port: string) =>
  new Proxy({}, { get: (_t, method) => () => { throw new Error(`port "${port}" was not faked (called ${String(method)})`) } })

/**
 * Full `AppDeps` for API tests. Pass only the ports the test exercises; every other port throws
 * if a route reaches it, so a test cannot pass by accident through an unfaked dependency.
 */
export function fakeAppDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const base = { frontendOrigin: 'http://localhost:5173', authProvider: fakeAuthProvider(), ...overrides }
  return new Proxy(base, {
    get: (target, prop) => (prop in target ? target[prop as keyof typeof target] : unfaked(String(prop))),
  }) as AppDeps
}
