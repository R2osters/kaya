import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('offers')
@ApiBearerAuth()
@Controller()
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Post('orders/:orderId/offers')
  @Roles(Role.livreur)
  @ApiOperation({ summary: 'Submit a price offer on an order (driver).' })
  create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser('id') livreurId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offers.createOffer(orderId, livreurId, dto);
  }

  @Get('orders/:orderId/offers')
  @Roles(Role.client)
  @ApiOperation({ summary: 'List offers received on an order (client).' })
  list(@Param('orderId', ParseUUIDPipe) orderId: string, @CurrentUser() user: AuthUser) {
    return this.offers.listOffers(orderId, user);
  }

  @Post('offers/:id/accept')
  @Roles(Role.client)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an offer; locks the order and creates the delivery.' })
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') clientId: string) {
    return this.offers.acceptOffer(id, clientId);
  }

  @Post('offers/:id/reject')
  @Roles(Role.client)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending offer.' })
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') clientId: string) {
    return this.offers.rejectOffer(id, clientId);
  }
}
