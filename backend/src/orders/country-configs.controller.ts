import { Controller, Get, NotFoundException, Param, ParseEnumPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CountryCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-only country configuration: tariffs, commission tiers, litigation fee,
 * search radius, withdrawal methods.
 *
 * It existed only behind `PUT /admin/country-config/:code` -- writable by an
 * admin, readable by nobody. That is a gap the driver app's bid screen ran
 * into: it shows what a proposed price leaves after commission, and both
 * inputs to that (the tier table and the litigation fee) live in this row.
 * Without a read the app would have to hardcode 20/15/12/9 % and a 1 GHS fee,
 * which the project's own rules forbid for the reason that matters -- the
 * moment Togo's tiers diverge from Ghana's, a hardcoded preview would quietly
 * disagree with the ledger the driver is actually paid from.
 *
 * Authenticated but not role-restricted: this is the tariff card of a public
 * marketplace, not user data, and both apps need it. No `updatedAt`/`updatedBy`
 * audit columns are exposed -- who last changed the tariffs is an admin
 * concern.
 */
@ApiTags('country-configs')
@ApiBearerAuth()
@Controller('country-configs')
export class CountryConfigsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Every active country configuration.' })
  async list() {
    const rows = await this.prisma.countryConfig.findMany({ orderBy: { countryCode: 'asc' } });
    return rows.map(serialize);
  }

  @Get(':code')
  @ApiOperation({ summary: 'One country configuration.' })
  async findOne(@Param('code', new ParseEnumPipe(CountryCode)) code: CountryCode) {
    const row = await this.prisma.countryConfig.findUnique({ where: { countryCode: code } });
    if (!row) {
      throw new NotFoundException('Country configuration not found.');
    }
    return serialize(row);
  }
}

type CountryConfigRow = Awaited<ReturnType<PrismaService['countryConfig']['findUniqueOrThrow']>>;

/**
 * Decimal columns go out as numbers, matching every other money-shaped
 * response in this API (`calculate-price`, `driver/stats`). @kaya/core's
 * `countryConfigSchema` coerces either way, but sending a Prisma Decimal
 * object would serialise as a string and make the two endpoints disagree
 * about the same tier for no reason.
 */
function serialize(row: CountryConfigRow) {
  return {
    countryCode: row.countryCode,
    countryName: row.countryName,
    currencyCode: row.currencyCode,
    currencySymbol: row.currencySymbol,
    pricePerKm: Number(row.pricePerKm),
    basePickupFee: Number(row.basePickupFee),
    commissionTier1: Number(row.commissionTier1),
    commissionTier2: Number(row.commissionTier2),
    commissionTier3: Number(row.commissionTier3),
    commissionTier4: Number(row.commissionTier4),
    litigationFee: Number(row.litigationFee),
    searchRadiusKm: row.searchRadiusKm,
    withdrawalMethods: row.withdrawalMethods,
    momoProviders: row.momoProviders,
  };
}
