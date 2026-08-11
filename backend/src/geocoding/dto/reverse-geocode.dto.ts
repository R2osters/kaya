import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsOptional } from 'class-validator';

/** Query params for GET /geocoding/reverse. */
export class ReverseGeocodeDto {
  @ApiProperty({ example: 5.5606, description: 'Latitude of the position to name.' })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: -0.1824, description: 'Longitude of the position to name.' })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ enum: ['fr', 'en'], description: 'Label language.' })
  @IsOptional()
  @IsIn(['fr', 'en'])
  language?: 'fr' | 'en';
}
