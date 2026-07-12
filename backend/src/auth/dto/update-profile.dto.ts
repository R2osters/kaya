import { ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Editable profile fields. Immutable identity fields (email, phone, role,
 * countryCode, verification status) are intentionally excluded.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Kofi Mensah' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(18)
  age?: number;

  @ApiPropertyOptional({ example: 'Kumasi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ enum: VehicleType })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ example: 'GR-1234-19' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicleRegistration?: string;

  @ApiPropertyOptional({ description: 'Firebase Cloud Messaging device token.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fcmToken?: string;
}
