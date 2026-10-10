import { Router } from 'express'
import { z } from 'zod'
import type { BookingRepository } from '../../interfaces/booking-repository'
import { createBookings } from '../../use-cases/bookings'
import { BookSeatBody, type ActiveBookingDto, type BookingDto, type Envelope, type RosterRowDto } from './contract'
import { actorOf, type RequireAuth } from './guard'

/** Ports the bookings use cases need. */
export interface BookingsDeps {
  bookingRepository: BookingRepository
}

// An empty or blank name is a domain error (student_name_required), not a schema error,
// so the route accepts any string and leaves the rule to the use case.
const BookSeatInput = BookSeatBody.extend({ studentName: z.string() })

export function bookingsRoutes(deps: BookingsDeps, requireAuth: RequireAuth): Router {
  const bookings = createBookings(deps.bookingRepository)
  const router = Router()

  router.post('/bookings', requireAuth(), async (req, res) => {
    const body: Envelope<BookingDto> = { success: true, data: await bookings.bookSeat(actorOf(req), BookSeatInput.parse(req.body)) }
    res.status(201).json(body)
  })

  // Registered before /bookings/:id so "mine" and "active" are not read as ids.
  router.get('/bookings/mine', requireAuth(), async (req, res) => {
    const body: Envelope<BookingDto[]> = { success: true, data: await bookings.myBookings(actorOf(req)) }
    res.json(body)
  })

  router.get('/bookings/active', requireAuth(), async (req, res) => {
    const body: Envelope<ActiveBookingDto[]> = { success: true, data: await bookings.activeBookings(actorOf(req)) }
    res.json(body)
  })

  router.get('/bookings/:id', requireAuth(), async (req, res) => {
    const body: Envelope<BookingDto> = { success: true, data: await bookings.getBooking(actorOf(req), req.params.id as string) }
    res.json(body)
  })

  router.get('/courses/:id/roster', requireAuth(['teacher', 'admin']), async (req, res) => {
    const body: Envelope<RosterRowDto[]> = { success: true, data: await bookings.courseRoster(actorOf(req), req.params.id as string) }
    res.json(body)
  })

  return router
}
