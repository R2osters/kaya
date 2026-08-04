import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { ImageAdapter } from "./ImageAdapter";

// Neither module's native binding is available under jest, so both are
// mocked. The behaviour under test is how ImageAdapter handles what each
// mock returns, not the native picker/compressor themselves.
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
}));

const mockedRequestLibraryPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockedRequestCameraPermission = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockedLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockedLaunchCamera = ImagePicker.launchCameraAsync as jest.Mock;
const mockedManipulate = ImageManipulator.manipulateAsync as jest.Mock;

describe("ImageAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("pickFromLibrary", () => {
    it("resolves null -- never rejects -- when permission is denied", async () => {
      mockedRequestLibraryPermission.mockResolvedValue({ status: "denied" });
      const adapter = new ImageAdapter();

      await expect(adapter.pickFromLibrary()).resolves.toBeNull();
      expect(mockedLaunchLibrary).not.toHaveBeenCalled();
    });

    it("resolves null when the user cancels the picker", async () => {
      mockedRequestLibraryPermission.mockResolvedValue({ status: "granted" });
      mockedLaunchLibrary.mockResolvedValue({ canceled: true, assets: null });
      const adapter = new ImageAdapter();

      await expect(adapter.pickFromLibrary()).resolves.toBeNull();
    });

    it("resolves the picked asset", async () => {
      mockedRequestLibraryPermission.mockResolvedValue({ status: "granted" });
      mockedLaunchLibrary.mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file://library/photo.jpg", width: 3024, height: 4032 }],
      });
      const adapter = new ImageAdapter();

      await expect(adapter.pickFromLibrary()).resolves.toEqual({
        uri: "file://library/photo.jpg",
        width: 3024,
        height: 4032,
      });
    });
  });

  describe("capture", () => {
    it("resolves null -- never rejects -- when permission is denied", async () => {
      mockedRequestCameraPermission.mockResolvedValue({ status: "denied" });
      const adapter = new ImageAdapter();

      await expect(adapter.capture()).resolves.toBeNull();
      expect(mockedLaunchCamera).not.toHaveBeenCalled();
    });

    it("resolves null when the user cancels the camera", async () => {
      mockedRequestCameraPermission.mockResolvedValue({ status: "granted" });
      mockedLaunchCamera.mockResolvedValue({ canceled: true, assets: null });
      const adapter = new ImageAdapter();

      await expect(adapter.capture()).resolves.toBeNull();
    });

    it("resolves the captured asset", async () => {
      mockedRequestCameraPermission.mockResolvedValue({ status: "granted" });
      mockedLaunchCamera.mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file://camera/photo.jpg", width: 3024, height: 4032 }],
      });
      const adapter = new ImageAdapter();

      await expect(adapter.capture()).resolves.toEqual({
        uri: "file://camera/photo.jpg",
        width: 3024,
        height: 4032,
      });
    });
  });

  describe("compress", () => {
    it("reduces a large image and returns its new dimensions and byte size", async () => {
      // 4 base64 characters encode 3 bytes; a 1000-char unpadded base64
      // string is therefore 750 bytes.
      const base64 = "A".repeat(1000);
      mockedManipulate.mockResolvedValue({
        uri: "file://camera/photo.jpg.compressed.jpg",
        width: 1024,
        height: 768,
        base64,
      });
      const adapter = new ImageAdapter();

      const result = await adapter.compress("file://camera/photo.jpg", {
        maxWidth: 1024,
        maxHeight: 768,
        quality: 0.6,
      });

      expect(mockedManipulate).toHaveBeenCalledWith(
        "file://camera/photo.jpg",
        [{ resize: { width: 1024, height: 768 } }],
        expect.objectContaining({ compress: 0.6, format: "jpeg", base64: true }),
      );
      expect(result).toEqual({
        uri: "file://camera/photo.jpg.compressed.jpg",
        width: 1024,
        height: 768,
        bytes: 750,
      });
    });

    it("compresses without a resize action when no max dimensions are given", async () => {
      mockedManipulate.mockResolvedValue({
        uri: "file://camera/photo.jpg.compressed.jpg",
        width: 3024,
        height: 4032,
        base64: "",
      });
      const adapter = new ImageAdapter();

      await adapter.compress("file://camera/photo.jpg");

      expect(mockedManipulate).toHaveBeenCalledWith(
        "file://camera/photo.jpg",
        [],
        expect.any(Object),
      );
    });

    it("defaults to a mid-range quality when none is given", async () => {
      mockedManipulate.mockResolvedValue({
        uri: "file://camera/photo.jpg.compressed.jpg",
        width: 3024,
        height: 4032,
        base64: "",
      });
      const adapter = new ImageAdapter();

      await adapter.compress("file://camera/photo.jpg");

      expect(mockedManipulate).toHaveBeenCalledWith(
        "file://camera/photo.jpg",
        expect.any(Array),
        expect.objectContaining({ compress: expect.any(Number) }),
      );
    });
  });
});
