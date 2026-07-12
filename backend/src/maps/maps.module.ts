import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { DISTANCE_PROVIDER } from './distance-provider.interface';
import { HaversineProvider } from './providers/haversine.provider';
import { GoogleMapsProvider } from './providers/google-maps.provider';

/**
 * Provides the active DistanceProvider (selected by MAPS_PROVIDER). Global so
 * pricing and orders can inject DISTANCE_PROVIDER anywhere.
 */
@Global()
@Module({
  providers: [
    HaversineProvider,
    GoogleMapsProvider,
    {
      provide: DISTANCE_PROVIDER,
      inject: [AppConfigService, HaversineProvider, GoogleMapsProvider],
      useFactory: (
        config: AppConfigService,
        haversine: HaversineProvider,
        google: GoogleMapsProvider,
      ) => (config.get('MAPS_PROVIDER') === 'google' ? google : haversine),
    },
  ],
  exports: [DISTANCE_PROVIDER],
})
export class MapsModule {}
