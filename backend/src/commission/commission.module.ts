import { Global, Module } from '@nestjs/common';
import { CommissionService } from './commission.service';
import { CommissionScheduler } from './commission.scheduler';

/** Commission calculation + local-midnight daily reset. Global so settlement can use it. */
@Global()
@Module({
  providers: [CommissionService, CommissionScheduler],
  exports: [CommissionService],
})
export class CommissionModule {}
