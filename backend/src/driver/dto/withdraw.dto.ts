import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsObject, IsPositive } from 'class-validator';
import { WithdrawalMethod } from '@prisma/client';

export class WithdrawDto {
  @ApiProperty({ example: 150.0, description: 'Amount to withdraw (<= balance).' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: WithdrawalMethod, example: WithdrawalMethod.momo })
  @IsEnum(WithdrawalMethod)
  method!: WithdrawalMethod;

  @ApiProperty({
    description: 'Destination details.',
    example: { phone: '+233201234567', provider: 'mtn' },
  })
  @IsObject()
  accountDetails!: Record<string, unknown>;
}
