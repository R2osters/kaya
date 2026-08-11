# Kaya — Product

On-demand delivery for West Africa (Ghana, Togo, Benin). Clients post a
delivery; nearby independent drivers bid a price (reverse auction); the client
accepts one, pays into escrow via mobile money or card, follows the driver
live on a map, chats, and rates. Drivers earn per delivery under a degressive
commission. Two mono-role React Native apps (client, driver) on a NestJS
backend. `BLUEPRINT.md` is the scope authority; `docs/DESIGN_REFERENCE.md` and
the HTML prototypes are the visual reference.

## Register

**Product.** Design serves the flow: someone standing on a kerb in Accra with a
parcel and patchy 4G, or a driver on a moto between two jobs. Speed of
comprehension beats spectacle. The benchmark the user named is Uber/Bolt:
map-first, one obvious action per screen, instant touch feedback, quiet chrome.

## Design system

"Accra Minimalist Delivery" — committed identity, preserve it:

- Brand `#1466FF` on white surfaces over a cool `#F4F6F9` canvas; green
  `#12A150` = pickup/success, blue = drop-off, red `#E5484D` = danger only.
- Inter, weight-led hierarchy (800 display / 700 titles / 600 emphasis / 400
  body). Money is always 800.
- Soft depth (ink-tinted shadows, 0.04–0.10 opacity), generous radii
  (14–28px), pill accents.
- Tokens live in `packages/kaya-ui/src/theme/`; a lint rule bans colour
  literals in the apps. Every UI string goes through i18n (FR default, EN).

## Constraints

- Two languages, zero-decimal XOF money formatting, offline-tolerant screens
  (four states each: loading / empty / error / content).
- Touch targets ≥ 44px. Android is the primary device class; test on it.
- No dark theme in v1 (out of scope per BLUEPRINT).
