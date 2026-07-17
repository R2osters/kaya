import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'register_wizard_controller.dart';

class DocsMetadataStep extends ConsumerStatefulWidget {
  const DocsMetadataStep({super.key, required this.onNext});
  final VoidCallback onNext;

  @override
  ConsumerState<DocsMetadataStep> createState() => _DocsMetadataStepState();
}

class _DocsMetadataStepState extends ConsumerState<DocsMetadataStep> {
  final _license = TextEditingController();
  final _vehicleReg = TextEditingController();
  VehicleType _vehicle = VehicleType.moto;

  @override
  void dispose() {
    _license.dispose();
    _vehicleReg.dispose();
    super.dispose();
  }

  String _licenseLabel(KayaL10n l10n, CountryCode country) => switch (country) {
        CountryCode.GHA => l10n.driverLicensePcsrc,
        CountryCode.TGO => l10n.driverCardPro,
        CountryCode.BEN => l10n.driverCourierPermit,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final country = ref.watch(registerWizardProvider.select((d) => d.countryCode));
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(l10n.driverVehicle, style: AppTypography.bodyStrong),
        const SizedBox(height: 8),
        Row(
          children: VehicleType.values.map((v) {
            final active = v == _vehicle;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(v.name),
                selected: active,
                onSelected: (_) => setState(() => _vehicle = v),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        KayaTextField(
          label: _licenseLabel(l10n, country),
          controller: _license,
          prefixIcon: Icons.badge_outlined,
        ),
        const SizedBox(height: 16),
        KayaTextField(
          label: l10n.driverVehicleRegistration,
          hint: 'GR-1234-19',
          controller: _vehicleReg,
          prefixIcon: Icons.directions_car_outlined,
        ),
        const SizedBox(height: 28),
        KayaButton(
          label: l10n.actionContinue,
          onPressed: () {
            ref.read(registerWizardProvider.notifier).updateDriverDocs(
              vehicleType: _vehicle,
              driverLicenseNumber: _license.text.trim().isEmpty ? null : _license.text.trim(),
              vehicleRegistration: _vehicleReg.text.trim().isEmpty ? null : _vehicleReg.text.trim(),
            );
            widget.onNext();
          },
        ),
      ],
    );
  }
}
