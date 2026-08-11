import { Global, Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { DriversNearbyController } from './drivers-nearby.controller';

@Global()
@Module({
  controllers: [DriversNearbyController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
