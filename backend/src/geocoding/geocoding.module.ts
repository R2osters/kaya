import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { GeocodingController } from './geocoding.controller';
import { GEOCODING_PROVIDER } from './geocoding-provider.interface';
import { PhotonProvider } from './providers/photon.provider';
import { StaticGeocodingProvider } from './providers/static.provider';

/**
 * Provides the active GeocodingProvider (selected by GEOCODING_PROVIDER env).
 *
 * Default is `photon`: keyless, built for type-ahead, and it degrades to the
 * static landmark list when unreachable -- so a checkout of this repo can
 * search addresses with no account anywhere, and a geocoder outage does not
 * dead-end order creation. `static` forces the offline list, which is what
 * tests and an air-gapped demo want.
 */
@Global()
@Module({
  controllers: [GeocodingController],
  providers: [
    StaticGeocodingProvider,
    PhotonProvider,
    {
      provide: GEOCODING_PROVIDER,
      inject: [AppConfigService, PhotonProvider, StaticGeocodingProvider],
      useFactory: (
        config: AppConfigService,
        photon: PhotonProvider,
        staticProvider: StaticGeocodingProvider,
      ): PhotonProvider | StaticGeocodingProvider =>
        config.get('GEOCODING_PROVIDER') === 'static' ? staticProvider : photon,
    },
  ],
  exports: [GEOCODING_PROVIDER],
})
export class GeocodingModule {}
