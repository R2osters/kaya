import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** At least one of messageText / imageUrl must be provided (checked in service). */
export class SendMessageDto {
  @ApiPropertyOptional({ example: 'I am at the pickup point.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  messageText?: string;

  @ApiPropertyOptional({ description: 'URL of an image (uploaded separately).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;
}
