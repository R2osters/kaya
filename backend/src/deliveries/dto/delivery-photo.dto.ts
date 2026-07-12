import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Optional photo URL for pickup / delivery confirmation (uploaded separately). */
export class DeliveryPhotoDto {
  @ApiPropertyOptional({ description: 'URL of the pickup/delivery photo.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
}

export class CancelDeliveryDto {
  @ApiPropertyOptional({ example: 'Client unreachable' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
