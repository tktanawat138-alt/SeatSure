/** A business rule said no. `code` is the stable string the API sends as `message`. */
export class DomainError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'DomainError'
  }
}
