import { z } from 'zod'
import { PaymentSystemDto, RefundReportDto } from '../contract'
import type { Endpoint } from './types'

const unauthenticated = { status: 401, code: 'not_authenticated', description: 'Missing, invalid or expired access token.' }
const forbidden = { status: 403, code: 'forbidden', description: 'Only the admin may read payments.' }
const bookingNotFound = {
  status: 404,
  code: 'booking_not_found',
  description: 'No booking with this id belongs to the caller (someone else\'s booking and a malformed id count as unknown).',
}
const notPayable = { status: 400, code: 'booking_not_payable', description: 'The booking is not `held` (cancelled or expired; a paid booking takes no new proof).' }

/** The raw image bytes of the request body. */
const ProofImage = z.any().describe('The image file itself, at most 5 MiB. Content-Type must be image/jpeg, image/png or image/webp.')

export const paymentsEndpoints: Endpoint[] = [
  {
    method: 'put',
    path: '/bookings/:id/proof',
    operationId: 'submitProof',
    summary: 'Upload a bank-transfer proof',
    description: [
      'The parent sends the transfer slip as the raw request body, with `Content-Type` set to exactly one of `image/jpeg`, `image/png` or `image/webp`. Not multipart, not JSON. The media type below reads `image/*` only because the spec lists one; other image types such as `image/gif` are rejected.',
      '',
      '- Only the owner of the booking may upload, and only while the booking is `held`. The booking hold lasts 7 days from booking.',
      '- The image is stored privately at `<user id>/<booking id>-<uuid>.<jpg|png|webp>`. Uploading does not pay: the booking stays `held` until `confirmPayment`.',
      '- Uploading again replaces the earlier proof: the same proof record points at the new image and the old image is deleted, so a booking has at most one stored proof.',
      '- If recording the proof fails after the image was stored, the image is deleted again.',
      '- Any other content type is `proof_type_invalid` (HTTP 400). A body over 5 MiB (5,242,880 bytes) is `proof_size_exceeded` (HTTP 413). An empty body is `payment_proof_required`. Nothing is stored in these cases.',
    ].join('\n'),
    tag: 'Payments',
    auth: 'any',
    request: { body: ProofImage, contentType: 'image/*' },
    response: null,
    errors: [
      unauthenticated,
      { status: 400, code: 'proof_type_invalid', description: 'The body is not `image/jpeg`, `image/png` or `image/webp`.' },
      { status: 413, code: 'proof_size_exceeded', description: 'The body is larger than 5 MiB.' },
      { status: 400, code: 'payment_proof_required', description: 'The body is empty.' },
      bookingNotFound,
      notPayable,
    ],
  },
  {
    method: 'post',
    path: '/bookings/:id/confirm-payment',
    operationId: 'confirmPayment',
    summary: 'Confirm the bank transfer',
    description: [
      'The parent presses "confirm payment" after uploading a proof. No request body.',
      '',
      '- Only the owner of the booking may confirm. The booking must be `held` and have a stored proof image.',
      '- On success the booking becomes `paid` and exactly one payment is recorded for the course price, with a receipt number `RC-YYYYMMDD-nnnnnn`.',
      '- Idempotent: confirming a booking that is already paid succeeds and charges nothing more, also when several confirms arrive at once.',
      '- Confirm and course cancellation are serialized on the course: if the course is cancelled first the confirm is refused (`booking_not_payable`, or `course_cancelled`); if the confirm wins, the cancel reports the new payment for refund.',
      '- Card payment is retired; bank transfer with a proof is the only way to pay.',
    ].join('\n'),
    tag: 'Payments',
    auth: 'any',
    response: null,
    errors: [
      unauthenticated,
      bookingNotFound,
      { status: 400, code: 'booking_not_payable', description: 'The booking is cancelled or expired.' },
      { status: 400, code: 'payment_proof_required', description: 'No proof image has been uploaded for the booking.' },
      { status: 400, code: 'course_cancelled', description: 'The course of the booking is cancelled.' },
    ],
  },
  {
    method: 'get',
    path: '/admin/payments',
    operationId: 'paymentOverview',
    summary: 'Payment overview for the admin',
    description: [
      'Admin only. Returns every approved course, cancelled ones included, with its seat count (`courses`, oldest first) and every refund report (`refunds`, newest first).',
      '',
      'A refund report is written when a course with paid bookings is cancelled; it names the account to refund and the receipt.',
    ].join('\n'),
    tag: 'Payments',
    auth: ['admin'],
    response: PaymentSystemDto,
    errors: [unauthenticated, forbidden],
  },
  {
    method: 'get',
    path: '/admin/refunds',
    operationId: 'listRefunds',
    summary: 'Refund reports',
    description: 'Admin only. Every refund report, newest first. Each one is a paid booking of a cancelled course that must be refunded by bank transfer.',
    tag: 'Payments',
    auth: ['admin'],
    response: z.array(RefundReportDto),
    errors: [unauthenticated, forbidden],
  },
]
