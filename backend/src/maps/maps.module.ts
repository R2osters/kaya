import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { DISTANCE_PROVIDER } from './distance-provider.interface';
import { HaversineProvider } from './providers/haversine.provider';
import { GoogleMapsProvider } from './providers/google-maps.provider';
import { OsrmProvider } from './providers/osrm.provider';

/**
 * Provides the active DistanceProvider (selected by MAPS_PROVIDER). Global so
 * pricing and orders can inject DISTANCE_PROVIDER anywhere.
 *
 * The default stays haversine so a checkout of this repo runs with no external
 * dependency at all. It is the least accurate of the three and the choice is
 * a pricing one -- see osrm.provider.ts for the measured error.
 */
@Global()
@Module({
  providers: [
    HaversineProvider,
    OsrmProvider,
    GoogleMapsProvider,
    {
      provide: DISTANCE_PROVIDER,
      inject: [AppConfigService, HaversineProvider, OsrmProvider, GoogleMapsProvider],
      useFactory: (
        config: AppConfigService,
        haversine: HaversineProvider,
        osrm: OsrmProvider,
        google: GoogleMapsProvider,
      ): HaversineProvider | OsrmProvider | GoogleMapsProvider => {
        switch (config.get('MAPS_PROVIDER')) {
          case 'google':
            return google;
          case 'osrm':
            return osrm;
          default:
            return haversine;
        }
      },
    },
  ],
  exports: [DISTANCE_PROVIDER],
})
export class MapsModule {}
