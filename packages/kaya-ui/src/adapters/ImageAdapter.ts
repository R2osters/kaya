import type { CompressedImage, CompressOptions, ImageAsset, ImageProvider } from "@kaya/core";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

const DEFAULT_QUALITY = 0.7;

/**
 * Platform-backed ImageProvider on expo-image-picker (library/camera pick)
 * and expo-image-manipulator (compress). This is the concrete half of the
 * ImageProvider interface @kaya/core declares — see
 * packages/kaya-core/src/platform/image.ts.
 */
export class ImageAdapter implements ImageProvider {
  async pickFromLibrary(): Promise<ImageAsset | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      return null;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
      return firstAsset(result);
    } catch {
      // A recoverable read failure (a permission race, a picker that throws
      // instead of resolving on some devices) degrades to null for the same
      // reason LocationAdapter.getCurrent() and PushAdapter.getToken() do --
      // see adapters/LocationAdapter.ts. A throw here would crash the
      // pickup/delivery photo screen calling this instead of leaving it in
      // the same "no photo obtained" state a cancel already produces.
      return null;
    }
  }

  async capture(): Promise<ImageAsset | null> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      return null;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 1 });
      return firstAsset(result);
    } catch {
      // Same convention as pickFromLibrary() above -- e.g. launchCameraAsync
      // throwing on a simulator with no camera, or a revoked-permission race.
      return null;
    }
  }

  async compress(uri: string, options: CompressOptions = {}): Promise<CompressedImage> {
    const { maxWidth, maxHeight, quality = DEFAULT_QUALITY } = options;
    const actions: ImageManipulator.Action[] =
      maxWidth !== undefined || maxHeight !== undefined
        ? [{ resize: { width: maxWidth, height: maxHeight } }]
        : [];

    // base64 is requested purely to measure the compressed file's byte size
    // -- the pickup/delivery photo flows need `bytes` to know whether the
    // result is small enough to upload -- and is dropped before returning.
    // expo-image-manipulator's ImageResult carries no file-size field on its
    // own, and keeping the base64 payload around would double every photo's
    // memory footprint for no benefit once the size is known.
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      bytes: base64ByteLength(result.base64 ?? ""),
    };
  }
}

function firstAsset(result: ImagePicker.ImagePickerResult): ImageAsset | null {
  if (result.canceled || result.assets === null || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  if (asset === undefined) {
    return null;
  }
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/** Decoded byte length of a (possibly unpadded) base64 string. */
function base64ByteLength(base64: string): number {
  if (base64.length === 0) {
    return 0;
  }
  const withoutPadding = base64.replace(/=+$/, "");
  return Math.floor((withoutPadding.length * 3) / 4);
}
