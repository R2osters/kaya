# Kaya — instructions projet

Plateforme de livraison à la demande, Afrique de l'Ouest (Ghana/Togo/Bénin).

## Source de vérité
1. `BLUEPRINT.md` — scope, stack, jalons, decisions log. Toute déviation s'y consigne.
2. `docs/Architecture_Livraison_MultiPays.md` — schéma DB, endpoints, flux métier, config pays.
3. `docs/DESIGN_REFERENCE.md` + prototypes `D:\prototype\Application de livraison ghanéenne\` (`Kaya Client.dc.html`, `Kaya Livreur.dc.html`, PNG dans `ref/`) — référence visuelle 1:1 pour les apps Flutter.

## Structure
- `backend/` — NestJS 10 + TypeScript + Prisma + PostgreSQL/PostGIS + Redis + Socket.io.
- `apps/client/`, `apps/driver/` — deux apps Flutter mono-rôle (Riverpod).
- `packages/kaya_core/` — package Flutter partagé (thème, modèles, API client, socket, i18n FR/EN). Interdiction de dupliquer thème/widgets de base dans les apps.
- `admin/` — back-office web minimal (jalon M5).

## Règles
- Nom final de l'app non choisi : « Kaya » = nom de travail. Pas de branding en dur ; constante `APP_NAME` centralisée.
- Montants : `Decimal`, jamais de float. Devise portée par `country_configs` (GHS/XOF). Ledger `transactions` append-only.
- Commission dégressive : palier déterminé par le numéro de la livraison du jour (7e = 15 %). Reset minuit, timezone pays.
- Prix minimum : `distance_km × price_per_km + base_pickup_fee` (valeurs `country_configs`).
- API versionnée `/api/v1`. Validation stricte (class-validator/Zod). JWT RS256 15 min + refresh 7 j.
- Intégrations externes (Paystack/Kkiapay, SMS, FCM, Google Maps) : toujours derrière une interface avec implémentation mock/sandbox utilisable sans clé.
- Code + commentaires en anglais ; textes UI via i18n FR/EN.
- Tests obligatoires sur les chemins d'argent (escrow, commission, retraits) avant merge du jalon M3+.
