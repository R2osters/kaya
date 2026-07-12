import 'json_utils.dart';

/// A rating left after a delivery. Mirrors backend `ratings`.
class Rating {
  const Rating({
    required this.id,
    required this.deliveryId,
    required this.fromUserId,
    required this.toUserId,
    required this.score,
    this.comment,
    required this.createdAt,
  });

  final String id;
  final String deliveryId;
  final String fromUserId;
  final String toUserId;
  final int score;
  final String? comment;
  final DateTime createdAt;

  factory Rating.fromJson(Map<String, dynamic> j) => Rating(
        id: asString(j['id']),
        deliveryId: asString(j['deliveryId']),
        fromUserId: asString(j['fromUserId']),
        toUserId: asString(j['toUserId']),
        score: asInt(j['score']),
        comment: asStringOrNull(j['comment']),
        createdAt: asDate(j['createdAt']),
      );
}

/// Aggregate returned by GET /users/:id/ratings.
class RatingSummary {
  const RatingSummary({
    required this.average,
    required this.count,
    required this.ratings,
  });

  final double average;
  final int count;
  final List<Rating> ratings;

  factory RatingSummary.fromJson(Map<String, dynamic> j) => RatingSummary(
        average: asDouble(j['average']),
        count: asInt(j['count']),
        ratings: asMapList(j['ratings']).map(Rating.fromJson).toList(),
      );
}
