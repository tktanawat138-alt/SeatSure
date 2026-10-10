import { authEndpoints } from './auth'
import { bookingsEndpoints } from './bookings'
import { coursesEndpoints } from './courses'
import { paymentsEndpoints } from './payments'
import type { Endpoint } from './types'

export type { Endpoint } from './types'

/** Every public operation of the API. Each group owns its own file. */
export const endpoints: Endpoint[] = [
  ...authEndpoints,
  ...coursesEndpoints,
  ...bookingsEndpoints,
  ...paymentsEndpoints,
]
