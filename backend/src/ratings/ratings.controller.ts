import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('ratings')
@ApiBearerAuth()
@Controller()
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post('deliveries/:id/rate')
  @ApiOperation({ summary: 'Rate the other participant of a completed delivery.' })
  rate(
    @Param('id', ParseUUIDPipe) deliveryId: string,
    @CurrentUser('id') fromUserId: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratings.rate(deliveryId, fromUserId, dto);
  }

  @Get('users/:id/ratings')
  @ApiOperation({ summary: 'List a user’s ratings and average score (paginated).' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  forUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.ratings.forUser(userId, { page, limit });
  }
}
