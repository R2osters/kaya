import 'package:dio/dio.dart';

import '../constants.dart';
import '../models/app_notification.dart';
import '../models/auth_result.dart';
import '../models/delivery.dart';
import '../models/enums.dart';
import '../models/message.dart';
import '../models/offer.dart';
import '../models/order.dart';
import '../models/price_quote.dart';
import '../models/rating.dart';
import '../models/transaction.dart';
import '../models/user.dart';
import '../models/withdrawal.dart';
import '../services/secure_token_storage.dart';
import 'api_config.dart';
import 'api_failure.dart';
import 'auth_interceptor.dart';

/// Central REST client for the Kaya backend. Groups endpoints by domain and
/// maps every error to [ApiFailure]. Construct once and share across the app.
class KayaApi {
  KayaApi({required this.config, required this.store, Future<void> Function()? onSessionExpired}) {
    final options = BaseOptions(
      baseUrl: config.restBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      contentType: Headers.jsonContentType,
    );
    _dio = Dio(options);
    _refreshDio = Dio(options);
    _dio.interceptors.add(
      AuthInterceptor(
        store: store,
        refreshClient: _refreshDio,
        onSessionExpired: onSessionExpired ?? () async {},
      ),
    );
  }

  final ApiConfig config;
  final TokenStore store;
  late final Dio _dio;
  late final Dio _refreshDio;

  Dio get raw => _dio;

  // Domain groups (lazy).
  late final auth = AuthApi(this);
  late final orders = OrdersApi(this);
  late final offers = OffersApi(this);
  late final deliveries = DeliveriesApi(this);
  late final payments = PaymentsApi(this);
  late final driver = DriverApi(this);
  late final messages = MessagesApi(this);
  late final ratings = RatingsApi(this);
  late final pricing = PricingApi(this);
  late final notifications = NotificationsApi(this);

