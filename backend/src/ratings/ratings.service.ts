import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryStatus, Prisma, Rating, RatingRole, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';

/**
 * Two-sided ratings. Each participant may rate the other once per delivery
 * (UNIQUE delivery_id + from_user_id). When a driver is rated, their
 * rating_driver average is recomputed.
 */
@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async rate(deliveryId: string, fromUserId: string, dto: CreateRatingDto): Promise<Rating> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: { select: { clientId: true } } },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found.');
    }
    if (delivery.status !== DeliveryStatus.completed) {
      throw new BadRequestException('You can only rate a completed delivery.');
    }

    const clientId = delivery.order.clientId;
    const driverId = delivery.livreurId;
    const participants = [clientId, driverId];
    if (!participants.includes(fromUserId)) {
      throw new ForbiddenException('You are not a participant of this delivery.');
    }

    // The target must be the OTHER participant.
    const expectedTarget = fromUserId === clientId ? driverId : clientId;
    if (dto.toUserId !== expectedTarget) {
      throw new BadRequestException('You can only rate the other participant of this delivery.');
    }

    const roleType = fromUserId === clientId ? RatingRole.client : RatingRole.livreur;

    let rating: Rating;
    try {
      rating = await this.prisma.rating.create({
        data: {
          deliveryId,
          fromUserId,
          toUserId: dto.toUserId,
          roleType,
          score: dto.score,
          comment: dto.comment,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('You have already rated this delivery.');
      }
      throw err;
    }

    // Refresh the target's average: driver rating from client ratings, and
    // client rating from driver ratings.
    if (dto.toUserId === driverId) {
      await this.recomputeAverage(driverId, RatingRole.client, 'ratingDriver');
    } else {
      await this.recomputeAverage(clientId, RatingRole.livreur, 'ratingClient');
    }
    return rating;
  }

  async forUser(userId: string, opts: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));

    const [ratings, agg] = await this.prisma.$transaction([
      this.prisma.rating.findMany({
        where: { toUserId: userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { fromUser: { select: { id: true, fullName: true, profilePhoto: true } } },
      }),
      this.prisma.rating.aggregate({
        where: { toUserId: userId },
        _avg: { score: true },
        _count: true,
      }),
    ]);
    return {
      userId,
      page,
      limit,
      average: agg._avg.score != null ? Math.round(agg._avg.score * 10) / 10 : null,
      count: agg._count,
      ratings: ratings.map((r) => ({
        id: r.id,
        score: r.score,
        comment: r.comment,
        roleType: r.roleType,
        fromUser: r.fromUser,
        createdAt: r.createdAt,
      })),
    };
  }

  /** Recomputes a user's average from ratings of a given rater role type. */
  private async recomputeAverage(
    userId: string,
    raterRole: RatingRole,
    field: 'ratingDriver' | 'ratingClient',
  ): Promise<void> {
    const agg = await this.prisma.rating.aggregate({
      where: { toUserId: userId, roleType: raterRole },
      _avg: { score: true },
    });
    if (agg._avg.score == null) {
      return;
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { [field]: new Prisma.Decimal(agg._avg.score.toFixed(1)) },
    });
  }
}
