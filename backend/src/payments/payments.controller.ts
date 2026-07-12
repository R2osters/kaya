import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { AppConfigService } from '../config/app-config.service';
import { InitializePaymentDto, RefundPaymentDto, VerifyPaymentDto } from './dto/payment.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: AppConfigService,
  ) {}

  @Post('initialize')
  @Roles(Role.client)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize an escrow payment for a delivery (returns checkout URL).' })
  initialize(@CurrentUser('id') clientId: string, @Body() dto: InitializePaymentDto) {
    return this.payments.initialize(clientId, dto.deliveryId);
  }

  @Post('verify')
  @Roles(Role.client)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a payment; moves funds into escrow on success.' })
  verify(@CurrentUser('id') clientId: string, @Body() dto: VerifyPaymentDto) {
    return this.payments.verify(clientId, dto.reference);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') paystackSig?: string,
    @Headers('x-kkiapay-signature') kkiapaySig?: string,
  ) {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) {
      throw new BadRequestException('Missing raw request body.');
    }
    // Infer provider from the signature header present (else the mock gateway).
    const provider = paystackSig ? 'paystack' : kkiapaySig ? 'kkiapay' : 'mock';
    // Unsigned webhooks must never reach the mock gateway in production.
    if (provider === 'mock' && this.config.isProduction) {
      throw new BadRequestException('Missing gateway signature.');
    }
    return this.payments.handleWebhook(provider, raw, paystackSig ?? kkiapaySig);
  }

  @Public()
  @Post('webhook/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  webhookForProvider(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') paystackSig?: string,
    @Headers('x-kkiapay-signature') kkiapaySig?: string,
  ) {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) {
      throw new BadRequestException('Missing raw request body.');
    }
    return this.payments.handleWebhook(provider, raw, paystackSig ?? kkiapaySig);
  }

  @Public()
  @Post('mock/complete/:reference')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dev only: simulate the gateway completing a payment.' })
  mockComplete(
    @Param('reference') reference: string,
    @Query('success') success?: string,
  ) {
    if (this.config.isProduction) {
      throw new NotFoundException();
    }
    return this.payments.completeMock(reference, success !== 'false');
  }

  @Post('refund')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund held escrow to the client (admin).' })
  refund(@CurrentUser('id') adminId: string, @Body() dto: RefundPaymentDto) {
    return this.payments.refund(dto.deliveryId, adminId, dto.reason);
  }
}
