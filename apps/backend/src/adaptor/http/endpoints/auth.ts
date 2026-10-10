import { LoginBody, Me, RefreshBody, Session } from '../contract'
import type { Endpoint } from './types'

export const authEndpoints: Endpoint[] = [
  {
    method: 'post',
    path: '/auth/login',
    operationId: 'login',
    summary: 'Sign in with email and password',
    description:
      'Returns a session. Send `accessToken` as `Authorization: Bearer <token>` on every other call, and use `refreshToken` with `POST /auth/refresh` when the access token expires. `expiresAt` is epoch seconds. Throttled sign-ins answer `429` instead of `401`.',
    tag: 'Auth',
    auth: 'public',
    request: { body: LoginBody },
    response: Session,
    errors: [
      { status: 401, code: 'Invalid login credentials', description: 'Wrong email or password.' },
      { status: 429, code: 'rate_limited', description: 'Too many sign-in attempts; try again later.' },
    ],
  },
  {
    method: 'post',
    path: '/auth/refresh',
    operationId: 'refreshSession',
    summary: 'Exchange a refresh token for a new session',
    description:
      'Returns a fresh session (a new access token and a new refresh token). The old refresh token should not be reused.',
    tag: 'Auth',
    auth: 'public',
    request: { body: RefreshBody },
    response: Session,
    errors: [
      { status: 401, code: 'not_authenticated', description: 'The refresh token is invalid, expired or already used.' },
      { status: 429, code: 'rate_limited', description: 'Refresh was throttled; try again later.' },
    ],
  },
  {
    method: 'post',
    path: '/auth/logout',
    operationId: 'logout',
    summary: 'Sign out',
    description: 'Ends this session on the server, so its access and refresh tokens stop working. Other devices stay signed in.',
    tag: 'Auth',
    auth: 'any',
    response: null,
    errors: [{ status: 401, code: 'not_authenticated' }],
  },
  {
    method: 'get',
    path: '/me',
    operationId: 'getMe',
    summary: 'Get the signed-in user',
    description: 'Returns the id, email, full name and role of the token owner.',
    tag: 'Auth',
    auth: 'any',
    response: Me,
    errors: [
      {
        status: 401,
        code: 'not_authenticated',
        description: 'Missing, invalid or expired token, or the account has no profile.',
      },
    ],
  },
]
