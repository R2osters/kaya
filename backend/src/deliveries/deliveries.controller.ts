import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DeliveriesService } from './deliveries.service';
import { CancelDeliveryDto, DeliveryPhotoDto } from './dto/delivery-photo.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('deliveries')
@ApiBearerAuth()
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  @ApiOperation({ summary: 'List my deliveries (as client or driver).' })
  list(@CurrentUser() user: AuthUser) {
    return this.deliveries.listForUser(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Delivery detail (participant or admin).' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.deliveries.findOne(id, user);
  }

  @Post(':id/start')
  @Roles(Role.livreur)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver starts the run (order -> driver_en_route).' })
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') driverId: string) {
    return this.deliveries.start(id, driverId);
  }

  @Post(':id/pickup')
  @Roles(Role.livreur)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver confirms pickup (order -> picked_up).' })
  pickup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') driverId: string,
    @Body() dto: DeliveryPhotoDto,
  ) {
    return this.deliveries.pickup(id, driverId, dto.photoUrl);
  }

  @Post(':id/transit')
  @Roles(Role.livreur)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver departs for drop-off (order -> in_transit).' })
  transit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') driverId: string) {
    return this.deliveries.transit(id, driverId);
  }

  @Post(':id/confirm-delivery')
  @Roles(Role.livreur)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver confirms delivery (order -> delivered) and settles escrow.' })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') driverId: string,
    @Body() dto: DeliveryPhotoDto,
  ) {
    return this.deliveries.confirmDelivery(id, driverId, dto.photoUrl);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a delivery (participant); refunds held escrow.' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelDeliveryDto,
  ) {
    return this.deliveries.cancel(id, user, dto.reason);
  }

  @Post(':id/dispute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open a dispute (participant); freezes escrow for admin review.' })
  dispute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelDeliveryDto,
  ) {
    return this.deliveries.dispute(id, user, dto.reason);
  }
}
