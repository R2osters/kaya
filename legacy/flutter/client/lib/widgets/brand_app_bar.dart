import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

/// Top brand bar matching the reference: leading menu, centered wordmark,
/// trailing notification bell. Brand text always reads from [kAppName].
class BrandAppBar extends StatelessWidget implements PreferredSizeWidget {
  const BrandAppBar({super.key, this.showBell = true, this.onMenu});

  final bool showBell;
  final VoidCallback? onMenu;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      leading: IconButton(
        icon: const Icon(Icons.menu_rounded),
        onPressed: onMenu ?? () {},
      ),
      title: Text(
        kAppName,
        style: AppTypography.sectionTitle.copyWith(color: AppColors.primary),
      ),
      centerTitle: true,
      actions: [
        if (showBell)
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () => context.push('/notifications'),
          ),
      ],
      bottom: const PreferredSize(
        preferredSize: Size.fromHeight(1),
        child: Divider(height: 1),
      ),
    );
  }
}
