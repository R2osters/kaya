import { z } from "zod";
import { decimalLike, intLike, stringLike, stringLikeOrNull } from "../wire/coerce";

/**
 * The other person on a delivery, as one participant is allowed to see them.
 *
 * A deliberately small shape, matching `PARTICIPANT_SELECT` in
 * backend/src/deliveries/deliveries.service.ts exactly: a name to greet, a
 * face to recognise, a phone to call when the address is wrong, and the
 * ratings that say who you are dealing with.
 *
 * It is not `User`. Parsing these seven fields with `userSchema` would
 * succeed -- every missing field has a fallback -- and hand a screen an email
 * of `""`, a role of `"client"` and a balance of `0` for someone whose email,
 * role and balance were never sent. A screen that then shows any of them is
 * showing an invention, and nothing anywhere would have failed.
 */
export const participantSchema = z.object({
  id: stringLike(),
  fullName: stringLike(),
  profilePhoto: stringLikeOrNull(),
  phone: stringLike(),
  ratingDriver: decimalLike(5),
  ratingClient: decimalLike(5),
  totalDeliveries: intLike(0),
});

export type Participant = z.infer<typeof participantSchema>;
