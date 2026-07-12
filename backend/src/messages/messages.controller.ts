import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** Delivery chat REST fallback (Architecture doc §3.6). */
@ApiTags('messages')
@ApiBearerAuth()
@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('deliveries/:id/messages')
  @ApiOperation({ summary: 'List messages for a delivery (participant only).' })
  list(@Param('id', ParseUUIDPipe) deliveryId: string, @CurrentUser('id') userId: string) {
    return this.messages.list(deliveryId, userId);
  }

  @Post('deliveries/:id/messages')
  @ApiOperation({ summary: 'Send a message on a delivery (persists + broadcasts live).' })
  send(
    @Param('id', ParseUUIDPipe) deliveryId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.send(deliveryId, userId, dto);
  }

  @Put('messages/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a received message as read.' })
  markRead(@Param('id', ParseUUIDPipe) messageId: string, @CurrentUser('id') userId: string) {
    return this.messages.markRead(messageId, userId);
  }
}
