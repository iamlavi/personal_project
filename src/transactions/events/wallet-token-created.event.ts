export class WalletTokenCreatedEvent {
  constructor(
    readonly walletId: string,
    readonly customerId: string,
    readonly tokenId: string,
    readonly expiresAt: Date | null,
  ) {}
}
