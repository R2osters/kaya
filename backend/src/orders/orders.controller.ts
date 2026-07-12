import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CountryCode, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Roles(Role.client)
  @ApiOperation({ summary: 'Create an order (immediate or scheduled). Computes min price.' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, user.countryCode as CountryCode, dto);
  }

  @Get()
  @Roles(Role.client)
  @ApiOperation({ summary: 'List my orders (paginated, filterable by status).' })
  findMine(@CurrentUser('id') clientId: string, @Query() query: ListOrdersDto) {
    return this.orders.findMine(clientId, query);
  }

  // Declared before :id so "nearby" is not captured as an order id.
  @Get('nearby')
  @Roles(Role.livreur)
  @ApiOperation({ summary: 'Published orders near the driver (PostGIS radius search).' })
  nearby(@CurrentUser() user: AuthUser, @Query() query: NearbyQueryDto) {
    return this.orders.nearby(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Order detail (owner client or admin).' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.orders.findOne(id, user);
  }

  @Put(':id')
  @Roles(Role.client)
  @ApiOperation({ summary: 'Update a draft order (recomputes price if coordinates change).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.orders.update(id, user.countryCode as CountryCode, user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.client)
  @ApiOperation({ summary: 'Cancel an order.' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') clientId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancel(id, clientId, dto.reason);
  }

  @Post(':id/publish')
  @Roles(Role.client)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a draft order to nearby drivers.' })
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') clientId: string) {
    return this.orders.publish(id, clientId);
  }
}
