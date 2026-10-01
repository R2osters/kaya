import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class InitializePaymentDto {
  @ApiProperty({ description: 'The accepted delivery to pay for.' })
  @IsUUID()
  deliveryId!: string;

  @ApiPropertyOptional({
    description:
      'Deep link the hosted checkout redirects to when the user is done ' +
      '(e.g. kayaclient://payment/return). Hosted checkouts need somewhere ' +
      'to send the user back to; without it the mock checkout page shows a ' +
      '"return to the app" dead end.',
    example: 'kayaclient://payment/return',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  callbackUrl?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'The payment reference returned by initialize.' })
  @IsString()
  @MinLength(6)
  reference!: string;
}

export class RefundPaymentDto {
  @ApiProperty({ description: 'The delivery whose held escrow to refund.' })
  @IsUUID()
  deliveryId!: string;

  @ApiPropertyOptional({ example: 'Dispute resolved in client favor' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