  /// Runs [request] and normalizes any error to [ApiFailure].
  Future<T> _guard<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (e) {
      throw ApiFailure.from(e);
    }
  }

  Future<Map<String, dynamic>> _getMap(String path,
      {Map<String, dynamic>? query, bool skipAuth = false}) {
    return _guard(() async {
      final res = await _dio.get<dynamic>(path,
          queryParameters: query, options: _opts(skipAuth));
      return Map<String, dynamic>.from(res.data as Map);
    });
  }

  Future<List<Map<String, dynamic>>> _getList(String path,
      {Map<String, dynamic>? query}) {
    return _guard(() async {
      final res = await _dio.get<dynamic>(path, queryParameters: query);
      final data = res.data;
      // Endpoints return either a bare list or { items/data/results: [...] }.
      final list = data is List
          ? data
          : (data is Map
              ? (data['items'] ?? data['data'] ?? data['results'] ?? const [])
              : const []);
      return (list as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    });
  }

  Future<Map<String, dynamic>> _postMap(String path,
      {Object? body, bool skipAuth = false}) {
    return _guard(() async {
      final res =
          await _dio.post<dynamic>(path, data: body, options: _opts(skipAuth));
      final data = res.data;
      return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    });
  }

  Future<Map<String, dynamic>> _putMap(String path, {Object? body}) {
    return _guard(() async {
      final res = await _dio.put<dynamic>(path, data: body);
      final data = res.data;
      return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    });
  }

  Options _opts(bool skipAuth) =>
      Options(extra: skipAuth ? {'skipAuth': true} : null);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
class AuthApi {
  AuthApi(this._api);
  final KayaApi _api;

  Future<AuthResult> register(Map<String, dynamic> body) async =>
      AuthResult.fromJson(await _api._postMap('/auth/register', body: body, skipAuth: true));

  Future<LoginChallenge> login(String identifier, String password) async =>
      LoginChallenge.fromJson(await _api._postMap('/auth/login',
          body: {'identifier': identifier, 'password': password},
          skipAuth: true));

  Future<AuthResult> verifyLoginChallenge({
    required String challengeId,
    required String firebaseIdToken,
  }) async =>
      AuthResult.fromJson(await _api._postMap('/auth/login/verify',
          body: {'challengeId': challengeId, 'firebaseIdToken': firebaseIdToken},
          skipAuth: true));

  Future<SocialLoginOutcome> socialLogin({
    required String firebaseIdToken,
    required String provider,
  }) async =>
      SocialLoginOutcome.fromJson(await _api._postMap('/auth/social',
          body: {'firebaseIdToken': firebaseIdToken, 'provider': provider},
          skipAuth: true));

  Future<AuthResult> loginWithOtp({
    required String phone,
    required String firebaseIdToken,
  }) async =>
      AuthResult.fromJson(await _api._postMap('/auth/login/otp',
          body: {'phone': phone, 'firebaseIdToken': firebaseIdToken},
          skipAuth: true));

  Future<void> resetPassword({
    required String phone,
    required String firebaseIdToken,
    required String newPassword,
  }) =>
      _api._postMap('/auth/password-reset',
          body: {
            'phone': phone,
            'firebaseIdToken': firebaseIdToken,
            'newPassword': newPassword,
          },
          skipAuth: true);

  Future<User> me() async => User.fromJson(await _api._getMap('/auth/me'));

  Future<User> updateProfile(Map<String, dynamic> body) async =>
      User.fromJson(await _api._putMap('/auth/profile', body: body));

  Future<void> logout(String refreshToken) =>
      _api._postMap('/auth/logout', body: {'refreshToken': refreshToken});
}

// ---------------------------------------------------------------------------
// Orders + pricing
// ---------------------------------------------------------------------------
class OrdersApi {
  OrdersApi(this._api);
  final KayaApi _api;

  Future<Order> create(Map<String, dynamic> body) async =>
      Order.fromJson(await _api._postMap('/orders', body: body));

  Future<List<Order>> mine({String? status, int? page}) async =>
      (await _api._getList('/orders', query: {
        if (status != null) 'status': status,
        if (page != null) 'page': page,
      }))
          .map(Order.fromJson)
          .toList();

  Future<Order> byId(String id) async =>
      Order.fromJson(await _api._getMap('/orders/$id'));

  Future<Order> update(String id, Map<String, dynamic> body) async =>
      Order.fromJson(await _api._putMap('/orders/$id', body: body));

  Future<Order> publish(String id) async =>
      Order.fromJson(await _api._postMap('/orders/$id/publish'));

  Future<void> cancel(String id, {String? reason}) =>
      _api._guard(() => _api._dio.delete<dynamic>('/orders/$id',
          data: {if (reason != null) 'reason': reason}));

  /// Driver: published orders near me (PostGIS radius).
  Future<List<Order>> nearby({double? lat, double? lng, int? radiusKm}) async =>
      (await _api._getList('/orders/nearby', query: {
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
        if (radiusKm != null) 'radiusKm': radiusKm,
      }))
          .map(Order.fromJson)
          .toList();
}

class PricingApi {
  PricingApi(this._api);
  final KayaApi _api;

  Future<PriceQuote> quote({
    required double pickupLat,
    required double pickupLng,
    required double deliveryLat,
    required double deliveryLng,
    CountryCode? country,
  }) async =>
      PriceQuote.fromJson(await _api._getMap('/calculate-price', query: {
        'pickupLat': pickupLat,
        'pickupLng': pickupLng,
        'deliveryLat': deliveryLat,
        'deliveryLng': deliveryLng,
        if (country != null) 'countryCode': country.wire,
      }));
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------
class OffersApi {
  OffersApi(this._api);
  final KayaApi _api;

  Future<Offer> create(String orderId, double proposedPrice) async =>
      Offer.fromJson(await _api._postMap('/orders/$orderId/offers',
          body: {'proposedPrice': proposedPrice}));

  Future<List<Offer>> forOrder(String orderId) async =>
      (await _api._getList('/orders/$orderId/offers'))
          .map(Offer.fromJson)
          .toList();

  Future<Delivery> accept(String offerId) async =>
      Delivery.fromJson(await _api._postMap('/offers/$offerId/accept'));

  Future<void> reject(String offerId) =>
      _api._postMap('/offers/$offerId/reject');
}

// ---------------------------------------------------------------------------
// Deliveries lifecycle
// ---------------------------------------------------------------------------
class DeliveriesApi {
  DeliveriesApi(this._api);
  final KayaApi _api;

  Future<List<Delivery>> mine() async =>
      (await _api._getList('/deliveries')).map(Delivery.fromJson).toList();

  Future<Delivery> byId(String id) async =>
      Delivery.fromJson(await _api._getMap('/deliveries/$id'));

  Future<Delivery> start(String id) async =>
      Delivery.fromJson(await _api._postMap('/deliveries/$id/start'));

  Future<Delivery> pickup(String id, {String? photoUrl}) async =>
      Delivery.fromJson(await _api._postMap('/deliveries/$id/pickup',
          body: {if (photoUrl != null) 'photoUrl': photoUrl}));

  Future<Delivery> transit(String id) async =>
      Delivery.fromJson(await _api._postMap('/deliveries/$id/transit'));

  Future<Delivery> confirmDelivery(String id, {String? photoUrl}) async =>
      Delivery.fromJson(await _api._postMap('/deliveries/$id/confirm-delivery',
          body: {if (photoUrl != null) 'photoUrl': photoUrl}));

  Future<void> cancel(String id, {String? reason}) =>
      _api._postMap('/deliveries/$id/cancel',
          body: {if (reason != null) 'reason': reason});
}

// ---------------------------------------------------------------------------
// Payments (escrow)
// ---------------------------------------------------------------------------
class PaymentsApi {
  PaymentsApi(this._api);
  final KayaApi _api;

  /// Returns { reference, checkoutUrl / paymentUrl, ... } for the webview.
  Future<Map<String, dynamic>> initialize(String deliveryId) =>
      _api._postMap('/payments/initialize', body: {'deliveryId': deliveryId});

  Future<Map<String, dynamic>> verify(String reference) =>
      _api._postMap('/payments/verify', body: {'reference': reference});
}

// ---------------------------------------------------------------------------
// Driver wallet
// ---------------------------------------------------------------------------
class DriverApi {
  DriverApi(this._api);
  final KayaApi _api;

  Future<Map<String, dynamic>> balance() => _api._getMap('/driver/balance');

  Future<List<Transaction>> earnings() async =>
      (await _api._getList('/driver/earnings'))
          .map(Transaction.fromJson)
          .toList();

  Future<Map<String, dynamic>> stats() => _api._getMap('/driver/stats');

  Future<Withdrawal> withdraw({
    required double amount,
    required WithdrawalMethod method,
    required Map<String, dynamic> accountDetails,
  }) async =>
      Withdrawal.fromJson(await _api._postMap('/driver/withdraw', body: {
        'amount': amount,
        'method': method.name,
        'accountDetails': accountDetails,
      }));

  Future<List<Withdrawal>> withdrawals() async =>
      (await _api._getList('/driver/withdrawals'))
          .map(Withdrawal.fromJson)
          .toList();
}

// ---------------------------------------------------------------------------
// Messages (chat REST fallback) + Ratings
// ---------------------------------------------------------------------------
class MessagesApi {
  MessagesApi(this._api);
  final KayaApi _api;

  Future<List<Message>> list(String deliveryId) async =>
      (await _api._getList('/deliveries/$deliveryId/messages'))
          .map(Message.fromJson)
          .toList();

  Future<Message> send(String deliveryId,
          {String? messageText, String? imageUrl}) async =>
      Message.fromJson(await _api._postMap('/deliveries/$deliveryId/messages',
          body: {
            if (messageText != null) 'messageText': messageText,
            if (imageUrl != null) 'imageUrl': imageUrl,
          }));

  Future<void> markRead(String messageId) =>
      _api._putMap('/messages/$messageId/read');
}

class RatingsApi {
  RatingsApi(this._api);
  final KayaApi _api;

  Future<Rating> rate(String deliveryId,
          {required String toUserId, required int score, String? comment}) async =>
      Rating.fromJson(await _api._postMap('/deliveries/$deliveryId/rate', body: {
        'toUserId': toUserId,
        'score': score,
        if (comment != null) 'comment': comment,
      }));

  Future<RatingSummary> forUser(String userId) async =>
      RatingSummary.fromJson(await _api._getMap('/users/$userId/ratings'));
}

// ---------------------------------------------------------------------------
// Notifications (backend feed added in M5: GET /notifications, PUT /:id/read)
// ---------------------------------------------------------------------------
class NotificationsApi {
  NotificationsApi(this._api);
  final KayaApi _api;

  /// Paginated notification feed. Tolerates either a bare array or a
  /// `{ items, page, ... }` envelope (see [_getList]).
  Future<List<AppNotification>> list({int? page, int? limit}) async =>
      (await _api._getList('/notifications', query: {
        if (page != null) 'page': page,
        if (limit != null) 'limit': limit,
      }))
          .map(AppNotification.fromJson)
          .toList();

  Future<void> markRead(String id) =>
      _api._putMap('/notifications/$id/read');

  Future<void> markAllRead() => _api._postMap('/notifications/read-all');
}
