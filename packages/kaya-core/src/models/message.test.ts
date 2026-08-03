import { hasImage, messageSchema } from "./message";

const CAMEL = {
  id: "m1",
  deliveryId: "d1",
  senderId: "u1",
  receiverId: "u2",
  messageText: "On my way to pickup.",
  imageUrl: null,
  isRead: false,
  createdAt: "2026-08-02T10:44:00.000Z",
};

const SNAKE = {
  id: "m1",
  delivery_id: "d1",
  sender_id: "u1",
  receiver_id: "u2",
  message_text: "On my way to pickup.",
  image_url: null,
  is_read: false,
  created_at: "2026-08-02T10:44:00.000Z",
};

describe("messageSchema", () => {
  it("parses the camelCase REST shape", () => {
    const m = messageSchema.parse(CAMEL);
    expect(m.deliveryId).toBe("d1");
    expect(m.senderId).toBe("u1");
    expect(m.messageText).toBe("On my way to pickup.");
    expect(m.isRead).toBe(false);
    expect(m.createdAt.toISOString()).toBe("2026-08-02T10:44:00.000Z");
  });

  it("parses the snake_case socket shape identically", () => {
    // The Socket.io gateway emits snake_case for chat:* events while REST sends
    // camelCase; both must land on the same parsed object.
    expect(messageSchema.parse(SNAKE)).toEqual(messageSchema.parse(CAMEL));
  });

  it("prefers camelCase when a payload carries both spellings", () => {
    const m = messageSchema.parse({
      ...SNAKE,
      deliveryId: "camel-wins",
      messageText: "camel text",
      isRead: true,
    });
    expect(m.deliveryId).toBe("camel-wins");
    expect(m.messageText).toBe("camel text");
    expect(m.isRead).toBe(true);
  });

  it("falls back to snake_case when the camelCase key is null", () => {
    const m = messageSchema.parse({ ...SNAKE, deliveryId: null });
    expect(m.deliveryId).toBe("d1");
  });

  it("reports an attached image from either spelling", () => {
    expect(hasImage(messageSchema.parse(CAMEL))).toBe(false);
    expect(
      hasImage(messageSchema.parse({ ...SNAKE, image_url: "https://x/p.jpg" })),
    ).toBe(true);
  });
});
