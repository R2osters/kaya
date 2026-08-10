import { queryKeys, type AuthResult } from "@kaya/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../state/authStore";

/**
 * Development sign-in: exchanges a phone number for a token pair through
 * `POST /auth/login/otp`.
 *
 * The `firebaseIdToken` it sends is `dev:<phone>`, which only the backend's
 * mock verifier accepts (backend/src/auth/verifiers/mock.verifier.ts). Against
 * a backend configured with the real Firebase verifier this call is rejected,
 * by design -- the mock rejects real tokens and the real verifier rejects
 * these, so the two configurations cannot be confused for one another.
 *
 * Slice C replaces this with the real Firebase Phone Auth flow. What lives
 * here is the smallest thing that produces a genuine session, so the rest of
 * slice A can be built against a real backend rather than against fixtures.
 */
export function devTokenFor(phone: string): string {
  return `dev:${phone.trim()}`;
}

export function useSignIn(): UseMutationResult<AuthResult, unknown, string> {
  const signIn = useAuthStore((s) => s.signIn);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phone: string) => {
      const trimmed = phone.trim();
      return api.loginOtp({ phone: trimmed, firebaseIdToken: devTokenFor(trimmed) });
    },
    onSuccess: async (result) => {
      // The store writes the token pair before flipping the status, so the
      // first protected screen's queries find a token already in the keychain
      // rather than 401-ing and bouncing the user back out.
      await signIn(result);
      // A previous session's cached data must not survive into this one. The
      // guard would have shown the new user whatever the last one left behind
      // until each query refetched.
      queryClient.removeQueries();
      queryClient.setQueryData(queryKeys.me(), result.user);
    },
  });
}
