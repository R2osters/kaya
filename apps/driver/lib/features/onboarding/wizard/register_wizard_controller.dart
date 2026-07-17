import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'register_draft.dart';

class RegisterWizardController extends StateNotifier<RegisterDraft> {
  RegisterWizardController() : super(const RegisterDraft(role: 'livreur'));

  void updateIdentity({required String fullName, required CountryCode country}) =>
      state = state.copyWith(fullName: fullName, countryCode: country);

  void updateContact({required String phone, required String email}) =>
      state = state.copyWith(phone: phone, email: email);

  void updatePassword(String password) => state = state.copyWith(password: password);

  void updateDriverDocs({VehicleType? vehicleType, String? driverLicenseNumber, String? vehicleRegistration}) =>
      state = state.copyWith(
        vehicleType: vehicleType,
        driverLicenseNumber: driverLicenseNumber,
        vehicleRegistration: vehicleRegistration,
      );

  void prefillFromSocial({
    required String email,
    String? fullName,
    required String socialDraftToken,
  }) =>
      state = state.copyWith(
        email: email,
        fullName: fullName ?? state.fullName,
        socialDraftToken: socialDraftToken,
        emailLocked: true,
      );
}

final registerWizardProvider =
    StateNotifierProvider.autoDispose<RegisterWizardController, RegisterDraft>((ref) {
  return RegisterWizardController();
});
