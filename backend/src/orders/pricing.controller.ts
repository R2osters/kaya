import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CountryCode } from '@prisma/client';
import { PricingService } from '../pricing/pricing.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

/** GET /api/v1/calculate-price (Architecture doc §3.3). */
@ApiTags('pricing')
@ApiBearerAuth()
@Controller('calculate-price')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  @ApiOperation({ summary: 'Estimate distance and minimum price for a route.' })
  async calculate(@CurrentUser() user: AuthUser, @Query() query: CalculatePriceDto) {
    const country = (query.countryCode ?? user.countryCode) as CountryCode;
    const quote = await this.pricing.quote(
      country,
      { lat: query.pickupLat, lng: query.pickupLng },
      { lat: query.deliveryLat, lng: query.deliveryLng },
    );
    return {
      countryCode: country,
      distanceKm: Number(quote.distanceKm),
      minPrice: Number(quote.minPrice),
      currency: quote.currency,
      currencySymbol: quote.currencySymbol,
      pricePerKm: Number(quote.pricePerKm),
      basePickupFee: Number(quote.basePickupFee),
      durationMin: quote.durationMin,
      source: quote.source,
    };
  }
}
