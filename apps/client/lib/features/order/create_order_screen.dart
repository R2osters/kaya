import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import '../address/place.dart';
import 'schedule_picker_sheet.dart';

class CreateOrderScreen extends ConsumerStatefulWidget {
  const CreateOrderScreen({super.key});

  @override
  ConsumerState<CreateOrderScreen> createState() => _CreateOrderScreenState();
}

class _CreateOrderScreenState extends ConsumerState<CreateOrderScreen> {
  Place? _pickup;
  Place? _dropoff;
  final _description = TextEditingController();
  String _size = 'M';
  DateTime? _scheduledTime;
  String? _photoPath;

  PriceQuote? _quote;
  bool _quoting = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _pick(bool isPickup) async {
    final l10n = KayaL10n.of(context);
    final result = await context.push<Place>('/address-search',
        extra: isPickup ? l10n.orderPickup : l10n.orderDropoff);
    if (result == null) return;
    setState(() {
      if (isPickup) {
        _pickup = result;
      } else {
        _dropoff = result;
      }
    });
    _maybeQuote();
  }

  Future<void> _maybeQuote() async {
    if (_pickup == null || _dropoff == null) return;
    setState(() => _quoting = true);
    try {
      final quote = await ref.read(kayaApiProvider).pricing.quote(
            pickupLat: _pickup!.point.lat,
            pickupLng: _pickup!.point.lng,
            deliveryLat: _dropoff!.point.lat,
            deliveryLng: _dropoff!.point.lng,
          );
      setState(() => _quote = quote);
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _quoting = false);
    }
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final shot = await picker.pickImage(source: ImageSource.gallery);
    if (shot == null) return;
    final compressed =
        await ref.read(imageCompressionProvider).compress(File(shot.path));
    setState(() => _photoPath = compressed.path);
  }

  Future<void> _openSchedule() async {
    final picked = await showKayaBottomSheet<DateTime>(
      context: context,
      builder: (_) => const SchedulePickerSheet(),
    );
    if (picked != null) setState(() => _scheduledTime = picked);
  }

  Future<void> _submit() async {
    if (_pickup == null || _dropoff == null) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final api = ref.read(kayaApiProvider);
      final order = await api.orders.create({
        'pickupAddress': '${_pickup!.name}, ${_pickup!.area}',
        'pickupLat': _pickup!.point.lat,
        'pickupLng': _pickup!.point.lng,
        'deliveryAddress': '${_dropoff!.name}, ${_dropoff!.area}',
        'deliveryLat': _dropoff!.point.lat,
        'deliveryLng': _dropoff!.point.lng,
        if (_description.text.trim().isNotEmpty)
          'description': _description.text.trim(),
        'dimensions': _size,
        if (_scheduledTime != null)
          'scheduledTime': _scheduledTime!.toUtc().toIso8601String(),
      });
      // Immediate orders are published so drivers can bid right away.
      if (_scheduledTime == null) {
        await api.orders.publish(order.id);
      }
      if (mounted) context.pushReplacement('/offers/${order.id}');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final user = ref.watch(currentUserProvider);
    final currency = user?.currency ?? Currency.GHS;
    final ready = _pickup != null && _dropoff != null;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.homeNewDelivery)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _AddressField(
              icon: Icons.trip_origin_rounded,
              iconColor: AppColors.success,
              label: l10n.orderPickup,
              value: _pickup?.name,
              onTap: () => _pick(true),
            ),
            const SizedBox(height: 12),
            _AddressField(
              icon: Icons.place_rounded,
              iconColor: AppColors.primary,
              label: l10n.orderDropoff,
              value: _dropoff?.name,
              onTap: () => _pick(false),
            ),
            const SizedBox(height: 20),
            KayaTextField(
              label: l10n.orderDescription,
              controller: _description,
              maxLines: 3,
              hint: 'Shoe box, ~2kg',
            ),
            const SizedBox(height: 20),
            Text(l10n.orderSize, style: AppTypography.bodyStrong),
            const SizedBox(height: 8),
            Row(
              children: [
                for (final s in ['S', 'M', 'L', 'XL'])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(s),
                      selected: _size == s,
                      onSelected: (_) => setState(() => _size = s),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _OptionButton(
                    icon: Icons.photo_camera_outlined,
                    label: _photoPath == null ? l10n.orderPhoto : 'Photo ✓',
                    onTap: _pickPhoto,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _OptionButton(
                    icon: Icons.schedule_rounded,
                    label: _scheduledTime == null
                        ? l10n.orderSchedule
                        : DateFormat('d MMM, HH:mm').format(_scheduledTime!),
                    onTap: _openSchedule,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _QuoteCard(quote: _quote, loading: _quoting, currency: currency, l10n: l10n),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 20),
            KayaButton(
              label: l10n.orderCreate,
              loading: _submitting,
              onPressed: ready ? _submit : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _AddressField extends StatelessWidget {
  const _AddressField({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final String? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return KayaCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(icon, color: iconColor, size: 20),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AppTypography.overline),
                const SizedBox(height: 2),
                Text(value ?? '—',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: value == null
                        ? AppTypography.bodySecondary
                        : AppTypography.bodyStrong),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.inkTertiary),
        ],
      ),
    );
  }
}

class _OptionButton extends StatelessWidget {
  const _OptionButton(
      {required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.field),
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadii.field),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: AppColors.inkSecondary),
            const SizedBox(width: 8),
            Flexible(
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption
                      .copyWith(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuoteCard extends StatelessWidget {
  const _QuoteCard({
    required this.quote,
    required this.loading,
    required this.currency,
    required this.l10n,
  });

  final PriceQuote? quote;
  final bool loading;
  final Currency currency;
  final KayaL10n l10n;

  @override
  Widget build(BuildContext context) {
    return KayaCard(
      color: AppColors.primaryTint,
      border: false,
      shadow: false,
      child: Row(
        children: [
          const Icon(Icons.payments_outlined, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.orderSuggestedPrice, style: AppTypography.overline),
                const SizedBox(height: 4),
                if (loading)
                  Text(l10n.commonLoading, style: AppTypography.bodySecondary)
                else if (quote != null)
                  Text(Money(quote!.minPrice, quote!.currency).format(),
                      style: AppTypography.price.copyWith(color: AppColors.primary))
                else
                  Text('—', style: AppTypography.bodySecondary),
              ],
            ),
          ),
          if (quote != null)
            Text(l10n.commonKm(quote!.distanceKm.toStringAsFixed(1)),
                style: AppTypography.caption),
        ],
      ),
    );
  }
}
