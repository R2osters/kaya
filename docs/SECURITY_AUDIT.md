# Kaya — Audit de sécurité (M6)

Date : 2026-07-11 · Portée : backend NestJS, SPA admin, surface API des apps Flutter.
Statuts : ✅ corrigé · 🔧 à corriger (assigné) · 👤 action utilisateur.

## Synthèse

Aucune fuite de secrets dans le dépôt. Les deux failles High (CORS Socket.io ouvert,
chemin mock de paiement joignable en production) sont corrigées. Restent deux Medium
(URLs de stockage publiques pour des documents d'identité, absence de lockout de
connexion) assignées à l'agent backend, et les prérequis d'exploitation côté utilisateur.

## Constats

### High (corrigés)

1. ✅ **Socket.io CORS `origin: true`** — le gateway acceptait toute origine, cookies inclus.
   Corrigé : whitelist `CORS_ORIGINS` partagée avec le HTTP ; fallback permissif en dev
   uniquement (`src/realtime/events.gateway.ts`).
2. ✅ **Chemin de paiement mock joignable en production** —
   `POST /api/v1/payments/webhook` sans signature retombait sur le gateway mock, et
   `POST /api/v1/payments/mock/complete/:reference` était public : un attaquant pouvait
   marquer un séquestre comme payé sans payer. Corrigé : les deux rejettent quand
   `NODE_ENV=production` (`src/payments/payments.controller.ts`).

### Medium (🔧 assignés à l'agent backend)

3. 🔧 **Documents d'identité sur URL publique** — `StorageService.upload` renvoie
   `S3_PUBLIC_URL/key` : cartes d'identité, permis et QR PCSRC lisibles par quiconque a
   l'URL. Correctif attendu : URLs présignées GET à durée courte (bucket privé), champ DB
   = clé S3, résolution presignée à la lecture.
4. 🔧 **Pas de lockout de connexion** — seul le throttling IP global (100 req/min)
   protège `/auth/login` ; le brute-force lent distribué reste possible. Correctif
   attendu : compteur d'échecs par identité dans Redis + backoff exponentiel / verrou
   temporaire, et throttle OTP par IP en plus du throttle par identité existant.

### Low / notes

5. Requêtes géo `$queryRaw` : paramétrées via `Prisma.sql` tagged templates — OK.
6. JWT RS256 : clés obligatoires (zod `min(1)`), pas de valeur par défaut faible ;
   access 15 min, refresh 7 j avec rotation et révocation — OK.
7. `.env`, `keys/`, `*.pem` gitignorés et absents de l'index — OK.
8. Uploads : MIME image/* + 5 Mo max côté serveur (Multer) — OK. Scan antivirus = hors
   scope v1 (parking lot).
9. Ledger `transactions` append-only ; règlement et résolutions de litige idempotents,
   fonds de litige sérialisé (`balance_after`) — OK.
10. Logs : pas de mot de passe/OTP/token loggués constatés ; les codes OTP dev passent
    par le DevOtpProvider (console) — acceptable en dev, interdit en prod
    (`OTP_PROVIDER=dev` refusé si production ajouté au schéma ? 🔧 à vérifier par l'agent).

### Actions utilisateur (👤 avant toute mise en production)

- Générer des clés RS256 de production (pas celles du dossier `keys/` de dev) et les
  fournir via variables d'environnement / secret manager.
- Renseigner `CORS_ORIGINS` avec les domaines réels.
- Clés réelles Paystack/Kkiapay (+ secrets webhook), Google Maps, Firebase service
  account ; vérifier que le mock ne s'active plus (logs au démarrage).
- Bucket S3/R2 **privé** une fois le correctif presigné livré.
- TLS devant l'API (reverse proxy / Cloudflare) ; l'app ne termine pas le TLS elle-même.
