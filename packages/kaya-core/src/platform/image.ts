/** A picked or produced image, before compression. */
export interface ImageAsset {
  uri: string;
  width: number;
  height: number;
}

/** An image after compress(), with its resulting file size known. */
export interface CompressedImage extends ImageAsset {
  /** Size of the compressed file, in bytes. */
  bytes: number;
}

export interface CompressOptions {
  /** Maximum output width, in pixels. Aspect ratio is preserved. */
  maxWidth?: number;
  /** Maximum output height, in pixels. Aspect ratio is preserved. */
  maxHeight?: number;
  /** Compression level: 0 (smallest file) to 1 (highest fidelity). */
  quality?: number;
}

/**
 * Platform boundary for picking and compressing photos. The pickup and
 * delivery photo flows depend on this interface, never on expo-image-picker
 * or expo-image-manipulator directly, so a test double or a future platform
 * swap does not have to reach into every screen that captures a proof photo.
 * The concrete implementation lives in @kaya/ui: see
 * packages/kaya-ui/src/adapters/ImageAdapter.ts.
 *
 * Permission handling follows the same convention as LocationProvider (see
 * platform/location.ts): a denial or a user-cancelled picker are both
 * ordinary, recoverable outcomes here, not exceptions, and both resolve null
 * rather than reject. A screen cannot tell the two apart from the return
 * value alone, and by design does not need to — "no photo obtained" is the
 * same next state either way, whereas an actual failure (e.g. compress()
 * hitting a corrupt file) still throws.
 *
 * compress() is not optional: the pickup and delivery photo flows call it on
 * every image before upload, so it is part of this contract rather than a
 * convenience left to individual screens. It always resolves the result of
 * compression — there is no "cancelled" outcome for it, because there is no
 * user interaction to cancel.
 */
export interface ImageProvider {
  /** Resolves null if the user cancels the picker or denies permission. */
  pickFromLibrary(): Promise<ImageAsset | null>;

  /** Resolves null if the user cancels the camera or denies permission. */
  capture(): Promise<ImageAsset | null>;

  /** Compresses (and optionally resizes) the image at `uri`. */
  compress(uri: string, options?: CompressOptions): Promise<CompressedImage>;
}
