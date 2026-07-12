import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../providers/core_providers.dart';

class PaymentWebviewArgs {
  const PaymentWebviewArgs({
    required this.url,
    required this.reference,
    required this.deliveryId,
  });
  final String url;
  final String reference;
  final String deliveryId;
}

/// Hosts the PSP checkout page. On a return/callback URL we verify the payment
/// with the backend, then pop `true` to advance to the receipt.
class PaymentWebviewScreen extends ConsumerStatefulWidget {
  const PaymentWebviewScreen({super.key, required this.args});
  final PaymentWebviewArgs args;

  @override
  ConsumerState<PaymentWebviewScreen> createState() =>
      _PaymentWebviewScreenState();
}

class _PaymentWebviewScreenState extends ConsumerState<PaymentWebviewScreen> {
  late final WebViewController _controller;
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (request) {
          final url = request.url.toLowerCase();
          if (url.contains('callback') ||
              url.contains('return') ||
              url.contains('status=success') ||
              url.contains('/payments/verify')) {
            _verify();
            return NavigationDecision.prevent;
          }
          return NavigationDecision.navigate;
        },
      ))
      ..loadRequest(Uri.parse(widget.args.url));
  }

  Future<void> _verify() async {
    if (_verifying) return;
    setState(() => _verifying = true);
    try {
      await ref.read(kayaApiProvider).payments.verify(widget.args.reference);
      if (mounted) context.pop(true);
    } on ApiFailure catch (e) {
      if (mounted) {
        setState(() => _verifying = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(KayaL10n.of(context).payTitle)),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_verifying)
            const ColoredBox(
              color: Color(0x88FFFFFF),
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }
}
