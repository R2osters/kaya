import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsLatitude, IsLongitude, IsOptional } from 'class-validator';
import { CountryCode } from '@prisma/client';

/** Query params for GET /calculate-price. */
export class CalculatePriceDto {
  @ApiProperty({ example: 5.6037 })
  @Type(() => Number)
  @IsLatitude()
  pickupLat!: number;

  @ApiProperty({ example: -0.187 })
  @Type(() => Number)
  @IsLongitude()
  pickupLng!: number;

  @ApiProperty({ example: 5.6346 })
  @Type(() => Number)
  @IsLatitude()
  deliveryLat!: number;

  @ApiProperty({ example: -0.1664 })
  @Type(() => Number)
  @IsLongitude()
  deliveryLng!: number;

  @ApiPropertyOptional({
    enum: CountryCode,
    description: "Defaults to the caller's country when omitted.",
  })
  @IsOptional()
  @IsEnum(CountryCode)
  countryCode?: CountryCode;
}
