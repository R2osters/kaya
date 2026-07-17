import 'package:kaya_core/kaya_core.dart';

/// Accumulates the registration form across wizard steps. Mirrors the fields
/// today's single-form RegisterScreen already sends to POST /auth/register —
/// the wizard restructures the UI, not the payload shape.
class RegisterDraft {
  const RegisterDraft({
    required this.role,
    this.fullName = '',
    this.countryCode = CountryCode.GHA,
    this.phone = '',
    this.email = '',
    this.password = '',
    this.socialDraftToken,
    this.emailLocked = false,
    this.vehicleType,
    this.driverLicenseNumber,
    this.vehicleRegistration,
  });

  final String role;
  final String fullName;
  final CountryCode countryCode;
  final String phone;
  final String email;
  final String password;
  final String? socialDraftToken;
  final bool emailLocked;
  final VehicleType? vehicleType;
  final String? driverLicenseNumber;
  final String? vehicleRegistration;

  RegisterDraft copyWith({
    String? fullName,
    CountryCode? countryCode,
    String? phone,
    String? email,
    String? password,
    String? socialDraftToken,
    bool? emailLocked,
    VehicleType? vehicleType,
    String? driverLicenseNumber,
    String? vehicleRegistration,
  }) =>
      RegisterDraft(
        role: role,
        fullName: fullName ?? this.fullName,
        countryCode: countryCode ?? this.countryCode,
        phone: phone ?? this.phone,
        email: email ?? this.email,
        password: password ?? this.password,
        socialDraftToken: socialDraftToken ?? this.socialDraftToken,
        emailLocked: emailLocked ?? this.emailLocked,
        vehicleType: vehicleType ?? this.vehicleType,
        driverLicenseNumber: driverLicenseNumber ?? this.driverLicenseNumber,
        vehicleRegistration: vehicleRegistration ?? this.vehicleRegistration,
      );

  Map<String, dynamic> toRegisterBody(String firebaseIdToken) => {
        'fullName': fullName,
        'email': email,
        'phone': phone,
        'role': role,
        'countryCode': countryCode.wire,
        'firebaseIdToken': firebaseIdToken,
        if (socialDraftToken != null) 'socialDraftToken': socialDraftToken else 'password': password,
        if (vehicleType != null) 'vehicleType': vehicleType!.name,
        if (driverLicenseNumber != null) 'driverLicenseNumber': driverLicenseNumber,
        if (vehicleRegistration != null) 'vehicleRegistration': vehicleRegistration,
      };
}
