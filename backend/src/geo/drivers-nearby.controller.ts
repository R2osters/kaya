import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CountryCode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { GeoService } from './geo.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

export class DriversNearbyDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  radiusKm?: number;
}

/** Default search radius, in km. Matches the client map's opening viewport. */
const DEFAULT_RADIUS_KM = 8;

/**
 * A pin has to have moved within this many minutes to be shown.
 *
 * `is_online` is a flag a driver can leave set by closing the app on a dying
 * battery. A pin that has not moved in three hours makes the city look busier
 * than it is, which is the one lie a marketplace map must not tell: a client
 * who sees six drivers and waits an hour for a bid learns not to trust the
 * screen.
 */
const FRESH_WITHIN_MINUTES = 10;

/**
 * Live driver positions around a point, for the client's map.
 *
 * This is what makes the home screen mean something before an order exists.
 * A map with nothing on it says the platform is empty; the same map with four
 * moving pins says there is work being done nearby, which is the single most
 * useful thing a client can know before deciding to order.
 *
 * Positions only, deliberately -- no id, no name, no vehicle type. See
 * `GeoService.findOnlineDriverPositionsNearby` for why: an id here would turn
 * a "is anyone around" endpoint into one that follows a named person across
 * the city.
 *
 * Scoped to the caller's own country: the query filters on it, so a request
 * with coordinates in another country simply comes back empty rather than
 * leaking the shape of another market's supply.
 */
@ApiTags('geo')
@ApiBearerAuth()
@Controller('drivers')
export class DriversNearbyController {
  constructor(private readonly geo: GeoService) {}

  @Get('nearby')
  @ApiOperation({ summary: 'Positions of online drivers near a point (no identity).' })
  async nearby(@CurrentUser() user: AuthUser, @Query() query: DriversNearbyDto) {
    const drivers = await this.geo.findOnlineDriverPositionsNearby(
      query.lat,
      query.lng,
      query.radiusKm ?? DEFAULT_RADIUS_KM,
      user.countryCode as CountryCode,
      FRESH_WITHIN_MINUTES,
    );
    return { drivers };
  }
}
