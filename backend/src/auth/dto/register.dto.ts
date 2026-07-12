import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CountryCode, VehicleType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Roles a user may self-register as (admin is never self-assignable). */
export enum RegisterRole {
  client = 'client',
  livreur = 'livreur',
  both = 'both',
}

export class RegisterDto {
  @ApiProperty({ example: 'livreur@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+233201234567', description: 'E.164 phone number' })
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format, e.g. +233201234567' })
  phone!: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt hard limit
  password!: string;

  @ApiProperty({
    description: 'Firebase Phone Auth ID token proving ownership of `phone`.',
  })
  @IsString()
  @MinLength(20)
  firebaseIdToken!: string;

  @ApiProperty({ example: 'Kofi Mensah' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName!: string;

  @ApiPropertyOptional({ example: 28 })
  @IsOptional()
  @IsInt()
  @Min(18)
  age?: number;

  @ApiProperty({ enum: RegisterRole, example: RegisterRole.livreur })
  @IsEnum(RegisterRole)
  role!: RegisterRole;

  @ApiProperty({ enum: CountryCode, example: CountryCode.GHA })
  @IsEnum(CountryCode)
  countryCode!: CountryCode;

  @ApiPropertyOptional({ example: 'Accra' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  // --- Driver fields (required/validated per country when role includes livreur) ---

  @ApiPropertyOptional({
    example: 'PCSRC-2024-001234',
    description: 'Driver license/registration number (country-specific format).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  driverLicenseNumber?: string;

  @ApiPropertyOptional({
    description: 'Ghana only: scanned PCSRC QR code (data URL or reference).',
  })
  @IsOptional()
  @IsString()
  driverQrCode?: string;

  @ApiPropertyOptional({ enum: VehicleType, example: VehicleType.moto })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ example: 'GR-1234-19' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicleRegistration?: string;
}
