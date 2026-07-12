import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'livreur@example.com',
    description: 'Email address OR E.164 phone number.',
  })
  @IsString()
  @MinLength(3)
  identifier!: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
