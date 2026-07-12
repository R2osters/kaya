import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: '123 Oxford Street, Accra Central' })
  @IsString()
  @MaxLength(500)
  pickupAddress!: string;

  @ApiProperty({ example: 5.6037 })
  @Type(() => Number)
  @IsLatitude()
  pickupLat!: number;

  @ApiProperty({ example: -0.187 })
  @Type(() => Number)
  @IsLongitude()
  pickupLng!: number;

  @ApiProperty({ example: '45 Airport Road, East Legon' })
  @IsString()
  @MaxLength(500)
  deliveryAddress!: string;

  @ApiProperty({ example: 5.6346 })
  @Type(() => Number)
  @IsLatitude()
  deliveryLat!: number;

  @ApiProperty({ example: -0.1664 })
  @Type(() => Number)
  @IsLongitude()
  deliveryLng!: number;

  @ApiPropertyOptional({ example: 'Shoe box, about 2kg' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'URL of the package photo (uploaded separately).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  packagePhoto?: string;

  @ApiPropertyOptional({ example: 2.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  weightKg?: number;

  @ApiPropertyOptional({ example: '30x20x15' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  dimensions?: string;

  @ApiPropertyOptional({
    example: null,
    description: 'ISO-8601 future time for a scheduled order; null/omitted = immediate.',
  })
  @IsOptional()
  @IsISO8601()
  scheduledTime?: string;
}
