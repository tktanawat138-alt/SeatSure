export interface PaymentProofGateway {
  save(input: { userId: string; bookingId: string; file: File }): Promise<void>
  confirm(bookingId: string): Promise<void>
}
