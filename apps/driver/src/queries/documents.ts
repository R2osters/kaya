import type { User } from "@kaya/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../state/authStore";

/** Which document a driver is submitting. */
export type DocumentKind = "id" | "license";

export interface DocumentUpload {
  kind: DocumentKind;
  uri: string;
}

/**
 * Submits an identity document (`POST /auth/upload-id` or `/auth/upload-license`).
 *
 * Both endpoints answer with the updated user, so the auth store is refreshed
 * from the response rather than refetched: the whole point of the screen is to
 * see the document you just sent appear against your name, and a round trip to
 * learn what was already returned would leave it blank for a beat.
 *
 * Not retried. The endpoints overwrite the stored key, so a replay is not
 * destructive -- but it is a second full-size image sent over a metered
 * connection to reach exactly the state the first one already reached.
 */
export function useUploadDocument(): UseMutationResult<User, unknown, DocumentUpload> {
  return useMutation({
    mutationFn: ({ kind, uri }: DocumentUpload) => {
      const file = { uri, name: `${kind}.jpg`, type: "image/jpeg" };
      return kind === "id" ? api.uploadIdCard(file) : api.uploadLicense(file);
    },
    onSuccess: (user) => {
      // Into the store, which is the only copy the screens read; writing a
      // `["auth","me"]` query entry too would look tidy and change nothing,
      // since nothing subscribes to it.
      useAuthStore.setState({ user });
    },
  });
}
