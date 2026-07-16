/// kaya_core — shared layer for the Kaya delivery apps.
///
/// Exports theme + widgets, models, the REST client, realtime socket service,
/// device services, the map abstraction, i18n, and app constants. Both
/// apps/client and apps/driver depend on this package (no duplication).
library kaya_core;

// Constants
export 'src/constants.dart';

// Theme
export 'src/theme/app_colors.dart';
export 'src/theme/app_radii.dart';
export 'src/theme/app_shadows.dart';
export 'src/theme/app_typography.dart';
export 'src/theme/app_theme.dart';

// Widgets
export 'src/theme/widgets/kaya_button.dart';
export 'src/theme/widgets/kaya_text_field.dart';
export 'src/theme/widgets/kaya_card.dart';
export 'src/theme/widgets/status_pill.dart';
export 'src/theme/widgets/rating_stars.dart';
export 'src/theme/widgets/empty_state.dart';
export 'src/theme/widgets/bottom_sheet_shell.dart';
export 'src/theme/widgets/kaya_avatar.dart';

// Map abstraction
export 'src/map/map_view.dart';

// Models
export 'src/models/enums.dart';
export 'src/models/geo_point.dart';
export 'src/models/json_utils.dart';
export 'src/models/country_config.dart';
export 'src/models/user.dart';
export 'src/models/order.dart';
export 'src/models/offer.dart';
export 'src/models/delivery.dart';
export 'src/models/message.dart';
export 'src/models/rating.dart';
export 'src/models/transaction.dart';
export 'src/models/withdrawal.dart';
export 'src/models/price_quote.dart';
export 'src/models/app_notification.dart';
export 'src/models/auth_result.dart';

// API
export 'src/api/api_config.dart';
export 'src/api/api_failure.dart';
export 'src/api/kaya_api.dart';

// Firebase
export 'src/firebase_options.dart';

// Realtime
export 'src/realtime/socket_service.dart';
export 'src/realtime/socket_events.dart';

// Services
export 'src/services/secure_token_storage.dart';
export 'src/services/location_service.dart';
export 'src/services/image_compression.dart';
export 'src/services/fcm_service.dart';
export 'src/services/phone_auth_service.dart';

// i18n
export 'src/l10n/kaya_l10n.dart';
