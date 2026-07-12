import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import 'place.dart';

/// Address autocomplete. Pops with the selected [Place].
class AddressSearchScreen extends StatefulWidget {
  const AddressSearchScreen({super.key, this.title});
  final String? title;

  @override
  State<AddressSearchScreen> createState() => _AddressSearchScreenState();
}

class _AddressSearchScreenState extends State<AddressSearchScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final results = kSampleplaces
        .where((p) =>
            _query.isEmpty ||
            '${p.name} ${p.area}'.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Scaffold(
      appBar:
          AppBar(title: Text(widget.title ?? KayaL10n.of(context).addressTitle)),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: KayaTextField(
                hint: KayaL10n.of(context).homeSearchHint,
                prefixIcon: Icons.search_rounded,
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            Expanded(
              child: ListView.separated(
                itemCount: results.length,
                separatorBuilder: (_, __) => const Divider(indent: 64),
                itemBuilder: (_, i) {
                  final p = results[i];
                  return ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: AppColors.primaryTint,
                      child: Icon(Icons.place_outlined, color: AppColors.primary),
                    ),
                    title: Text(p.name, style: AppTypography.bodyStrong),
                    subtitle: Text(p.area, style: AppTypography.caption),
                    onTap: () => context.pop(p),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
