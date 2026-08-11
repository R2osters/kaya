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
- **M4 — Apps mobiles (React Native/Expo)** : `@kaya/core` (modèles, client API axios, socket, money, i18n FR/EN) + `@kaya/ui` (thème Accra Minimalist, composants, carte, adaptateurs plateforme), app **Client** (onboarding/OTP, home carte, création commande, planification, offres, paiement webview, suivi timeline 4 étapes, chat, notation, historique, notifications, profil multi-pays), app **Livreur** (onboarding + vérif documents par pays, home statut/gains, pop-up demande + compte à rebours, proposer prix avec aperçu net, course active + actions + photo caméra, chat, gains/commission, retrait, stats, profil). Fidélité 1:1 aux prototypes `Kaya Client.dc.html` / `Kaya Livreur.dc.html`. Le portage Flutter → React Native est découpé en phases 1A (`@kaya/core`), 1B (`@kaya/ui`), 1C (les deux coques Expo, terminée le 2026-08-09) puis 2 et 3 (les écrans réels). L'arbre Flutter reste sous `legacy/flutter/` comme référence de portage. *(ux-psychology-design + design system des prototypes)*
- **M5 — Admin + tests** : endpoints admin (vérif/suspension, litiges, fonds, retraits, config pays, stats) + pages web simples ; tests Jest/Supertest e2e sur chemins critiques (auth, enchères, escrow, commission, retraits). *(qa-testing-strategy)*
- **M6 — Sécurité + ship** : audit sécurité (OWASP, secrets, uploads, rate limiting), Dockerfiles prod, CI GitHub Actions, README déploiement + .env.example, doc API finale. *(security-hardening-audit, devops-delivery)*

## Risks & spikes

1. **Paiement mobile money (séquestre)** — risque n°1. Mitigation : interface `PaymentGateway` unique + implémentations Paystack/Kkiapay derrière feature flag, mode mock complet pour dev/démo, UX du « pending » (webhooks lents) prévue dès M3. Spike en tête de M3.
2. **Temps réel à l'échelle + fiabilité positions** — Socket.io multi-instances. Mitigation : adapter Redis dès M2, positions écrites dans Redis (pas Postgres à chaque tick), fallback REST polling côté apps.
3. **Deux apps mobiles sans divergence** — Mitigation : `@kaya/core` et `@kaya/ui` obligatoires (thème/API/socket/composants), règle de lint interdisant les imports profonds et les littéraux de couleur dans les apps, revue croisée des écrans contre les PNG `ref/`, aucune duplication de composant de base.
4. **Sources externes de cartographie** — trois besoins distincts, trois décisions (2026-08-09) : les **tuiles** (MapLibre, style OSM sans clé en dev, MapTiler ou un extrait Protomaps auto-hébergé en prod), la **distance routière** (`MAPS_PROVIDER` : haversine par défaut, `osrm` pour du vrai routage, `google` en dernier recours) et le **géocodage** (`GEOCODING_PROVIDER` : Photon par défaut, liste statique hors-ligne en repli). Aucun de ces trois ne demande de clé pour faire tourner le projet ; chacun se remplace derrière son interface. La couverture d'adresses réelle au Ghana (GhanaPostGPS, OSM péri-urbain mince) reste un problème ouvert pour la phase 2.

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

- 2026-08-05 — Phase 1C task 5 (Expo route tree): the brief listed the client/driver's first route as `index` (splash), but Expo Router always resolves a fresh launch to `/`, while the auth guard (ported from go_router, task 1C-3) checks the literal path `/splash` — go_router's `initialLocation` had no `/` equivalent to reuse. Resolved by giving each app both files: `app/index.tsx` is a bare `<Redirect href="/splash" />`, and `app/splash.tsx` is the real splash placeholder. Without the second file, the guard's own redirect target would not exist.

- 2026-08-09 — **Phase 1C terminée (7/7)** et fusionnée : les deux coques Expo, le garde d'authentification, la pile de providers, l'arbre de routes complet, le pont temps réel, l'enregistrement de la carte et du push, plus un flux Maestro. La branche portait les tâches 1 à 5 sans être fusionnée ; `main` ne connaissait que le plan.

