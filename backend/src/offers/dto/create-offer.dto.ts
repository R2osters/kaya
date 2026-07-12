import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsPositive, Max } from 'class-validator';

export class CreateOfferDto {
  @ApiProperty({ example: 25.0, description: 'Proposed price; must be >= the order minimum.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000)
  proposedPrice!: number;
}
