import { ImageAdapter } from "@kaya/ui";
import { useCallback, useRef, useState } from "react";
import { api } from "../api/client";

/** Longest edge, in pixels, a delivery photo is stored at. */
const PHOTO_MAX_WIDTH = 1280;

export interface DeliveryPhoto {
  /** Opens the camera, compresses, uploads. Resolves the storage key, or null. */
  capture: () => Promise<string | null>;
  uploading: boolean;
}

/**
 * The pickup/delivery photo: camera, compress, upload, key.
 *
 * Camera only, never the library. The photo is evidence that this package was
 * in this driver's hands at this moment; a picture chosen from the gallery
 * proves nothing, and the product spec says so.
 *
 * The result is a storage KEY, not a local path. An earlier shape of this flow
 * would have sent `file:///data/user/0/.../shot.jpg` as `photoUrl` -- a path
 * on one phone's private storage, which the client can never open and support
 * can never review, stored in a column that makes it look like the feature
 * works. `POST /uploads/delivery-photos` exists for this.
 *
 * Every failure resolves null rather than throwing, and the caller continues
 * the run without a photo. A driver standing at a door with a package cannot
 * be blocked because the camera was refused, the compressor failed, or the
 * upload timed out on a bad connection -- the transition itself takes the
 * photo as optional (`DeliveryPhotoDto`), and that is the right trade.
 */
export function useDeliveryPhoto(): DeliveryPhoto {
  const [uploading, setUploading] = useState(false);
  const adapter = useRef(new ImageAdapter()).current;

  const capture = useCallback(async (): Promise<string | null> => {
    const shot = await adapter.capture();
    if (shot === null) return null;

    setUploading(true);
    try {
      const compressed = await adapter.compress(shot.uri, { maxWidth: PHOTO_MAX_WIDTH });
      const { key } = await api.uploadImage("delivery-photos", {
        uri: compressed.uri,
        name: "pickup.jpg",
        type: "image/jpeg",
      });
      return key;
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  }, [adapter]);

  return { capture, uploading };
}