- 2026-08-09 — **Carte : `MAPS_API_KEY` choisit une source de tuiles, pas un SDK.** Le plan 1C prévoyait MapLibre sans clé et `react-native-maps` avec. Ce qu'une clé achète, ce sont des tuiles, et MapLibre affiche n'importe quelle URL de style : un second SDK natif (plus la facturation Google Maps, plus une seconde série de problèmes de build natif) n'apporterait rien de plus. Sans clé, le style OSM sans clé s'applique — utilisable en dev et en démo sans compte nulle part, mais explicitement pas en production (la politique d'usage d'openstreetmap.org ne couvre pas le trafic d'une app commerciale). En production : une clé MapTiler, ou un extrait Protomaps auto-hébergé Ghana/Togo/Bénin — un seul fichier, aucun coût par requête, ce qui est l'option la moins chère au volume visé.

- 2026-08-09 — **Distance routière : provider `osrm` ajouté (`MAPS_PROVIDER`).** Le prix d'une livraison est `distance_km × price_per_km + base_pickup_fee`, et `distance_km` venait d'une ligne droite multipliée par 1,3. Mesuré sur de vrais trajets : Accra→Tema +14,7 %, Osu→Accra Mall −4,7 %, Lomé→Baguida +0,4 %. L'erreur change de signe, donc aucune meilleure constante ne la corrige — celui qui est du mauvais côté perd de l'argent à chaque course sans pouvoir le voir. Le défaut reste haversine (aucune dépendance externe pour un simple `git clone`) ; `OSRM_BASE_URL` vise le serveur de démo public en dev et un conteneur OSRM auto-hébergé en production. Repli haversine en cas d'échec : un serveur de routage indisponible doit dégrader la *précision* d'un devis, jamais empêcher de créer une commande.

- 2026-08-09 — **Géocodage : Photon par défaut, liste statique en repli (`GEOCODING_PROVIDER`).** Il n'existait aucun géocodage dans le projet — ni endpoint, ni provider — alors que `create-order` et `address-search` en dépendent (l'utilisateur tape une adresse, le prix a besoin de deux `GeoPoint`). Nominatim est écarté pour une raison qui tranche : sa politique d'usage **interdit l'auto-complétion**, qui est la seule chose que fait cet endpoint. `GET /geocoding/search` est authentifié — un proxy de géocodage ouvert est un relais ouvert vers le fournisseur configuré, facturé sur le compte de la plateforme — et filtre par pays du demandeur par défaut. Limite connue non résolue : au Ghana le système d'adressage réellement utilisé est GhanaPostGPS, et la couverture OSM du péri-urbain d'Accra est mince ; l'écran de phase 2 aura besoin d'un second champ et d'un placement de repère manuel.

- 2026-08-09 — **Arrondi monétaire par devise, côté backend.** Le backend arrondissait tout à 2 décimales, y compris le XOF qui n'a pas de sous-unité, alors que `@kaya/core` arrondissait déjà le XOF à 0 côté client. Au-delà du stockage d'une précision inexistante, cela cassait l'invariant « la décomposition somme au total » : commission, frais de litige et net arrondis séparément à 2 décimales puis affichés à 0, deux moitiés peuvent monter ensemble et l'écran gains du livreur affiche trois nombres qui ne s'additionnent pas — l'écart (~0,5 F par course) s'accumulant dans un ledger append-only. `backend/src/common/money.ts` porte la règle, alignée sur celle de `@kaya/core`.

- 2026-08-09 — **CI : le job Flutter ne garde plus rien.** Il installait une toolchain et lançait trois suites sous `legacy/flutter/` à chaque PR, y compris pour des PR ne touchant que `backend/`. Le coût n'était pas le vrai problème : un check « flutter » au vert se lit comme « les apps mobiles sont couvertes » et signifiait l'inverse depuis la migration. L'arbre Flutter reste sous `legacy/` comme référence de portage et reste lançable à la main. `tools/` gagne en échange le job qu'il n'avait pas — c'est là que vit `devFlagGuard`, la seule chose qui empêche `SKIP_AUTH` d'atteindre un vrai compte utilisateur.

