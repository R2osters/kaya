import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

/// Post-delivery rating. The client rates the driver of a completed delivery
/// (the driver app has the mirror screen — dual rating).
class RatingScreen extends ConsumerStatefulWidget {
  const RatingScreen({super.key, required this.deliveryId});
  final String deliveryId;

  @override
  ConsumerState<RatingScreen> createState() => _RatingScreenState();
}

class _RatingScreenState extends ConsumerState<RatingScreen> {
  int _score = 5;
  final _comment = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(kayaApiProvider);
      final delivery = await api.deliveries.byId(widget.deliveryId);
      final toUserId = delivery.livreurId;
      await api.ratings.rate(widget.deliveryId,
          toUserId: toUserId,
          score: _score,
          comment: _comment.text.trim().isEmpty ? null : _comment.text.trim());
      if (mounted) context.go('/home');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.rateTitle)),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 20),
                  Center(
                    child: RatingStars(
                      value: _score.toDouble(),
                      size: 44,
                      onRate: (v) => setState(() => _score = v),
                    ),
                  ),
                  const SizedBox(height: 32),
                  KayaTextField(
                    label: l10n.rateComment,
                    controller: _comment,
                    maxLines: 4,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(_error!,
                        style: AppTypography.caption
                            .copyWith(color: AppColors.danger)),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: KayaButton(
                label: l10n.rateSubmit,
                loading: _loading,
                onPressed: _submit,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
