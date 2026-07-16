import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'providers/auth_provider.dart';
import 'features/splash_screen.dart';
import 'features/onboarding/welcome_screen.dart';
import 'features/onboarding/login_screen.dart';
import 'features/onboarding/register_screen.dart';
import 'features/onboarding/otp_screen.dart';
import 'features/onboarding/login_verify_screen.dart';
import 'features/onboarding/password_reset_screen.dart';
import 'features/onboarding/document_verification_screen.dart';
import 'features/home/home_shell.dart';
import 'features/home/driver_home_screen.dart';
import 'features/earnings/earnings_screen.dart';
import 'features/earnings/withdrawal_screen.dart';
import 'features/stats/stats_screen.dart';
import 'features/history/delivery_history_screen.dart';
import 'features/history/delivery_detail_screen.dart';
import 'features/offer/propose_price_screen.dart';
import 'features/delivery/active_delivery_screen.dart';
import 'features/chat/inbox_screen.dart';
import 'features/chat/chat_screen.dart';
import 'features/rating/rating_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/profile/profile_screen.dart';

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
          loc.startsWith('/login-verify') ||
          loc.startsWith('/register') ||
          loc.startsWith('/otp') ||
          loc.startsWith('/verify-documents') ||
          loc == '/splash';

      if (!auth.isAuthenticated) {
        return onAuthFlow && loc != '/splash' ? null : '/welcome';
      }
      if (onAuthFlow && loc != '/verify-documents') return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/welcome', builder: (_, __) => const WelcomeScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: '/otp',
        builder: (_, state) => OtpScreen(args: state.extra as OtpArgs?),
      ),
      GoRoute(
        path: '/login-verify',
        builder: (_, state) {
          final extra = state.extra as ({String challengeId, String identifier});
          return LoginVerifyScreen(
            challengeId: extra.challengeId,
            phone: extra.identifier,
            email: extra.identifier,
          );
        },
      ),
      GoRoute(path: '/password-reset', builder: (_, __) => const PasswordResetScreen()),
      GoRoute(
        path: '/verify-documents',
        builder: (_, __) => const DocumentVerificationScreen(),
      ),

      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (_, __) => const DriverHomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/earnings', builder: (_, __) => const EarningsScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/inbox', builder: (_, __) => const InboxScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          ]),
        ],
      ),

      GoRoute(
        path: '/propose/:orderId',
        builder: (_, state) =>
            ProposePriceScreen(orderId: state.pathParameters['orderId']!),
      ),
      GoRoute(
        path: '/delivery/:deliveryId',
        builder: (_, state) => ActiveDeliveryScreen(
            deliveryId: state.pathParameters['deliveryId']!),
      ),
      GoRoute(path: '/stats', builder: (_, __) => const StatsScreen()),
      GoRoute(
        path: '/history',
        builder: (_, __) => const DeliveryHistoryScreen(),
      ),
      GoRoute(
        path: '/delivery-detail/:deliveryId',
        builder: (_, state) => DeliveryDetailScreen(
            deliveryId: state.pathParameters['deliveryId']!),
      ),
      GoRoute(
        path: '/withdraw',
        builder: (_, __) => const WithdrawalScreen(),
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
