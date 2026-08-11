import { queryKeys, type Rating } from "@kaya/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { api } from "../api/client";

export interface RatingInput {
  /** 1-5. Zero means the user has not chosen, and the screen refuses to send it. */
  score: number;
  /** Optional free text; omitted when blank. */
  comment: string;
  /**
   * The user being rated -- the delivery's driver, from the client's side.
   * The backend requires it and cross-checks it against the delivery's own
   * participants; sending without it was the first live rating's 400
   * ("toUserId must be a UUID"), found on the emulator after the first
   * delivered course.
   */
  toUserId: string;
}

/**
 * Rates a completed delivery.
 *
 * Never retried. A rating is not idempotent on this backend -- `POST
 * /deliveries/:id/rate` creates a row -- and a driver's score decides how much
 * work they are offered, so a replayed request is a second opinion the user
 * never held.
 */
export function useRateDelivery(
  deliveryId: string,
): UseMutationResult<Rating, unknown, RatingInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ score, comment, toUserId }: RatingInput) => {
      const trimmed = comment.trim();
      return api.rateDelivery(deliveryId, {
        score,
        toUserId,
        ...(trimmed === "" ? {} : { comment: trimmed }),
      });
    },
    onSuccess: () => {
      // The delivery now carries a rating, and the driver's average moved.
      void queryClient.invalidateQueries({ queryKey: queryKeys.delivery(deliveryId) });
    },
  });
}
