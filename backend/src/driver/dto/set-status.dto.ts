import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetStatusDto {
  @ApiProperty({ example: true, description: 'Whether the driver is accepting work.' })
  @IsBoolean()
  online!: boolean;
}
