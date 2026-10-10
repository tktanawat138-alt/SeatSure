import { DomainError } from '@/entities/domain-error'
import type { PaymentsGateway } from '@/interfaces/payments-gateway'

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maximumSize = 5 * 1024 * 1024

/** Checks type and size before uploading. `userId` is ignored: the API takes the user from the token. */
export function createSubmitPaymentProof(gateway: Pick<PaymentsGateway, 'submitProof'>) {
  const submit = async (input: { userId?: string; bookingId: string; file: File }) => {
    if (!acceptedTypes.has(input.file.type)) throw new DomainError('proof_type_invalid')
    if (input.file.size > maximumSize) throw new DomainError('proof_size_exceeded')
    await gateway.submitProof(input.bookingId, input.file)
  }
  return submit
}

export function createConfirmPaymentProof(gateway: Pick<PaymentsGateway, 'confirm'>) {
  return (bookingId: string) => gateway.confirm(bookingId)
}
