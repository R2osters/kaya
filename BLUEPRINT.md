# Kaya — Blueprint

> Plateforme de livraison à la demande (type Uber) pour l'Afrique de l'Ouest.
> Source de vérité du projet. Toute déviation = ligne dans le Decisions log.

## Vision

Mettre en relation clients (particuliers/commerçants) et livreurs indépendants au Ghana, Togo et Bénin via deux applications mobiles Flutter (Client et Livreur) et un backend Node.js. Différenciation : enchères inversées (les livreurs proposent leur prix), paiement séquestre mobile money, commission dégressive qui récompense l'activité, conformité locale (PCSRC Ghana, carte pro Togo, permis livreur Bénin).

## V1 scope

Actions cœur (le script de démo) :

1. **Client** crée une commande (adresses via autocomplete, description colis, photo, planification optionnelle) → publication aux livreurs dans un rayon de 5 km.
2. **Livreur** en ligne reçoit la demande (push), propose un prix ≥ minimum suggéré (`distance_km × price_per_km + base_pickup_fee`).
3. **Client** compare les offres en temps réel, en accepte une, paie via lien séquestre (MoMo/carte — Paystack Ghana, Kkiapay Togo/Bénin, adaptateurs placeholder).
4. **Livreur** exécute le cycle : en route → récupéré (photo optionnelle, caméra temps réel) → en transit → livré ; le client suit sur carte (position 5 s) + chat intégré.
5. **Règlement** : libération du séquestre, commission dégressive (≤6 : 20 %, ≥7 : 15 %, ≥11 : 12 %, ≥15 : 9 %, reset minuit locale), frais litige (1 GHS / 100 XOF) vers fonds dédié, solde livreur, retrait MoMo/banque (1/jour).
6. **Double notation** client ↔ livreur + moyennes sur profils.
7. **Multi-pays actif v1** : Ghana (GHS), Togo (XOF), Bénin (XOF) — config par pays en DB (`country_configs`), onboarding livreur adapté par pays.
8. **Admin minimal** (API + interface web simple) : vérification livreurs, suspension, litiges, fonds de litige, traitement retraits, config tarifs, stats.

## Out of scope (v2 parking lot)

