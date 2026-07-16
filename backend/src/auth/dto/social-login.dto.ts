import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({ description: 'Firebase ID token from a Google/Facebook sign-in.' })
  @IsString()
  @MinLength(20)
  firebaseIdToken!: string;

  @ApiProperty({ enum: ['google', 'facebook'] })
  @IsIn(['google', 'facebook'])
  provider!: 'google' | 'facebook';
}
