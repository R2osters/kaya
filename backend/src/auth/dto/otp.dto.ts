import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpPurpose } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

export class OtpSendDto {
  @ApiPropertyOptional({ example: '+233201234567', description: 'E.164 phone number' })
  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format' })
  phone?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: OtpPurpose, example: OtpPurpose.phone_verification })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}

export class OtpVerifyDto extends OtpSendDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 10)
  code!: string;
}
