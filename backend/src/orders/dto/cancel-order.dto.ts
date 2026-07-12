import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Changed my mind' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