- 2026-08-09 — **Le showcase du design system est une vraie route (`/showcase`).** Il s'appelait `_showcase.tsx` pour rester hors de l'arbre de routes, mais l'explorateur de routes listait `/_showcase` : expo-router ne route pas un fichier préfixé d'un underscore, donc le seul écran que la phase existe pour montrer à un humain était injoignable — et rien n'échouait, un tap sur une route inexistante ne faisant rien du tout. Un test vérifie désormais que chaque lien de l'explorateur atteint une route déclarée.

- 2026-08-11 — **La course complète a tourné de bout en bout sur l'émulateur**, contre le vrai backend : inscription/connexion → création de commande (géocodage + devis réels) → publication → enchère du livreur simulé (`backend/scripts/simulate-driver.ts`) → offre affichée en direct → acceptation → **paiement séquestre** → course (départ/pickup/transit/livré) → suivi « Livré » 4/4 → notation 5★ enregistrée. Règlement vérifié au pesewa : 33,66 GHS, commission 6,73 (20 %), frais de litige 1,00, net 25,93 ; escrow `released`, payout `processed`. Maestro 2.8.0 installé, `smoke-order.yaml` 27 étapes vertes.

- 2026-08-11 — **Le mock de paiement sert une vraie page de checkout** (`GET /payments/mock/checkout/:reference`, 404 en production). L'ancienne URL `https://mock-pay.local/...` était verte en tests unitaires et une page blanche au premier téléphone qui l'a ouverte — la règle « mock utilisable sans clé » exige une page qui existe. Trois découvertes en la faisant marcher sur appareil : (1) l'URL doit être bâtie sur le header Host de la requête (localhost vu de l'émulateur = l'émulateur) ; (2) le CSP global de helmet (`script-src 'self'`) tuait silencieusement le script inline — CSP par route ; (3) la redirection de retour est une *navigation* pour expo-router, pas seulement un signal — d'où la route `payment/return` qui vérifie la référence reçue (le mock ajoute `?reference=` au callback, comme Paystack). `verify` du mock lit désormais le ledger au lieu de répondre `success` inconditionnellement — un paiement explicitement échoué ne peut plus être basculé en `escrow_held` par le verify qui suit.

- 2026-08-11 — **`POST /driver/status` existe parce que rien ne mettait `is_online`** : sur une base fraîche, aucun livreur ne pouvait enchérir (OffersService refuse hors-ligne) et aucun endpoint ne posait le flag. Découvert par le script simulate-driver, pas par les tests.

- 2026-08-11 — **Phase 3 : l'app livreur.** Douze écrans réels remplacent les placeholders de la phase 1C. La boucle d'abord (accueil avec bascule en ligne + position publiée + demandes à proximité ; enchère avec net-après-commission en direct ; course start → pickup → transit → livré), puis l'argent (gains, retrait, stats) et la périphérie. Deux ports qui **corrigent** l'original Dart au lieu de le copier : le retrait envoie `account_name`/`account_number` (l'original envoyait `{'account': …}`, refusé par le backend à chaque fois) et l'écran documents montre les deux documents réellement stockés au lieu de quatre tuiles dont deux ne stockaient rien tout en s'affichant « envoyé ».

- 2026-08-11 — **La position du livreur est publiée tant qu'il est en ligne, pas seulement pendant une course.** La recherche de courses proches a besoin d'un point avant qu'aucune livraison n'existe, et un livreur qui disparaît de la carte dès qu'il termine est un livreur que la répartition ne voit plus. Le flux s'arrête au passage hors ligne — une souscription qui fuit garde le GPS et la radio actifs toute la journée, sur un réseau où la data est comptée.

- 2026-08-11 — **Trois trous du backend comblés parce que l'app livreur est tombée dessus** : `GET /country-configs(/:code)` (la grille tarifaire était modifiable par un admin et lisible par personne — sans elle, l'aperçu de commission devrait coder en dur 20/15/12/9 %, ce que les règles du projet interdisent) ; `POST /uploads/:prefix` (`StorageService` existait depuis M1 sans rien pour l'exposer : la photo de prise en charge ne pouvait être envoyée que comme chemin `file://` local, stocké dans une colonne qui donne l'illusion que ça marche) ; et l'inclusion des **participants** sur `GET /deliveries` (les deux apps affichaient leur interlocuteur à `null` sur chaque ligne — la boîte de réception du client repliait sur une adresse là où va un nom, et le livreur n'avait personne à appeler).

