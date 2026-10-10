import express, { Router, type ErrorRequestHandler, type RequestHandler } from 'express'
import { z } from 'zod'
import { DomainError } from '../../entities/domain-error'
import { PROOF_TYPES } from '../../entities/payment'
import type { PaymentRepository } from '../../interfaces/payment-repository'
import type { ProofStorage } from '../../interfaces/proof-storage'
import { createPayments } from '../../use-cases/payments'
import type { Envelope, PaymentSystemDto, RefundReportDto } from './contract'
import { actorOf, type RequireAuth } from './guard'

/** Ports the payments use cases need. */
export interface PaymentsDeps {
  paymentRepository: PaymentRepository
  proofStorage: ProofStorage
}

const BookingParams = z.object({ id: z.uuid() })

// The limit matches MAX_PROOF_BYTES ('5mb' is 5 * 1024 * 1024 bytes). Only these three types are
// read; any other body stays unparsed and the use case answers proof_type_invalid.
const proofBody = express.raw({ type: [...PROOF_TYPES], limit: '5mb' })

/** A proof over the limit is 413 proof_size_exceeded, in the usual failure envelope. */
const proofTooLarge: ErrorRequestHandler = (err, _req, res, next) => {
  const tooLarge = err?.type === 'entity.too.large' || (err instanceof DomainError && err.code === 'proof_size_exceeded')
  if (!tooLarge) return next(err)
  const body: Envelope<never> = { success: false, message: 'proof_size_exceeded' }
  res.status(413).json(body)
}

const done: Envelope<null> = { success: true, data: null }

export function paymentsRoutes(deps: PaymentsDeps, requireAuth: RequireAuth): Router {
  const payments = createPayments(deps)
  const router = Router()

  const submitProof: RequestHandler = async (req, res) => {
    const { id } = BookingParams.parse(req.params)
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    const contentType = req.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
    await payments.submitProof(actorOf(req), id, { contentType, bytes })
    res.json(done)
  }
  router.put('/bookings/:id/proof', requireAuth(), proofBody, submitProof, proofTooLarge)

  router.post('/bookings/:id/confirm-payment', requireAuth(), async (req, res) => {
    const { id } = BookingParams.parse(req.params)
    await payments.confirmPayment(actorOf(req), id)
    res.json(done)
  })

  router.get('/admin/payments', requireAuth(['admin']), async (req, res) => {
    const body: Envelope<PaymentSystemDto> = { success: true, data: await payments.paymentOverview(actorOf(req)) }
    res.json(body)
  })

  router.get('/admin/refunds', requireAuth(['admin']), async (req, res) => {
    const body: Envelope<RefundReportDto[]> = { success: true, data: await payments.refunds(actorOf(req)) }
    res.json(body)
  })

  return router
}
