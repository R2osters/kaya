import { z } from "zod";
import { boolLike, dateLike, stringLike, stringLikeOrNull } from "../wire/coerce";

/** camelCase wins when a payload carries both spellings of the same field. */
const pick = (camel: unknown, snake: unknown): unknown =>
  camel === undefined || camel === null ? snake : camel;

const parsedMessage = z.object({
  id: stringLike(),
  deliveryId: stringLike(),
  senderId: stringLike(),
  receiverId: stringLikeOrNull(),
  messageText: stringLikeOrNull(),
  imageUrl: stringLikeOrNull(),
  isRead: boolLike(false),
  createdAt: dateLike(),
});

/**
 * A chat message scoped to a delivery. Mirrors backend `messages`.
 *
 * Every field except `id` accepts both a camelCase and a snake_case wire key.
 * That is not defensive noise: the REST endpoints send camelCase while the
 * Socket.io gateway emits snake_case for `chat:*` events, and the realtime chat
 * event schema is this same schema. Reading camelCase alone would parse every
 * live message into empty strings and blank the chat screen.
 */
export const messageSchema = z
  .object({
    id: z.unknown(),
    deliveryId: z.unknown(),
    delivery_id: z.unknown(),
    senderId: z.unknown(),
    sender_id: z.unknown(),
    receiverId: z.unknown(),
    receiver_id: z.unknown(),
    messageText: z.unknown(),
    message_text: z.unknown(),
    imageUrl: z.unknown(),
    image_url: z.unknown(),
    isRead: z.unknown(),
    is_read: z.unknown(),
    createdAt: z.unknown(),
    created_at: z.unknown(),
  })
  .transform((m) =>
    parsedMessage.parse({
      id: m.id,
      deliveryId: pick(m.deliveryId, m.delivery_id),
      senderId: pick(m.senderId, m.sender_id),
      receiverId: pick(m.receiverId, m.receiver_id),
      messageText: pick(m.messageText, m.message_text),
      imageUrl: pick(m.imageUrl, m.image_url),
      isRead: pick(m.isRead, m.is_read),
      createdAt: pick(m.createdAt, m.created_at),
    }),
  );

export type Message = z.infer<typeof messageSchema>;

export const hasImage = (m: Message): boolean =>
  m.imageUrl !== null && m.imageUrl.length > 0;
