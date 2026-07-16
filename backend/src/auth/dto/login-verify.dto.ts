import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginVerifyDto {
  @ApiProperty({ description: 'challengeId returned by POST /auth/login' })
  @IsString()
  challengeId!: string;

  @ApiProperty({ description: 'Firebase ID token proving the phone or email 2FA channel.' })
  @IsString()
  @MinLength(20)
  firebaseIdToken!: string;
}