- Nigeria (NGN) — présent dans les maquettes, hors doc archi ; schéma prêt (ajout d'une ligne `country_configs`).
- Intégration réelle iCOLMS-GH (vérification PCSRC automatique) — v1 : vérification manuelle admin.
- Passerelles paiement en production (v1 : adaptateurs avec mode sandbox/mock, interface stable).
- Scan antivirus des uploads, traduction EN exhaustive du contenu, thème sombre.
- Apps web client/livreur, back-office riche (v1 : admin API + pages simples).
- Cash à la livraison, pourboires, courses multi-colis, programmes de fidélité.

## Stack & architecture

| Choix | Raison |
|---|---|
| Backend **NestJS 10 + TypeScript** | Modulaire, DI, guards/pipes natifs — décision utilisateur (greenfield, squelette Kimi = référence seulement) |
| **PostgreSQL 16 + PostGIS** (Prisma) | Transactions financières + requêtes géo (livreurs à proximité) |
| **Redis 7** | Positions GPS chaudes, sessions socket, rate limiting, files |
| **Socket.io** (gateway NestJS + adapter Redis) | Chat + suivi temps réel < 500 ms |
| **JWT RS256** access 15 min / refresh 7 j | Standard, révocable via Redis |
| **FCM** (Android + iOS via APNs) | Push fiable arrière-plan |
| Google Maps (Geocoding, Distance Matrix, Directions) + **fallback haversine** en dev | Coût maîtrisé, dev sans clé |
| Stockage photos : **S3-compatible** (MinIO en dev, R2/S3 en prod) | Compression côté client avant upload |
| Mobile : **2 apps Flutter 3.22+** (`apps/client`, `apps/driver`) + package partagé **`packages/kaya_core`** (modèles, API client, socket, thème, i18n FR/EN) | Mono-rôle comme les prototypes ; zéro duplication du design system |
| État Flutter : **Riverpod** | Testable, moderne, adapté aux 2 apps |
| Design system : **« Accra Minimalist Delivery »** (README prototypes §3) | Primaire `#1466FF`, succès `#12A150`, alerte `#E5484D`, ambre `#F5A623`, encre `#0B1220`, fond `#F4F6F9`, Inter 400–800, rayons 14–28 px, cibles ≥ 44 px |
| Docker Compose (api + postgres/postgis + redis + minio) | Dev reproductible ; prod ultérieure |
| Swagger/OpenAPI, Jest + Supertest, GitHub Actions | Doc + tests + CI |

Monorepo `D:\prototype\kaya` :

```
kaya/
├── BLUEPRINT.md
├── backend/            # NestJS + Prisma
├── apps/
│   ├── client/         # Flutter app Client
│   └── driver/         # Flutter app Livreur
├── packages/
│   └── kaya_core/      # Package Flutter partagé
├── admin/              # Back-office web minimal (plus tard, M5)
├── docs/               # ADR, API, guides
└── docker-compose.yml
```

## Data model

Entités (schéma détaillé : `docs/Architecture_Livraison_MultiPays.md` §2, repris de D:\prototype) :

- `users` (rôles client/livreur/both, champs livreur : licence par pays, QR, véhicule, position, `daily_deliveries`, `balance`, `fcm_token`)
- `orders` (statuts : draft → published → offers_received → accepted → driver_en_route → picked_up → in_transit → delivered / cancelled / disputed ; `scheduled_time`, `min_price_suggested`, `distance_km`)
- `offers` (UNIQUE(order_id, livreur_id), prix ≥ min, expiration)
- `deliveries` (photos pickup/livraison, horodatages, `commission_rate/amount`, `litigation_fee`, `net_earnings`, statuts paiement escrow)
- `ratings` (UNIQUE(delivery_id, from_user_id), 1–5 + commentaire)
- `messages` (scopé delivery, texte + image, read receipts)
- `transactions` (ledger : payment_in, escrow_release, commission, litigation_fee, driver_payout, withdrawal, refund, adjustment)
- `withdrawals` (momo/bank, JSONB account_details, 1/jour, frais ~1 % livreur)
- `country_configs` (devise, prix/km, frais, paliers commission, rayon, buffers planification, providers MoMo)
- `litigation_fund` (journal avec `balance_after`)
- `otp_codes`, `refresh_tokens`, `notifications` (ajouts nécessaires non listés dans le doc)

## Milestones

Chaque jalon est démontrable indépendamment. Route skills entre parenthèses.

- **M1 — Fondations backend** : monorepo, docker-compose (postgis/redis/minio), NestJS scaffold, schéma Prisma complet + migrations + seed `country_configs` (GHA/TGO/BEN), auth (register par pays, login, OTP mock SMS en dev, JWT refresh, uploads), Swagger. Démo : inscription livreur ghanéen + togolais via Swagger, OTP, /auth/me. *(backend-api-architect, qa-testing-strategy)*
- **M2 — Commandes, enchères, temps réel** : orders CRUD + pricing (Distance Matrix/fallback), publication immédiate + cron planifiées (30 min avant, rappel 1 h), recherche livreurs proximité (PostGIS), offres + acceptation + verrouillage, gateway Socket.io (rooms delivery, `location:update` 5 s, `chat:*`, `delivery:status`), FCM service. Démo : flux complet commande → offre → acceptation en API + événements socket. *(backend-api-architect)*
- **M3 — Argent** : adaptateurs paiement (interface unique, Paystack/Kkiapay sandbox/mock), webhooks, séquestre + ledger `transactions`, cycle livraison 5 étapes, commission dégressive + reset minuit par timezone pays, fonds litige, notations, gains + retraits (1/jour). Démo : course payée de bout en bout, ledger cohérent, solde livreur exact. **Jalon le plus risqué → spike adaptateur paiement dès le début de M3.** *(payments-emerging-markets, qa-testing-strategy — money paths testés ici)*
- **M4 — Apps Flutter** : `kaya_core` (thème Accra Minimalist, modèles, Dio API client, socket, FCM, i18n FR/EN), app **Client** (onboarding/OTP, home carte, création commande, planification, offres, paiement webview, suivi timeline 4 étapes, chat, notation, historique, notifications, profil multi-pays), app **Livreur** (onboarding + vérif documents par pays, home statut/gains, pop-up demande + compte à rebours, proposer prix avec aperçu net, course active + actions + photo caméra, chat, gains/commission, retrait, stats, profil). Fidélité 1:1 aux prototypes `Kaya Client.dc.html` / `Kaya Livreur.dc.html`. *(ux-psychology-design + design system des prototypes)*
- **M5 — Admin + tests** : endpoints admin (vérif/suspension, litiges, fonds, retraits, config pays, stats) + pages web simples ; tests Jest/Supertest e2e sur chemins critiques (auth, enchères, escrow, commission, retraits). *(qa-testing-strategy)*
- **M6 — Sécurité + ship** : audit sécurité (OWASP, secrets, uploads, rate limiting), Dockerfiles prod, CI GitHub Actions, README déploiement + .env.example, doc API finale. *(security-hardening-audit, devops-delivery)*

## Risks & spikes

1. **Paiement mobile money (séquestre)** — risque n°1. Mitigation : interface `PaymentGateway` unique + implémentations Paystack/Kkiapay derrière feature flag, mode mock complet pour dev/démo, UX du « pending » (webhooks lents) prévue dès M3. Spike en tête de M3.
2. **Temps réel à l'échelle + fiabilité positions** — Socket.io multi-instances. Mitigation : adapter Redis dès M2, positions écrites dans Redis (pas Postgres à chaque tick), fallback REST polling côté apps.
3. **Deux apps Flutter sans divergence** — Mitigation : `kaya_core` obligatoire (thème/API/socket), revue croisée des écrans contre les PNG `ref/`, aucune duplication de widget de base.
4. (mineur) **Coût/clés Google Maps** — fallback haversine + cache geocoding Redis ; clé requise seulement en staging/prod.

## Decisions log

- 2026-07-10 — Backend greenfield **NestJS** (squelette Kimi Express = référence métier seulement). Décision utilisateur.
- 2026-07-10 — **Multi-pays complet v1** : GHA/TGO/BEN actifs. Décision utilisateur. NGN/Nigeria → parking lot (maquettes le montrent, doc archi non).
- 2026-07-10 — Monorepo **D:\prototype\kaya**. Décision utilisateur.
- 2026-07-10 — Nom de travail « Kaya » (prototypes) ; nom final non choisi — aucun branding en dur, constante `APP_NAME` centralisée.
- 2026-07-10 — Flutter + Riverpod (le doc archi montrait Provider ; Riverpod retenu pour testabilité — override consigné).
- 2026-07-10 — Ambiguïté formule commission (doc : paliers sur `dailyDeliveries`) tranchée ainsi : le palier est déterminé par le **numéro de la livraison en cours dans la journée** (la 7e livraison du jour est commissionnée à 15 %). Reset à minuit, timezone du pays (`Africa/Accra`, `Africa/Lome`, `Africa/Porto-Novo`).
- 2026-07-10 — Frais de litige : 1 GHS (Ghana) / 100 XOF (Togo/Bénin) — valeur `litigation_fee` de `country_configs`, pas une constante.

- 2026-07-11 — Dossiers plateformes générés (`flutter create .`) avec ids provisoires `com.kaya.kaya_client` / `com.kaya.kaya_driver` — à renommer quand le nom final sera choisi (changement d'applicationId Android + bundle id iOS avant première publication).
- 2026-07-11 — Popup nouvelle demande livreur déclenchée par polling nearby + FCM (pas d'événement socket driver-facing en v1) — décision m4-flutter validée.
- 2026-07-12 — **OTP délivré par Firebase Phone Auth**, plus de code maison (`otp_codes` supprimée). Décision utilisateur, suite à un bug du prefill dev (code factice `123456` vs code réel généré côté backend). Couvre les 4 `OtpPurpose` : `registration`/`phone_verification` (migration du flux existant) et `login`/`password_reset` (features neuves, absentes avant ce jour). Projet Firebase `kaya-a24e7` (Spark/free), test number `+233201234567` → `123456` pour dev. Détails : `docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md`.

## Acceptance

« Les deux applications Flutter (Client et Livreur) reproduisent fidèlement les prototypes Kaya, et une course complète — création, enchère, paiement séquestre sandbox, suivi temps réel, chat, livraison, commission dégressive, notation, retrait — fonctionne de bout en bout sur Android et iOS contre le backend NestJS dockerisé, pour un utilisateur ghanéen (GHS) et un utilisateur togolais (XOF). »
