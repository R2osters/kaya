import 'dart:async';

import 'package:flutter/material.dart';
import 'package:kaya_core/kaya_core.dart';

/// Full-screen "new request" popup with a countdown ring. Returns true if the
/// driver accepts before the timer runs out, false on refuse/timeout.
class NewRequestPopup extends StatefulWidget {
  const NewRequestPopup({
    super.key,
    required this.order,
    required this.currency,
    this.seconds = 20,
  });

  final Order order;
  final Currency currency;
  final int seconds;

  static Future<bool?> show(
      BuildContext context, Order order, Currency currency) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => NewRequestPopup(order: order, currency: currency),
    );
  }

  @override
  State<NewRequestPopup> createState() => _NewRequestPopupState();
}

class _NewRequestPopupState extends State<NewRequestPopup> {
  late int _remaining;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remaining = widget.seconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      setState(() => _remaining--);
      if (_remaining <= 0) {
        t.cancel();
        if (mounted) Navigator.of(context).pop(false);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final o = widget.order;
    return Dialog(
      insetPadding: const EdgeInsets.all(20),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l10n.driverNewRequest, style: AppTypography.sectionTitle),
                Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 44,
                      height: 44,
                      child: CircularProgressIndicator(
                        value: _remaining / widget.seconds,
                        strokeWidth: 4,
                        backgroundColor: AppColors.border,
                      ),
                    ),
                    Text('$_remaining', style: AppTypography.bodyStrong),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 20),
            _leg(Icons.trip_origin_rounded, AppColors.success,
                l10n.orderPickup, o.pickupAddress),
            const Padding(
              padding: EdgeInsets.only(left: 9),
              child: SizedBox(
                height: 20,
                child: VerticalDivider(width: 2, thickness: 2),
              ),
            ),
            _leg(Icons.place_rounded, AppColors.primary, l10n.orderDropoff,
                o.deliveryAddress),
            const SizedBox(height: 16),
            if (o.minPriceSuggested != null)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(l10n.offersAppSuggested,
                      style: AppTypography.bodySecondary),
                  Text(Money(o.minPriceSuggested!, widget.currency).format(),
                      style: AppTypography.price),
                ],
              ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: KayaButton(
                    label: l10n.actionRefuse,
                    variant: KayaButtonVariant.secondary,
                    onPressed: () => Navigator.of(context).pop(false),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: KayaButton(
                    label: l10n.actionAccept,
                    onPressed: () => Navigator.of(context).pop(true),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _leg(IconData icon, Color color, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppTypography.overline),
              const SizedBox(height: 2),
              Text(value,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodyStrong),
            ],
          ),
        ),
      ],
    );
  }
}
