# Migration Kaya : Flutter → React Native (Expo)

Date : 2026-08-02
Statut : design validé, prêt pour plan d'implémentation

## 1. Objectif

Remplacer les deux applications Flutter (`apps/client`, `apps/driver`) et leur package partagé
`packages/kaya_core` par deux applications React Native (Expo), en conservant :

- le **split mono-rôle** Client / Livreur (deux apps distinctes, comme aujourd'hui) ;
- la **parité fonctionnelle 1:1** avec les écrans Flutter actuels (~40 routes cumulées) ;
- le **design system « Accra Minimalist Delivery »** à l'identique ;
- le **backend NestJS inchangé** — aucune modification serveur, schéma Prisma, ou admin.

La stack technique React est reprise du prototype Expo **KoraGo**
(`D:\prototype\ghana-delivery-app-rork\expo`). Son code métier et sa direction visuelle ne sont
pas repris (justification § 8).

## 2. Décisions

| # | Décision | Raison |
|---|---|---|
| D1 | Cible = **React Native + Expo**, pas React web | Parité avec Flutter : caméra temps réel, GPS arrière-plan, FCM, publication stores. Les apps web restent en parking lot v2 (BLUEPRINT). |
| D2 | Socle partagé scindé en **`@kaya/core` (TS pur)** + **`@kaya/ui` (RN)** | `@kaya/core` n'importe jamais `react-native` → tests des chemins argent en jest node, sans toolchain mobile, exigence ASSISTANT.md « tests obligatoires sur les chemins d'argent ». |
| D3 | Flutter déplacé en `legacy/flutter/` (`git mv`), supprimé en fin de phase 3 | Référence de comportement vivante pendant la migration ; rien d'irréversible avant validation utilisateur ; historique git préservé. |
| D4 | **npm workspaces** | Metro résout par remontée de `node_modules` ; npm hoiste par défaut. pnpm exigerait `node-linker=hoisted`. |
| D5 | Design system inchangé : primaire `#1466FF` | Prototypes `.dc.html` = référence visuelle verrouillée (ASSISTANT.md). La palette verte `#2D8065` de KoraGo est écartée. |
| D6 | État serveur = **TanStack Query**, état client = **Zustand** | Remplace Riverpod en séparant les deux natures d'état. Stack KoraGo. |
| D7 | Montants en `number` + helper `roundMoney` unique | Le Dart utilise `double` + `toStringAsFixed(2)` ; on reproduit la stratégie d'arrondi à l'identique plutôt que d'introduire `decimal.js`. La règle `Decimal` du ASSISTANT.md porte sur le backend/DB. |
| D8 | Un seul mécanisme de style : `StyleSheet.create` alimenté par les tokens `@kaya/ui` | Empêche mécaniquement la divergence visuelle entre les deux apps (risque n°3 BLUEPRINT). Lint interdisant les littéraux couleur hors du package. |

## 3. Structure cible

```
kaya/
├── backend/                  # NestJS — inchangé
├── admin/                    # inchangé
├── legacy/flutter/           # git mv depuis apps/ et packages/ ; supprimé en fin de phase 3
│   ├── client/  driver/  kaya_core/
├── packages/
│   ├── kaya-core/            # @kaya/core — TS pur, 0 import react-native
│   └── kaya-ui/              # @kaya/ui   — composants React Native
├── apps/
│   ├── client/               # Expo — app Client
│   └── driver/               # Expo — app Livreur
├── package.json              # npm workspaces
└── tsconfig.base.json
```

Configuration runtime par app : `app.config.ts` + `expo-constants`, mêmes clés que l'`ApiConfig`
actuel — `API_BASE_URL`, `MAPS_API_KEY`, `SKIP_AUTH`, `OTP_DISABLED`.

## 4. `@kaya/core` — logique, sans React Native

| Module | Contenu | Source Flutter |
|---|---|---|
| `models/` | 14 entités en **schémas Zod**, types via `z.infer` | `src/models/*.dart` (les helpers `json_utils` disparaissent) |
| `money/` | `CountryCode` (GHA/TGO/BEN), `Currency` (XOF 0 décimale, GHS/NGN 2), `formatMoney`, `commissionRateForDeliveryNumber`, `CommissionPreview`, `roundMoney` | `src/constants.dart` |
| `api/` | Client HTTP, ~40 endpoints, intercepteur auth | `src/api/kaya_api.dart`, `auth_interceptor.dart`, `api_config.dart` |
| `errors/` | `ApiFailure` + `FailureKind` (network, timeout, unauthorized, forbidden, notFound, conflict, validation, server, cancelled, unknown) + erreurs de champ class-validator | `src/api/api_failure.dart` |
| `realtime/` | socket.io-client, événements typés Zod | `src/realtime/*.dart` |
| `storage/` | Interface `TokenStore` sur `expo-secure-store` | `src/services/secure_token_storage.dart` |
| `i18n/` | 155 clés FR/EN via `i18next` + `react-i18next` ; les `.arb` restent la source formelle, convertis une fois en JSON | `lib/l10n/app_{fr,en}.arb` |

**Comportement critique à porter tel quel — intercepteur auth.** Sur 401 : refresh JWT, rejeu de la
requête **une seule fois** (`retried`), en-tête `Authorization` sauf `skipAuth`. Les refresh
concurrents sont **coalescés en un seul appel** (`_inFlightRefresh` en Dart → promesse partagée en
variable de module). Sans cette coalescence, deux 401 simultanés font tourner le refresh token deux
fois et le révoquent → déconnexions aléatoires. Échec du refresh → purge du store + `onSessionExpired`.

**Contrat socket (figé, backend inchangé), payloads snake_case :**
`offer:new` · `offer:accepted` · `location:driver` · `delivery:status` · `chat:*`.

## 5. `@kaya/ui` — design system

Tokens exacts : primaire `#1466FF`, succès `#12A150`, danger `#E5484D`, ambre `#F5A623`,
encre `#0B1220` / `#5B6472` / `#8A94A6`, surface `#FFFFFF`, fond `#F4F6F9`, bordures `#E7EAF0` /
`#EBEEF3`, teintes douces (`primaryTint` `#EAF1FF`, `successTint` `#E6F5EC`, `dangerTint` `#FCEBEC`,
`amberTint` `#FEF3E0`), marqueurs carte (retrait = succès, livraison = primaire).
Rayons 14–28 px, cibles tactiles ≥ 44 px, Inter 400–800.

Composants : `KayaButton`, `KayaCard`, `KayaTextField`, `KayaAvatar`, `StatusPill`, `RatingStars`,
`KayaSkeleton`, `EmptyState`, `BottomSheetShell`, `MapView`.

Icônes : `lucide-react-native`. Animations / shimmer : `react-native-reanimated`.
Thème sombre : hors périmètre (idem BLUEPRINT).

## 6. Applications

### Routing — expo-router (arborescence de fichiers)

Client :

```
app/
├── _layout.tsx              providers + garde d'authentification
├── index.tsx                ex-/splash
├── (auth)/                  welcome · login · login-verify · register · password-reset
├── (tabs)/_layout.tsx       barre 4 onglets
│   └── home · history · inbox · profile
├── create-order · address-search · notifications
├── offers/[orderId]
├── payment/index · payment/webview · payment/receipt
├── tracking/[deliveryId] · chat/[deliveryId] · rating/[deliveryId]
```

Driver : même squelette ; `(tabs)` = home · earnings · inbox · profile ; plus `verify-documents`,
`propose/[orderId]`, `delivery/[deliveryId]`, `delivery-detail/[deliveryId]`, `stats`, `history`,
`withdraw`, `chat/[deliveryId]`, `rating/[deliveryId]`, `notifications`.

**Garde d'authentification** dans `app/_layout.tsx`, portage du `redirect` go_router :
statut `unknown` → reste sur le splash ; non authentifié → `/welcome` ; authentifié sur un écran
d'auth → `/home`.

### État

- **Serveur** (commandes, offres, livraisons, messages, gains, notifications) → TanStack Query.
  Remplace les providers Riverpod `offers`, `tracking`, `chat`, `nearby`.
- **Client** (session, langue, pays, statut en ligne livreur, brouillon de commande, brouillon
  d'inscription) → Zustand ; persistance AsyncStorage pour les brouillons, SecureStore pour les jetons.

### Pont temps réel

Hook unique monté dans le layout racine. Règle de câblage :

- **`setQueryData`** pour les événements portant leur donnée complète : `location:driver`
  (5 s, zéro requête réseau), `delivery:status`, `chat:*`, `offer:new`.
- **`invalidateQueries`** pour les événements signalant un changement partiel : `offer:accepted`
  (touche commande + livraison + solde).

Repli prévu au risque n°2 du BLUEPRINT : `refetchInterval` conditionné à l'état de la connexion
socket (polling REST quand le socket est down).

### Erreurs

Handler global sur le `QueryCache`, traduisant `ApiFailure` :
`unauthorized` après échec du refresh → purge de session, la garde renvoie sur `/welcome` ;
`network` / `timeout` → bandeau hors-ligne réutilisable + retry exponentiel ;
`validation` → erreurs de champ remontées au formulaire.

**Les mutations des chemins argent (paiement, retrait) ne sont jamais rejouées automatiquement** —
un retry silencieux crée un doublon de transaction.

## 7. Intégrations natives

Toutes derrière une interface avec implémentation de repli utilisable sans clé (règle ASSISTANT.md).

| Domaine | Implémentation | Repli sans clé |
|---|---|---|
| Cartes | `@maplibre/maplibre-react-native` (OSM, défaut) ; `react-native-maps` si `MAPS_API_KEY` | Fallback stylisé, comme le `StylizedMapFallback` actuel. `@kaya/ui` exporte l'interface, l'app enregistre l'implémentation — schéma du `MapView` Dart conservé. |
| Auth | `@react-native-firebase/auth` (Phone Auth + social) | Drapeaux `SKIP_AUTH` et OTP désactivé conservés à l'identique |
| Push | `@react-native-firebase/messaging` | Popup nouvelle demande livreur = polling nearby + FCM (pas d'événement socket driver-facing en v1, cf. journal de décisions 2026-07-11) |
| Photos | `expo-image-picker` + `expo-image-manipulator` (compression avant upload) | — |
| Paiement | `react-native-webview`, même interception d'URL de retour | Adaptateurs Paystack/Kkiapay côté backend, inchangés |

**Contrainte build :** `@react-native-firebase/*` est incompatible avec Expo Go. Un **dev build**
est requis (`expo prebuild` + EAS ou build local) dès la phase 1.

**Sécurité :** `SKIP_AUTH` est strictement réservé au développement. Le build de production doit
échouer si le drapeau est actif — vérification explicite à câbler dans la configuration EAS.

## 8. Ce qui est repris de KoraGo, et ce qui ne l'est pas

**Repris — la stack uniquement :** Expo 54, expo-router, TanStack Query, Zustand, AsyncStorage,
`lucide-react-native`, `expo-image`, `expo-haptics`, `expo-blur`, `expo-linear-gradient`,
`expo-location`, `expo-image-picker`.

**Écarté — tout le reste, délibérément :**

- `domain/korago.ts` code en dur `basePickupFee` et `pricePerKm`, alors que Kaya lit ces valeurs
  dans `country_configs` par pays (GHS/XOF).
- Ses paliers de commission sont indexés sur les livraisons **déjà faites** ; le journal de décisions
  du 2026-07-10 a tranché que le palier dépend du **numéro de la livraison en cours** (la 7e
  livraison du jour est commissionnée à 15 %). Reprendre son calcul décalerait toutes les
  commissions d'un rang.
- Palette verte `#2D8065`, en contradiction avec le design system verrouillé.
- État mock, sans backend, sans i18n, mono-devise, mono-pays.

## 9. Tests

1. **`@kaya/core`, jest node pur — bloquant au merge.** Paliers de commission par numéro de
   livraison, arrondis, formatage GHS/XOF, parsing Zod des payloads REST et socket, et coalescence
   du refresh JWT (deux 401 simultanés → un seul appel `/auth/refresh`).
2. **`@kaya/ui` et écrans, React Native Testing Library.** Inclut les équivalents des tests d'état
   de chargement existants côté Flutter.
3. **Parcours démo bout en bout, Maestro,** contre le backend dockerisé.

## 10. Phasage

| Phase | Contenu | Critère de démo |
|---|---|---|
| 1 | `git mv` du Flutter vers `legacy/`, npm workspaces, `@kaya/core` + `@kaya/ui` complets, deux coquilles Expo (dev build) | Les deux apps démarrent, se connectent au backend, `/auth/me` répond, design system visible sur un écran vitrine |
| 2 | App Client complète (~20 routes) | Création de commande, comparaison des offres, paiement sandbox, suivi carte, chat, notation |
| 3 | App Livreur complète (~20 routes), puis suppression de `legacy/` | Course complète des deux côtés, commission dégressive exacte, retrait |

## 11. Hors périmètre

Backend NestJS, schéma Prisma, admin web, thème sombre, apps web, renommage des identifiants
applicatifs (`com.kaya.kaya_client` / `com.kaya.kaya_driver` restent provisoires jusqu'au choix du
nom final).

## 12. Critère d'acceptation

Les deux applications React Native reproduisent les écrans Flutter à l'identique, et une course
complète — création, enchère, paiement séquestre sandbox, suivi temps réel, chat, livraison,
commission dégressive, notation, retrait — fonctionne de bout en bout sur Android et iOS contre le
backend NestJS dockerisé inchangé, pour un utilisateur ghanéen (GHS) et un utilisateur togolais (XOF).
