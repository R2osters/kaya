import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CountryCode, DeliveryStatus, OrderStatus, Role } from '@prisma/client';

class Pagination {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ListUsersDto extends Pagination {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: CountryCode })
  @IsOptional()
  @IsEnum(CountryCode)
  countryCode?: CountryCode;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class ListOrdersAdminDto extends Pagination {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class ListDeliveriesAdminDto extends Pagination {
  @ApiPropertyOptional({ enum: DeliveryStatus })
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;
}

export class SuspendUserDto {
  @ApiPropertyOptional({ default: true, description: 'true = suspend, false = reactivate.' })
  @IsOptional()
  @IsBoolean()
  suspend?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export enum WithdrawalAction {
  approve = 'approve',
  reject = 'reject',
}

export class ProcessWithdrawalDto {
  @ApiProperty({ enum: WithdrawalAction })
  @IsEnum(WithdrawalAction)
  action!: WithdrawalAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export enum DisputeOutcome {
  refund_client = 'refund_client',
  release_driver = 'release_driver',
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: DisputeOutcome })
  @IsEnum(DisputeOutcome)
  outcome!: DisputeOutcome;

  @ApiPropertyOptional({ description: 'Resolution note (audit).' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    description: 'Optional client indemnity drawn from the litigation fund (capped by balance).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  indemnity?: number;
}

export class UpdateCountryConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  pricePerKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  basePickupFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionTier1?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionTier2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionTier3?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionTier4?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  litigationFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  searchRadiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scheduledPublishBufferMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reminderBeforeMin?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  withdrawalMethods?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  momoProviders?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