- 2026-08-11 — **Un `Participant` n'est pas un `User`.** Le backend n'envoie que sept champs pour l'autre partie d'une livraison ; les parser avec `userSchema` réussissait et inventait un e-mail vide, un rôle par défaut et un solde à zéro. Un écran qui en affiche un affiche une invention, et rien n'échoue nulle part.

- 2026-08-11 — **Position des livreurs exposée au client sans identité.** `GET /drivers/nearby` renvoie des positions et rien d'autre : ni id, ni nom, ni véhicule. Un id transformerait un endpoint « y a-t-il quelqu'un autour » en outil de filature d'une personne nommée à travers la ville ; l'identité du livreur devient visible à un seul moment, quand il remporte la livraison. Les pins expirent aussi (10 min) : `is_online` est un drapeau qu'un livreur peut laisser levé en fermant l'app sur une batterie morte, et un pin immobile depuis trois heures fait paraître la ville plus active qu'elle ne l'est — le seul mensonge qu'une carte de marketplace ne doit pas dire.

- 2026-08-11 — **Cartes par pays.** `COUNTRY_MAP_DEFAULTS` (Accra / Lomé / Cotonou) remplace la coordonnée d'Accra codée en dur : un livreur à Lomé ouvrait sa carte sur une ville à 500 km et devait la faire glisser avant qu'elle ne dise quoi que ce soit. Les tuiles n'ont jamais été le problème — le style est mondial — c'était la caméra. Cotonou et non Porto-Novo : la capitale est Porto-Novo, les livraisons sont à Cotonou.

- 2026-08-11 — **Géocodage inverse** (`GET /geocoding/reverse`), pour « utiliser ma position ». Les deux providers conservent la coordonnée **demandée**, pas le centroïde du lieu trouvé : la course est tarifée et routée depuis où l'utilisateur se trouve, l'adresse n'en est qu'une étiquette. Le repli statique répond depuis le repère le plus proche et renvoie `null` au-delà de 25 km — une étiquette « Osu, Accra » pour quelqu'un à Kumasi est pire que pas d'étiquette : le livreur la lit, et elle est fausse.

- 2026-08-11 — **Les notifications sont écoutées, pas seulement enregistrées.** L'enregistrement FCM disait au backend où envoyer ; rien n'écoutait. Une notification reçue app ouverte ne faisait rien, et un tap ouvrait l'app sur l'écran laissé en plan — livrée puis jetée, soit l'équivalent de ne pas l'envoyer. Deux canaux, deux comportements : en premier plan on rafraîchit sans naviguer (arracher quelqu'un à un écran qu'il a choisi, parce qu'un message arrive, c'est perdre une adresse à moitié saisie) ; au tap on navigue, via une table de routes **par app** — un push `delivery` envoie le client vers une carte qu'il regarde et le livreur vers la course qu'il exécute.

## Acceptance

« Les deux applications mobiles (Client et Livreur, React Native/Expo) reproduisent fidèlement les prototypes Kaya, et une course complète — création, enchère, paiement séquestre sandbox, suivi temps réel, chat, livraison, commission dégressive, notation, retrait — fonctionne de bout en bout sur Android et iOS contre le backend NestJS dockerisé, pour un utilisateur ghanéen (GHS) et un utilisateur togolais (XOF). »
