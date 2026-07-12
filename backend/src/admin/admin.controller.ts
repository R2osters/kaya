import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CountryCode, Role } from '@prisma/client';
import { AdminService } from './admin.service';
import {
  ListDeliveriesAdminDto,
  ListOrdersAdminDto,
  ListUsersDto,
  ProcessWithdrawalDto,
  ResolveDisputeDto,
  SuspendUserDto,
  UpdateCountryConfigDto,
} from './dto/admin.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users (filterable).' })
  listUsers(@Query() q: ListUsersDto) {
    return this.admin.listUsers(q);
  }

  @Put('users/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a driver.' })
  verify(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') adminId: string) {
    return this.admin.verifyUser(id, adminId);
  }

  @Put('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend (or reactivate) a user.' })
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: SuspendUserDto,
  ) {
    return this.admin.suspendUser(id, adminId, dto);
  }

  @Put('users/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended user.' })
  reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') adminId: string) {
    return this.admin.reactivateUser(id, adminId);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List all orders.' })
  orders(@Query() q: ListOrdersAdminDto) {
    return this.admin.listOrders(q);
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'List all deliveries.' })
  deliveries(@Query() q: ListDeliveriesAdminDto) {
    return this.admin.listDeliveries(q);
  }

  @Put('withdrawals/:id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a withdrawal.' })
  processWithdrawal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.admin.processWithdrawal(id, adminId, dto);
  }

  @Get('disputes')
  @ApiOperation({ summary: 'List disputed orders (with delivery + escrow info).' })
  disputes(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.admin.listDisputes(page, limit);
  }

  @Put('disputes/:orderId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a dispute (refund_client or release_driver).' })
  resolveDispute(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.admin.resolveDispute(orderId, adminId, dto);
  }

  @Get('litigation-fund')
  @ApiOperation({ summary: 'Litigation fund balance and entries.' })
  litigationFund(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.admin.litigationFund(page, limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Global platform statistics.' })
  stats() {
    return this.admin.stats();
  }

  @Put('country-config/:code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a country configuration (tariffs, tiers, radius).' })
  updateCountryConfig(
    @Param('code', new ParseEnumPipe(CountryCode)) code: CountryCode,
    @CurrentUser('id') adminId: string,
    @Body() dto: UpdateCountryConfigDto,
  ) {
    return this.admin.updateCountryConfig(code, adminId, dto);
  }
}
