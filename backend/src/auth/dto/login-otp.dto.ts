import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class LoginOtpDto {
  @ApiProperty({ example: '+233201234567', description: 'E.164 phone number' })
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format' })
  phone!: string;

  @ApiProperty({ description: 'Firebase Phone Auth ID token proving ownership of `phone`.' })
  @IsString()
  @MinLength(20)
  firebaseIdToken!: string;
}
