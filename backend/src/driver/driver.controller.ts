import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DriverService } from './driver.service';
import { WithdrawDto } from './dto/withdraw.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('driver')
@ApiBearerAuth()
@Roles(Role.livreur)
@Controller('driver')
export class DriverController {
  constructor(private readonly driver: DriverService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Current balance and recent transactions.' })
  balance(@CurrentUser('id') driverId: string) {
    return this.driver.getBalance(driverId);
  }

  @Get('earnings')
  @ApiOperation({ summary: 'Detailed payout history.' })
  earnings(@CurrentUser('id') driverId: string) {
    return this.driver.getEarnings(driverId);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a withdrawal (one per day, fee applied).' })
  withdraw(@CurrentUser('id') driverId: string, @Body() dto: WithdrawDto) {
    return this.driver.withdraw(driverId, dto);
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'Withdrawal history.' })
  withdrawals(@CurrentUser('id') driverId: string) {
    return this.driver.getWithdrawals(driverId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Today’s deliveries, commission tier, and earnings.' })
  stats(@CurrentUser('id') driverId: string) {
    return this.driver.getStats(driverId);
  }
}
