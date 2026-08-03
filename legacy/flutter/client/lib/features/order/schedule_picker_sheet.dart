import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:kaya_core/kaya_core.dart';

/// Day + hour scheduling sheet. Returns the chosen [DateTime] (local) or null.
class SchedulePickerSheet extends StatefulWidget {
  const SchedulePickerSheet({super.key});

  @override
  State<SchedulePickerSheet> createState() => _SchedulePickerSheetState();
}

class _SchedulePickerSheetState extends State<SchedulePickerSheet> {
  late DateTime _day;
  int _hour = 9;

  @override
  void initState() {
    super.initState();
    _day = DateTime.now().add(const Duration(days: 1));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final days = List.generate(
        7, (i) => DateTime.now().add(Duration(days: i + 1)));

    return BottomSheetShell(
      title: l10n.orderSchedule,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l10n.orderScheduleDay, style: AppTypography.overline),
          const SizedBox(height: 10),
          SizedBox(
            height: 78,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: days.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, i) {
                final d = days[i];
                final active = d.day == _day.day && d.month == _day.month;
                return GestureDetector(
                  onTap: () => setState(() => _day = d),
                  child: Container(
                    width: 60,
                    decoration: BoxDecoration(
                      color: active ? AppColors.primary : AppColors.surface,
                      borderRadius: BorderRadius.circular(AppRadii.field),
                      border: Border.all(
                          color: active ? AppColors.primary : AppColors.border),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(DateFormat.E(lang).format(d),
                            style: AppTypography.caption.copyWith(
                              color: active
                                  ? AppColors.surface
                                  : AppColors.inkSecondary,
                            )),
                        const SizedBox(height: 4),
                        Text('${d.day}',
                            style: AppTypography.cardTitle.copyWith(
                              color:
                                  active ? AppColors.surface : AppColors.ink,
                            )),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 20),
          Text(l10n.orderScheduleHour, style: AppTypography.overline),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: List.generate(12, (i) => 7 + i).map((h) {
              final active = h == _hour;
              return GestureDetector(
                onTap: () => setState(() => _hour = h),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: active ? AppColors.primaryTint : AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                    border: Border.all(
                        color: active ? AppColors.primary : AppColors.border),
                  ),
                  child: Text('${h.toString().padLeft(2, '0')}:00',
                      style: AppTypography.caption.copyWith(
                        color:
                            active ? AppColors.primary : AppColors.inkSecondary,
                        fontWeight: FontWeight.w700,
                      )),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          KayaButton(
            label: l10n.actionConfirm,
            onPressed: () {
              final result = DateTime(
                  _day.year, _day.month, _day.day, _hour);
              Navigator.of(context).pop(result);
            },
          ),
        ],
      ),
    );
  }
}
