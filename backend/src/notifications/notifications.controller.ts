import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications (paginated).' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'unreadOnly', required: false })
  list(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('unreadOnly', new DefaultValuePipe(false), ParseBoolPipe) unreadOnly: boolean,
  ) {
    return this.notifications.list(userId, { page, limit, unreadOnly });
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read.' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.notifications.markRead(id, userId);
  }

  @Put('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications as read.' })
  markAll(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  // Kept for clients that POST; same behaviour.
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications as read (POST alias).' })
  markAllPost(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
