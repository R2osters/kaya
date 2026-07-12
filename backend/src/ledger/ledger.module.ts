import { Global, Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';

/** Append-only financial ledger + litigation fund. Global. */
@Global()
@Module({
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
