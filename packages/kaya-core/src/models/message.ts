import { z } from "zod";
import { boolLike, dateLike, stringLike, stringLikeOrNull } from "../wire/coerce";

/** A chat message scoped to a delivery. Mirrors backend `messages`. */
export const messageSchema = z.object({
  id: stringLike(),
  deliveryId: stringLike(),
  senderId: stringLike(),
  receiverId: stringLikeOrNull(),
  messageText: stringLikeOrNull(),
  imageUrl: stringLikeOrNull(),
  isRead: boolLike(false),
  createdAt: dateLike(),
});

export type Message = z.infer<typeof messageSchema>;

export const hasImage = (m: Message): boolean =>
  m.imageUrl !== null && m.imageUrl.length > 0;
