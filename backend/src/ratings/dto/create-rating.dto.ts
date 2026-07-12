import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({ description: 'The user being rated (the other participant).' })
  @IsUUID()
  toUserId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @ApiPropertyOptional({ example: 'Fast and careful delivery, thank you!' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
