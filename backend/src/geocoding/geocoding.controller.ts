import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { GeocodeSearchDto } from './dto/geocode-search.dto';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';
import {
  COUNTRY_CODE_ALPHA2,
  GEOCODING_PROVIDER,
  GeocodeSuggestion,
  GeocodingProvider,
  type SupportedCountryCode,
} from './geocoding-provider.interface';

@ApiTags('geocoding')
@ApiBearerAuth()
@Controller('geocoding')
export class GeocodingController {
  constructor(
    @Inject(GEOCODING_PROVIDER)
    private readonly geocoder: GeocodingProvider,
  ) {}

  /**
   * Address type-ahead for the order-creation and address-search screens.
   *
   * Authenticated like every other endpoint: an open geocoding proxy is an
   * open relay to whatever upstream provider is configured, billed or
   * rate-limited against this platform's account.
   *
   * The country defaults to the caller's own. A user creating a delivery is in
   * one country, `country_configs` prices per country, and an unfiltered
   * search for "Accra" returns matches on three continents -- one of which,
   * picked by a tired thumb, produces a quote nobody can explain. An explicit
   * `countryCode` still wins, so an admin or a border case can override it.
   */
  @Get('search')
  @ApiOperation({
    summary: 'Address suggestions for a partial query, scoped to one country.',
  })
  search(
    @CurrentUser() user: AuthUser,
    @Query() query: GeocodeSearchDto,
  ): Promise<GeocodeSuggestion[]> {
    const countryCode: SupportedCountryCode | undefined =
      query.countryCode ?? COUNTRY_CODE_ALPHA2[user.countryCode];

    return this.geocoder.search({
      text: query.q,
      countryCode,
      language: query.language,
      limit: query.limit,
    });
  }

  /**
   * A position turned back into an address, for "use my position".
   *
   * The apps have a coordinate from the device and need something a human can
   * read: an order whose pickup is a bare lat/lng shows the driver a map pin
   * where an address belongs, and support reading a complaint later has
   * nothing to go on.
   *
   * The response keeps the *requested* coordinate, not the matched feature's
   * centroid -- see the providers. The order is priced and routed from where
   * the user actually is; the address is a label for it.
   */
  @Get('reverse')
  @ApiOperation({ summary: 'The address at a position, or null when none is known.' })
  reverse(@Query() query: ReverseGeocodeDto): Promise<GeocodeSuggestion | null> {
    return this.geocoder.reverse({
      lat: query.lat,
      lng: query.lng,
      language: query.language,
    });
  }
}
