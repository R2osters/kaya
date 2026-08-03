import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  group('Model JSON parsing (backend camelCase + Decimal-as-string)', () {
    test('User parses driver fields and string decimals', () {
      final u = User.fromJson({
        'id': 'u1',
        'email': 'a@b.com',
        'phone': '+233201234567',
        'fullName': 'Kwame Osei',
        'role': 'livreur',
        'countryCode': 'GHA',
        'isVerified': true,
        // Prisma serializes Decimal as a string:
        'ratingDriver': '4.8',
        'balance': '150.50',
        'totalDeliveries': 120,
        'vehicleType': 'moto',
      });
      expect(u.fullName, 'Kwame Osei');
      expect(u.role, UserRole.livreur);
      expect(u.isDriver, isTrue);
      expect(u.countryCode, CountryCode.GHA);
      expect(u.ratingDriver, 4.8);
      expect(u.balance, 150.50);
      expect(u.vehicleType, VehicleType.moto);
      expect(u.currency, Currency.GHS);
    });

    test('Order parses coordinates into GeoPoints and status enum', () {
      final o = Order.fromJson({
        'id': 'o1',
        'clientId': 'c1',
        'pickupAddress': 'Osu Oxford Street',
        'pickupLat': '5.6037',
        'pickupLng': '-0.1870',
        'deliveryAddress': 'East Legon',
        'deliveryLat': 5.6346,
        'deliveryLng': -0.1664,
        'status': 'published',
        'minPriceSuggested': '50.00',
        'distanceKm': '4.20',
        'createdAt': '2026-07-10T10:00:00.000Z',
      });
      expect(o.pickup.lat, 5.6037);
      expect(o.dropoff.lng, -0.1664);
      expect(o.status, OrderStatus.published);
      expect(o.isLive, isTrue);
      expect(o.minPriceSuggested, 50.0);
    });

    test('Offer parses embedded driver relation', () {
      final offer = Offer.fromJson({
        'id': 'of1',
        'orderId': 'o1',
        'livreurId': 'u1',
        'proposedPrice': '48.00',
        'minPrice': '50.00',
        'status': 'pending',
        'createdAt': '2026-07-10T10:05:00.000Z',
        'livreur': {
          'id': 'u1',
          'email': 'd@x.com',
          'phone': '+233200000000',
          'fullName': 'Ama Serwaa',
          'role': 'livreur',
          'countryCode': 'GHA',
          'ratingDriver': '4.9',
          'totalDeliveries': 85,
        },
      });
      expect(offer.proposedPrice, 48.0);
      expect(offer.driver?.fullName, 'Ama Serwaa');
      expect(offer.driver?.ratingDriver, 4.9);
    });

    test('Message accepts both REST camelCase and socket snake_case', () {
      final rest = Message.fromJson({
        'id': 'm1',
        'deliveryId': 'd1',
        'senderId': 's1',
        'messageText': 'Hello',
        'isRead': false,
        'createdAt': '2026-07-10T10:42:00.000Z',
      });
      final socket = Message.fromJson({
        'id': 'm2',
        'delivery_id': 'd1',
        'sender_id': 's1',
        'message_text': 'On my way',
        'created_at': '2026-07-10T10:44:00.000Z',
      });
      expect(rest.messageText, 'Hello');
      expect(rest.deliveryId, 'd1');
      expect(socket.messageText, 'On my way');
      expect(socket.senderId, 's1');
    });

    test('Delivery maps lifecycle onto the 4-step timeline', () {
      final enRoute = Delivery.fromJson({
        'id': 'd1',
        'orderId': 'o1',
        'livreurId': 'u1',
        'status': 'in_progress',
        'clientPaymentStatus': 'escrow_held',
        'createdAt': '2026-07-10T10:00:00.000Z',
      });
      final delivered = Delivery.fromJson({
        'id': 'd2',
        'orderId': 'o2',
        'livreurId': 'u1',
        'status': 'completed',
        'clientPaymentStatus': 'released',
        'deliveryTime': '2026-07-10T11:00:00.000Z',
        'createdAt': '2026-07-10T10:00:00.000Z',
      });
      expect(enRoute.timelineStep, 0);
      expect(delivered.timelineStep, 3);
    });

    test('PriceQuote round-trips numbers', () {
      final q = PriceQuote.fromJson({
        'countryCode': 'TGO',
        'distanceKm': 3.5,
        'minPrice': 1400,
        'currency': 'XOF',
        'currencySymbol': 'XOF',
        'pricePerKm': 400,
        'basePickupFee': 0,
        'source': 'haversine',
      });
      expect(q.currency, Currency.XOF);
      expect(q.minPrice, 1400);
      expect(q.countryCode, CountryCode.TGO);
    });
  });
}
