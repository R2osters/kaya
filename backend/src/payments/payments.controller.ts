import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
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
import { renderMockCheckoutPage } from './mock-checkout.page';
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
  initialize(
    @CurrentUser('id') clientId: string,
    @Body() dto: InitializePaymentDto,
    @Req() req: Request,
  ) {
    // The mock gateway's checkout page is served by this backend, and the URL
    // for it must be one *the paying device* can open. This machine's idea of
    // itself (localhost) is wrong from an emulator or a phone on the LAN; the
    // Host header of the request that just arrived is, by construction, an
    // address that device can reach.
    const publicBaseUrl = `${req.protocol}://${req.get('host') ?? 'localhost:3000'}`;
    return this.payments.initialize(clientId, dto.deliveryId, {
      callbackUrl: dto.callbackUrl,
      publicBaseUrl,
    });
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
  @Get('mock/checkout/:reference')
  @Header('Content-Type', 'text/html; charset=utf-8')
  // Helmet's app-wide CSP says script-src 'self', which silently kills this
  // page's inline script -- the buttons rendered and did nothing. Overridden
  // here, and only here, with a policy that allows exactly what the page is:
  // inline style + inline script + same-origin fetch, everything else 'none'.
  @Header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
      "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  )
  @ApiOperation({ summary: 'Dev only: the mock gateway hosted checkout page.' })
  async mockCheckout(@Param('reference') reference: string, @Query('redirect') redirect?: string) {
    if (this.config.isProduction) {
      throw new NotFoundException();
    }
    const view = await this.payments.mockCheckout(reference);
    return renderMockCheckoutPage({ ...view, redirect });
  }

  @Public()
  @Post('mock/complete/:reference')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dev only: simulate the gateway completing a payment.' })
  mockComplete(@Param('reference') reference: string, @Query('success') success?: string) {
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
