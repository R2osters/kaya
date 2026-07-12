# Kaya — Application de livraison à la demande (Afrique de l'Ouest)

Prototype interactif haute-fidélité de la plateforme de livraison peer-to-peer **Kaya**
(mise en relation clients ↔ livreurs indépendants), inspiré d'Uber, pensé pour le marché
ghanéen et extensible à l'Afrique de l'Ouest (Ghana, Togo, Bénin, Burkina Faso, Nigeria, Mali).

> *Kaya* signifie « la charge / les biens » — un clin d'œil à la culture logistique
> ghanéenne (les *kayayei*), un nom court et panafricain.

---

## 1. Contenu du projet

| Fichier | Rôle |
|---|---|
| **`Kaya Client.dc.html`** | Application **CLIENT** (expéditeur) — prototype cliquable complet |
| **`Kaya Livreur.dc.html`** | Application **LIVREUR** (driver) — prototype cliquable complet |
| `Kaya.dc.html` | Prototype d'origine combiné (2 rôles dans une app) — conservé comme référence |
| `support.js` | Runtime des Design Components (nécessaire à l'exécution) |
| `README.md` | Ce document |
| `ref/` | Captures d'écran de référence (non nécessaires à l'exécution) |

Chaque `.dc.html` est **autonome** : il s'ouvre directement dans un navigateur moderne
(Chrome, Safari, Edge). Aucune installation, aucun serveur. Garder `support.js` dans le
même dossier que les fichiers `.dc.html`.

**Deux applications distinctes, mono-rôle** — comme demandé, le prototype a été scindé :
plus de bascule Client↔Livreur, chaque app a son propre onboarding, sa navigation et
**son profil dédié**.

---

## 2. Comment naviguer

Chaque app démarre sur l'écran de bienvenue. Cliquer **« Se connecter »** puis
**« Vérifier »** (OTP pré-rempli) pour entrer.

- **Bilingue** : bouton **FR/EN** en haut de l'accueil et dans le profil (bascule le chrome
  de navigation, titres et CTA principaux).
- **Réglages (Tweaks)** exposés sur le composant : langue de départ, variante d'accueil,
  rôle de départ.
- Navigation par onglets en bas + boutons retour ; toutes les actions principales sont
  cliquables (formulaires, sélections, timeline de suivi, etc.).

---

## 3. Système de design (« Accra Minimalist Delivery »)

Minimalisme utilitaire, forte respiration, lisibilité plein soleil. Style hérité du design
system fourni, **modernisé** (rayons plus généreux, ombres douces, échelle typographique
retravaillée) tout en gardant l'esprit Uber.

**Couleurs**
- Primaire (bleu électrique) : `#1466FF` — actions, états actifs, itinéraires carte
- Succès (vert) : `#12A150` — confirmations, MoMo, « livré »
- Alerte (rouge) : `#E5484D` — annulations, litiges, badges de notification
- Ambre : `#F5A623` — étoiles / notes
- Encre / texte : `#0B1220` · secondaire `#5B6472` · tertiaire `#8A94A6`
- Surfaces : `#FFFFFF` · fond app `#F4F6F9` · bordures `#E7EAF0` / `#EBEEF3`

**Typographie** : Inter (400/500/600/700/800). Titres écran ~26–29px, prix en gras 18–22px,
overlines 12px en capitales espacées.

**Formes & profondeur** : boutons/champs 14–16px, cartes 18–20px, bottom-sheets 28px,
pastilles `999px`. Ombres légères plutôt que lourdes. Cibles tactiles ≥ 44px.

**Cartes** : rendu stylisé « silver/retro » pour que le bleu (itinéraire, marqueurs)
ressorte. Marqueurs : vert = retrait, bleu = livraison.

---

## 4. Inventaire des écrans

