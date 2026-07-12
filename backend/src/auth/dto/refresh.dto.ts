import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'The opaque refresh token issued at login.' })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'Refresh token to revoke.' })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}
