import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../app_colors.dart';
import '../app_typography.dart';

/// Labelled text field consistent with the design system input theme.
class KayaTextField extends StatelessWidget {
  const KayaTextField({
    super.key,
    this.label,
    this.hint,
    this.controller,
    this.keyboardType,
    this.obscureText = false,
    this.prefixIcon,
    this.suffixIcon,
    this.maxLines = 1,
    this.onChanged,
    this.validator,
    this.inputFormatters,
    this.enabled = true,
    this.textInputAction,
  });

  final String? label;
  final String? hint;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final bool obscureText;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final int maxLines;
  final ValueChanged<String>? onChanged;
  final String? Function(String?)? validator;
  final List<TextInputFormatter>? inputFormatters;
  final bool enabled;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          Text(label!, style: AppTypography.bodyStrong),
          const SizedBox(height: 8),
        ],
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscureText,
          maxLines: obscureText ? 1 : maxLines,
          onChanged: onChanged,
          validator: validator,
          inputFormatters: inputFormatters,
          enabled: enabled,
          textInputAction: textInputAction,
          style: AppTypography.body,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: prefixIcon == null
                ? null
                : Icon(prefixIcon, color: AppColors.inkTertiary, size: 20),
            suffixIcon: suffixIcon,
          ),
        ),
      ],
    );
  }
}