### App CLIENT
Onboarding (bienvenue, connexion, OTP) · Accueil **carte plein écran** (localisation,
recherche, cloche notifications) · Recherche d'adresse / autocomplete · Création de commande
(retrait, livraison, description, taille, photo, planifier) · **Planification** (sélecteur
jour + heure) · Offres des livreurs (enchères inversées + prix suggéré) · Paiement séquestre
(MoMo / carte, frais de litige) · **Reçu de paiement** · Suivi temps réel (timeline 4 étapes)
· **Annuler la commande** · **Signaler un litige** · Chat + boîte de réception · Notation
double · **Centre de notifications** · Historique (passées + programmées) · Profil client
(note client, colis envoyés, Ghana Card + téléphone, adresses, moyens de paiement,
**pays & devise** GHS/XOF/NGN).

### App LIVREUR
Onboarding + **vérification documents** (Ghana Card, permis, carte grise, licence PCSRC + QR)
· Accueil livreur (statut en ligne, carte, gains du jour, demandes à proximité, cloche) ·
**Pop-up nouvelle demande** (accepter / refuser + compte à rebours) · Proposer un prix
(≥ minimum suggéré, aperçu du net après commission) · Course active + **actions livreur**
(confirmer la prochaine étape, photo de prise en charge) · Chat + boîte (contact = le client)
· Notation double · **Centre de notifications** · **Statistiques / performance** (gains
hebdo, taux d'acceptation, ponctualité, note) · Historique livraisons · **Détail de course /
reçu de commission** · Gains + **commission dégressive** (20 → 15 → 12 → 9 %) · Retrait
MOMO / banque (1 retrait/jour) · Profil livreur (véhicule, PCSRC + QR, vérification documents,
gains).

---

## 5. Couverture des règles métier (cahier des charges)

- ✅ Auth par téléphone/email + **OTP**, upload pièce d'identité, rôle, **PCSRC + QR**
- ✅ Création de commande + **planification** (publication 30 min avant, rappel 1 h)
- ✅ **Enchères inversées** : prix minimum suggéré (distance), offres livreurs en temps réel
- ✅ **Paiement séquestre** (blocage jusqu'à livraison) + **fonds de litige 1 GHS/course**
- ✅ **Suivi 4 étapes** : En route → Récupéré → En cours → Livré
- ✅ **Chat** texte + image + horodatage
- ✅ **Double notation** client ↔ livreur
- ✅ **Gains** + **commission dégressive** (≤6 → 20 %, ≥7 → 15 %, ≥11 → 12 %, ≥15 → 9 %)
- ✅ **Retrait** MoMo/banque (1/jour, frais ~1 % à charge du livreur)
- ✅ **Photo de prise en charge** optionnelle · **Gestion de litige** (signalement + fonds)
- ✅ **Multi-pays / devise** : GHS · XOF · NGN
- ✅ Notifications (centre dédié + badges) · Mobile Money **MTN / Vodafone / AirtelTigo**

*Non couvert (hors périmètre maquette)* : back-office administrateur (web), intégrations
réelles (Google Maps, Paystack/Hubtel, FCM/APNS), vérification iCOLMS-GH.

---

## 6. Handoff développement (l'outil d'assistance / backend)

Ces maquettes correspondent 1:1 aux fonctionnalités du cahier des charges backend
(Node.js/Express ou NestJS, PostgreSQL + Prisma, WebSocket pour chat & suivi, JWT, FCM/APNS).
Modèles principaux attendus : `users, orders, offers, deliveries, ratings, messages,
transactions, withdrawals`.

Chaque écran de ce prototype est une **référence visuelle** pour l'implémentation Flutter /
React Native. Reprendre les couleurs, la typographie et l'espacement décrits en §3.

---

## 7. Notes & pistes d'évolution

- Bilingue FR/EN : couvre le chrome de navigation, titres et CTA. Le contenu-donnée (noms,
  adresses, messages) reste tel quel. Traduction EN exhaustive possible sur demande.
- La sélection pays/devise met à jour l'affichage (drapeau/devise) sans recalculer tous les
  tarifs — brancher les taux réels côté backend.
- Cartes et positions sont illustratives (pas de Google Maps réel dans la maquette).
