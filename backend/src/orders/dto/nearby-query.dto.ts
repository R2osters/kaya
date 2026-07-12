import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Query params for GET /orders/nearby. Location defaults to the driver's last
 * known position; radius defaults to the country's search_radius_km.
 */
export class NearbyQueryDto {
  @ApiPropertyOptional({ example: 5.6037, description: 'Overrides stored driver latitude.' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: -0.187, description: 'Overrides stored driver longitude.' })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ example: 5, description: 'Search radius in km (default from country config).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  radiusKm?: number;
}
