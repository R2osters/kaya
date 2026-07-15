import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import 'providers/auth_provider.dart';
import 'features/home/home_shell.dart';
import 'features/home/home_screen.dart';
import 'features/history/history_screen.dart';
import 'features/chat/inbox_screen.dart';
import 'features/chat/chat_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/onboarding/welcome_screen.dart';
import 'features/onboarding/login_screen.dart';
import 'features/onboarding/register_screen.dart';
import 'features/onboarding/otp_screen.dart';
import 'features/onboarding/login_otp_screen.dart';
import 'features/onboarding/password_reset_screen.dart';
import 'features/order/create_order_screen.dart';
import 'features/address/address_search_screen.dart';
import 'features/offers/offers_screen.dart';
import 'features/payment/escrow_payment_screen.dart';
import 'features/payment/payment_webview_screen.dart';
import 'features/payment/receipt_screen.dart';
import 'features/tracking/tracking_screen.dart';
import 'features/rating/rating_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/splash_screen.dart';

/// go_router configured with an auth-aware redirect. Rebuilds when the auth
/// status changes via [_AuthRefresh].
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefresh(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;

      if (auth.status == AuthStatus.unknown) {
        return loc == '/splash' ? null : '/splash';
      }
      final onAuthFlow = loc.startsWith('/welcome') ||
          loc.startsWith('/login') ||
          loc.startsWith('/register') ||
          loc.startsWith('/otp') ||
          loc == '/splash';

      if (!auth.isAuthenticated) {
        return onAuthFlow && loc != '/splash' ? null : '/welcome';
      }
      // Authenticated but sitting on an auth screen -> go home.
      if (onAuthFlow) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/welcome', builder: (_, __) => const WelcomeScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: '/otp',
        builder: (_, state) =>
            OtpScreen(args: state.extra as OtpArgs?),
      ),
      GoRoute(path: '/login-otp', builder: (_, __) => const LoginOtpScreen()),
      GoRoute(path: '/password-reset', builder: (_, __) => const PasswordResetScreen()),

      // Bottom-nav shell.
      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
                path: '/history', builder: (_, __) => const HistoryScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/inbox', builder: (_, __) => const InboxScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
                path: '/profile', builder: (_, __) => const ProfileScreen()),
          ]),
        ],
      ),

      GoRoute(
        path: '/address-search',
        builder: (_, state) =>
            AddressSearchScreen(title: state.extra as String?),
      ),
      GoRoute(
        path: '/create-order',
        builder: (_, __) => const CreateOrderScreen(),
      ),
      GoRoute(
        path: '/offers/:orderId',
        builder: (_, state) =>
            OffersScreen(orderId: state.pathParameters['orderId']!),
      ),
      GoRoute(
        path: '/payment',
        builder: (_, state) =>
            EscrowPaymentScreen(delivery: state.extra as Delivery),
      ),
      GoRoute(
        path: '/payment-webview',
        builder: (_, state) =>
            PaymentWebviewScreen(args: state.extra as PaymentWebviewArgs),
      ),
      GoRoute(
        path: '/receipt',
        builder: (_, state) =>
            ReceiptScreen(delivery: state.extra as Delivery),
      ),
      GoRoute(
        path: '/tracking/:deliveryId',
        builder: (_, state) =>
            TrackingScreen(deliveryId: state.pathParameters['deliveryId']!),
      ),
      GoRoute(
        path: '/chat/:deliveryId',
        builder: (_, state) => ChatScreen(
          deliveryId: state.pathParameters['deliveryId']!,
          peerName: state.extra as String?,
        ),
      ),
      GoRoute(
        path: '/rating/:deliveryId',
        builder: (_, state) =>
            RatingScreen(deliveryId: state.pathParameters['deliveryId']!),
      ),
      GoRoute(
        path: '/notifications',
        builder: (_, __) => const NotificationsScreen(),
      ),
    ],
  );
});

/// Bridges Riverpod auth state to go_router's Listenable-based refresh.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Ref ref) {
    _sub = ref.listen(authControllerProvider, (_, __) => notifyListeners());
  }
  late final ProviderSubscription _sub;

  @override
  void dispose() {
    _sub.close();
    super.dispose();
  }
}
