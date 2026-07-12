import 'dart:io';

import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart' as pp;

/// Compresses images before upload to keep payloads small on 3G networks.
/// Falls back to the original file if the platform codec is unavailable.
class ImageCompression {
  const ImageCompression();

  /// Compress [source] to JPEG. Returns a temp file (or the original on failure).
  Future<File> compress(
    File source, {
    int quality = 70,
    int maxWidth = 1280,
    int maxHeight = 1280,
  }) async {
    try {
      final dir = await pp.getTemporaryDirectory();
      final target =
          '${dir.path}/kaya_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final result = await FlutterImageCompress.compressAndGetFile(
        source.absolute.path,
        target,
        quality: quality,
        minWidth: maxWidth,
        minHeight: maxHeight,
        format: CompressFormat.jpeg,
      );
      return result == null ? source : File(result.path);
    } catch (_) {
      return source;
    }
  }
}
