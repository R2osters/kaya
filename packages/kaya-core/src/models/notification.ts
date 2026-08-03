import { z } from "zod";
import { dateLike, dateLikeOrNull, jsonMap, stringLike } from "../wire/coerce";
import { notificationType } from "../wire/enums";

/** An in-app notification row. Mirrors backend `notifications`. */
export const appNotificationSchema = z.object({
  id: stringLike(),
  type: notificationType,
  title: stringLike(),
  body: stringLike(),
  data: jsonMap(),
  readAt: dateLikeOrNull(),
  createdAt: dateLike(),
});

export type AppNotification = z.infer<typeof appNotificationSchema>;

export const isRead = (n: AppNotification): boolean => n.readAt !== null;
