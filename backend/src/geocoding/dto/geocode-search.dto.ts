import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
  SUPPORTED_COUNTRY_CODES,
  type SupportedCountryCode,
} from '../geocoding-provider.interface';

/** Query params for GET /geocoding/search. */
export class GeocodeSearchDto {
  @ApiProperty({
    example: 'Osu Accra',
    description: 'Partial address text. Fewer than 2 characters returns nothing.',
  })
  @IsString()
  @MinLength(2)
  // A geocoder query longer than this is not a search, and an unbounded string
  // on a public endpoint is a free amplification vector against whatever
  // upstream provider is configured.
  @MaxLength(120)
  q!: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_COUNTRY_CODES,
    description:
      'Restricts results to one country. Apps always send it -- an unfiltered "Accra" returns places on three continents.',
  })
  @IsOptional()
  @IsIn(SUPPORTED_COUNTRY_CODES)
  countryCode?: SupportedCountryCode;

  @ApiPropertyOptional({ enum: ['fr', 'en'], description: 'Label language.' })
  @IsOptional()
  @IsIn(['fr', 'en'])
  language?: 'fr' | 'en';

  @ApiPropertyOptional({ example: 5, description: 'Max results (1-10).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
