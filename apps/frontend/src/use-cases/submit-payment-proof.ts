import { DomainError } from '@/entities/domain-error'
import type { PaymentProofGateway } from '@/interfaces/payment-proof-gateway'

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maximumSize = 5 * 1024 * 1024

export function createSubmitPaymentProof(gateway: PaymentProofGateway) {
  const submit = async (input: { userId: string; bookingId: string; file: File }) => {
    if (!acceptedTypes.has(input.file.type)) throw new DomainError('proof_type_invalid')
    if (input.file.size > maximumSize) throw new DomainError('proof_size_exceeded')
    await gateway.save(input)
  }
  return submit
}

export function createConfirmPaymentProof(gateway: PaymentProofGateway) {
  return (bookingId: string) => gateway.confirm(bookingId)
}
