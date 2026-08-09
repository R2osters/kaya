# Kaya — plateforme de livraison à la demande (Afrique de l'Ouest)

Mise en relation clients ↔ livreurs indépendants au **Ghana, Togo et Bénin** :
enchères inversées, paiement séquestre mobile money, commission dégressive,
suivi GPS temps réel, chat intégré, conformité locale (PCSRC / carte pro / permis livreur).

> « Kaya » est le nom de travail (le nom final n'est pas choisi). Voir `BLUEPRINT.md`
> pour le scope, les décisions et les jalons ; `docs/SECURITY_AUDIT.md` pour l'audit.

## Architecture

```mermaid
flowchart LR
  subgraph Mobile [React Native 0.81 · Expo 54]
    C[App Client] --- K[("@kaya/core + @kaya/ui<br/>thème · API · socket · i18n")]
    D[App Livreur] --- K
  end
  K -- REST /api/v1 + JWT --> A[NestJS API]
  K -- Socket.io --> A
  A --- P[(PostgreSQL 16 + PostGIS)]
  A --- R[(Redis 7<br/>GPS · throttles · rooms)]
  A --- S[(S3 / MinIO<br/>photos & documents)]
  A -.webhooks.-> G[Paystack · Kkiapay<br/>mock en dev]
  A -.push.-> F[FCM]
  W[SPA Admin] -- REST admin --> A
```

Monorepo :

| Dossier | Contenu |
|---|---|
| `backend/` | API NestJS 10 + Prisma (auth OTP/JWT, commandes, enchères, escrow, commission, litiges, admin) |
| `packages/kaya-core/` | Package partagé sans UI : modèles + schémas Zod, client API axios, règles monétaires, service Socket.io, clés de cache, i18n FR/EN. Ne dépend ni de React ni d'Expo — une règle de lint le vérifie |
| `packages/kaya-ui/` | Design system « Accra Minimalist Delivery » : thème, composants, abstraction carte, adaptateurs plateforme (keychain, localisation, images, push) |
| `apps/client/` · `apps/driver/` | Les deux apps mono-rôle (Expo Router, TanStack Query, Zustand) |
| `tools/` | `devFlagGuard` : refuse un build qui embarquerait `SKIP_AUTH` ailleurs qu'en local |
| `legacy/flutter/` | L'implémentation Flutter d'origine, gardée comme référence de portage (plus testée en CI) |
| `admin/` | SPA admin minimale (statique) |
| `docs/` | Doc d'architecture, référence design, audit sécurité, OpenAPI |

## Démarrage développement

Prérequis : Node 20+ (22 en CI), Docker Desktop, Android Studio ou Xcode.

> Les apps ont besoin d'un **development build**, pas d'Expo Go :
> `@react-native-firebase/messaging` ne tourne pas sous Expo Go.

```bash
# 1. Infrastructure (PostGIS + Redis + MinIO)
docker compose up -d

# 2. Backend
cd backend
npm ci
npx tsx scripts/generate-keys.ts     # clés JWT RS256 de dev -> ./keys (gitignoré)
cp .env.example .env                 # défauts dev prêts à l'emploi
npx prisma migrate dev
npm run db:seed                      # country_configs GHA/TGO/BEN + admin
npm run start:dev                    # API sur :3000, Swagger sur /docs

# 3. Apps mobiles (autre terminal, depuis la racine du monorepo)
npm ci
API_BASE_URL=http://10.0.2.2:3000 npm run android -w client   # émulateur Android
# iOS/simulateur : http://localhost:3000
# Tuiles de carte réelles : MAPS_API_KEY=... (sinon style OSM sans clé)
# Le showcase du design system : route /showcase dans les deux apps
```

Paiement en dev : gateway **mock** (aucune clé requise) —
`POST /api/v1/payments/mock/complete/:reference` simule le paiement (désactivé en production).

## Variables d'environnement

`backend/.env.example` est exhaustif et commenté — groupes principaux :

| Groupe | Variables clés | Notes |
|---|---|---|
| App | `NODE_ENV`, `PORT`, `APP_NAME` | `production` durcit mock/paiement & CORS |
| Données | `DATABASE_URL`, `REDIS_URL` | PostGIS requis |
| JWT | `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `JWT_ISSUER`, `JWT_AUDIENCE` | RS256 ; chemin de fichier ou PEM inline |
| HTTP | `CORS_ORIGINS`, `THROTTLE_TTL`, `THROTTLE_LIMIT` | whitelist obligatoire en prod (HTTP **et** Socket.io) |
| Stockage | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE`, `UPLOAD_MAX_BYTES` | MinIO en dev, R2/S3 en prod |
| OTP | `OTP_PROVIDER`, `OTP_LENGTH`, `OTP_TTL_MIN`, `OTP_SEND_MAX`, `OTP_SEND_WINDOW_MIN` | provider `dev` = code en console |
| Métier | `OFFER_TTL_MIN`, tarifs par pays en DB (`country_configs`) | modifiables via l'API admin |
| Cartographie | `MAPS_PROVIDER` (`haversine` \| `osrm` \| `google`), `OSRM_BASE_URL`, `GOOGLE_MAPS_API_KEY` | `haversine` est une ligne droite × 1,3 : pratique, mais faux de ±15 % sur un vrai réseau routier, et le prix d'une course en dépend. `osrm` donne la distance routière réelle |
| Géocodage | `GEOCODING_PROVIDER` (`photon` \| `static`), `PHOTON_BASE_URL` | `photon` sans clé par défaut, repli sur une liste de repères hors-ligne. Nominatim est écarté : sa politique interdit l'auto-complétion |
| Intégrations | `PAYSTACK_SECRET_KEY`, `KKIAPAY_SECRET_KEY`, `FIREBASE_SERVICE_ACCOUNT` | absentes ⇒ fallbacks/mocks de dev |

## Tests & CI

```bash
cd backend && npm test        # unitaires + e2e (e2e auto-skippés sans DB)
npm test --workspaces         # @kaya/core, @kaya/ui, client, driver, tools
```

Flux de fumée sur appareil (development build + backend dockerisé) :

```bash
maestro test apps/client/maestro/smoke.yaml
```

CI GitHub Actions, un workflow par périmètre : `ci.yml` (backend : prisma
validate + lint + build + test), `core.yml`, `ui.yml`, `client.yml`,
`driver.yml`, `tools.yml` (lint + typecheck + test chacun). Le job Flutter a été
retiré avec la migration — voir le journal des décisions du 2026-08-09.

## Production

- Image : `backend/Dockerfile` (multi-stage, non-root, HEALTHCHECK `/health`).
- Orchestration : `docker-compose.prod.yml` (MinIO optionnel via `--profile minio`).
- Migrations : `npx prisma migrate deploy` au déploiement, **avant** de basculer le
  trafic ; rollback = redéployer l'image précédente (les migrations sont additives ;
  ne jamais `migrate reset` en prod).
- Secrets par variables d'environnement / secret manager — jamais dans l'image.
- Rotation des clés JWT : publier la nouvelle clé publique, accepter les deux le temps
  du TTL refresh (7 j), puis retirer l'ancienne.
- Checklist complète avant mise en ligne : `docs/SECURITY_AUDIT.md` (§ Actions utilisateur).
