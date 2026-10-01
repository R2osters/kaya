import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersController } from './orders.controller';
import { PricingController } from './pricing.controller';
import { CountryConfigsController } from './country-configs.controller';
import { OrdersService } from './orders.service';
import { OrdersScheduler } from './orders.scheduler';

@Module({
  imports: [PricingModule],
  controllers: [OrdersController, PricingController, CountryConfigsController],
  providers: [OrdersService, OrdersScheduler],
  exports: [OrdersService],
})
export class OrdersModule {}
