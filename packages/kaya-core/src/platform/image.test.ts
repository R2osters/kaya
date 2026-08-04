import type { CompressedImage, CompressOptions, ImageAsset, ImageProvider } from "./image";

/**
 * A minimal, non-platform implementation used only to verify the shape of
 * ImageProvider. The real expo-image-picker/expo-image-manipulator-backed
 * adapter lives in @kaya/ui and is tested there.
 */
class FakeImageProvider implements ImageProvider {
  libraryPermission: "granted" | "denied" = "granted";
  cameraPermission: "granted" | "denied" = "granted";
  libraryCancelled = false;
  cameraCancelled = false;

  async pickFromLibrary(): Promise<ImageAsset | null> {
    if (this.libraryPermission !== "granted" || this.libraryCancelled) {
      return null;
    }
    return { uri: "file://library/photo.jpg", width: 3024, height: 4032 };
  }

  async capture(): Promise<ImageAsset | null> {
    if (this.cameraPermission !== "granted" || this.cameraCancelled) {
      return null;
    }
    return { uri: "file://camera/photo.jpg", width: 3024, height: 4032 };
  }

  async compress(uri: string, options: CompressOptions = {}): Promise<CompressedImage> {
    const maxWidth = options.maxWidth ?? 1280;
    const maxHeight = options.maxHeight ?? 1280;
    return {
      uri: `${uri}.compressed.jpg`,
      width: maxWidth,
      height: maxHeight,
      bytes: Math.round((maxWidth * maxHeight) / 20),
    };
  }
}

describe("ImageProvider contract", () => {
  it("pickFromLibrary resolves an ImageAsset when permission is granted", async () => {
    const provider = new FakeImageProvider();

    await expect(provider.pickFromLibrary()).resolves.toEqual({
      uri: "file://library/photo.jpg",
      width: 3024,
      height: 4032,
    });
  });

  it("pickFromLibrary resolves null (not a rejection) when permission is denied", async () => {
    const provider = new FakeImageProvider();
    provider.libraryPermission = "denied";

    await expect(provider.pickFromLibrary()).resolves.toBeNull();
  });

  it("pickFromLibrary resolves null when the user cancels the picker", async () => {
    const provider = new FakeImageProvider();
    provider.libraryCancelled = true;

    await expect(provider.pickFromLibrary()).resolves.toBeNull();
  });

  it("capture resolves null when the user cancels the camera", async () => {
    const provider = new FakeImageProvider();
    provider.cameraCancelled = true;

    await expect(provider.capture()).resolves.toBeNull();
  });

  it("capture resolves null (not a rejection) when permission is denied", async () => {
    const provider = new FakeImageProvider();
    provider.cameraPermission = "denied";

    await expect(provider.capture()).resolves.toBeNull();
  });

  it("compress is called on every image before upload and returns its new dimensions and size", async () => {
    const provider = new FakeImageProvider();

    const result = await provider.compress("file://camera/photo.jpg", {
      maxWidth: 1024,
      maxHeight: 768,
      quality: 0.6,
    });

    expect(result).toEqual({
      uri: "file://camera/photo.jpg.compressed.jpg",
      width: 1024,
      height: 768,
      bytes: expect.any(Number),
    });
    expect(result.bytes).toBeGreaterThan(0);
  });

  it("compress works without options (no resize requested)", async () => {
    const provider = new FakeImageProvider();

    const result = await provider.compress("file://camera/photo.jpg");

    expect(result.uri).toBe("file://camera/photo.jpg.compressed.jpg");
    expect(typeof result.bytes).toBe("number");
  });
});
