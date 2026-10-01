# Restylage sur les planches de spec — ce qui a été appliqué

Source : `Kaya — Planches de spec` (1a–1o) et `Kaya — Prototype`.
Périmètre : **style uniquement**. Aucune route, aucun appel réseau, aucune règle
métier n'a changé. Les `testID` existants sont tous conservés.

## Ce que la spec a validé sans rien changer

- **Palette** : identique, à la valeur près (1a dit « aucune autre valeur »).
- **Typographie** : les 11 styles existaient déjà au bon niveau. Un seul
  manquait, `priceXL 34/38 · 800`, ajouté pour le montant *saisi* (1k).
- **Rayons** : field 14, button 16, cardTight 18, card 20, sheet 28, pill 999 —
  déjà en place.
- **Motion** : 3 ressorts (`press` / `settle` / `sheet`), cascade 40 ms plafonnée
  à 6 — exactement ce qui avait été construit à l'étape précédente.

## Composants ajoutés à @kaya/ui

La spec nommait elle-même ses manques. Les quatre sont livrés, testés, exportés.

| Composant | Rôle | Écrans |
|---|---|---|
| `KayaGlassBar` | Surface flottant sur la carte | accueil client, ETA du suivi |
| `KayaCommissionGauge` | Palier de commission rempli course par course | accueil, gains et stats livreur |
| `KayaCountdownRing` | Temps restant pour répondre | prêt pour offres (1d) et pop-up demande (1i) |
| `KayaSlideToConfirm` | Action unique d'une course, variantes `slide` et `hold` | course active livreur |

S'y ajoutent `KayaDraggableSheet` (feuille à deux positions) et les hooks
`useSmoothedPoint` / `useReducedMotion` livrés juste avant.

### Le verre : repli assumé, pas oubli

`expo-blur` est un module natif. L'installer invaliderait le dev-client déjà
posé sur l'émulateur tant qu'un APK n'est pas reconstruit — donc régression
immédiate. La spec prévoit ce cas (« repli : surface opaque + border »), et
c'est ce qui est livré, derrière le même motif de registre que les cartes :

```ts
import { BlurView } from "expo-blur";
registerBlurProvider(BlurView);   // une ligne, le jour où l'APK est reconstruit
```

Toutes les surfaces en verre passent alors au flou d'un coup, sans toucher un
seul écran.

## Écrans repris

- **Accueil client (1b)** — carte plein écran, barre de recherche + cloche en
  verre, carte d'action ancrée au pouce avec salut, récents en lignes de 44 px
  et CTA primaire. Les récents ne sont plus des cartes dans une carte.
- **Suivi client (1g)** — carte plein écran, pastille d'étape en verre,
  `KayaDraggableSheet` à deux positions (0,42 / 0,80) à la place d'une colonne
  fixe. Le marqueur du livreur glisse entre deux points GPS.
- **Offres client (1d)** — prix en `priceLarge` (c'est l'information n°1),
  nom en `cardTitle`, overline « EN DIRECT » quand la liste se remplit seule.
- **Paiement client (1f)** — carte séquestre en `primaryTint` rayon 18, montant
  en `priceLarge`.
- **Reçu client** — marque de paiement qui arrive une fois, lignes en cascade.
- **Accueil livreur (1h)** — rangée profil, carte statut en **aplat encre** en
  ligne (le seul aplat sombre des deux apps : lisible en plein soleil) qui
  redevient surface hors ligne, carte gains avec la jauge de commission.
- **Proposition livreur (1k)** — montant saisi en `priceXL`, carte du net en
  `successTint`, déductions en danger, net en success.
- **Course active livreur (1l)** — `KayaSlideToConfirm` remplace le bouton :
  même place, même geste, seul le libellé change. Un téléphone qui passe la
  journée dans une poche ne doit pas pouvoir livrer un colis encore sanglé.
- **Gains livreur (1n)** et **stats** — jauge de commission partagée ; l'écran
  stats dessinait sa propre échelle, supprimée.
- **Retrait livreur (1o)** — solde en `priceLarge`.
- **Marge d'écran** — 32 écrans passés de 24 à **16**, la valeur de la spec.

## Variantes : ce qui a été choisi

La spec propose des alternatives. Retenu :

- **Offres → 1d « flux en direct »** plutôt que 1e comparateur : c'est la
  hiérarchie que le temps réel existant produit déjà.
- **Course active → 1l « glissière »** plutôt que 1m « maintenir ». La variante
  `hold` existe dans le composant (`variant="hold"`), une prop suffit à basculer.

## Non fait, et pourquoi

- **Pop-up demande (1i / 1j)** — cet écran n'existe pas dans l'app. Le
  construire serait une fonctionnalité, pas un restylage. `KayaCountdownRing`
  et `KayaSlideToConfirm`, ses deux pièces, sont prêts.
- **Haptique** (1l, 1n) — `expo-haptics` est natif, même raison que le flou.
- **Flou réel** — voir plus haut.

## Vérification

| | typecheck | lint | tests |
|---|---|---|---|
| @kaya/core | ✅ | ✅ | 295 |
| @kaya/ui | ✅ | ✅ | 287 |
| client | ✅ | ✅ | 392 |
| driver | ✅ | ✅ | 224 |

**1 198 tests verts.** Et surtout, les deux apps ont été **réellement
empaquetées par Metro** (HTTP 200, ~15,2 Mo chacune, aucune erreur de
résolution) : Jest ne prouve pas qu'un bundle se construit, ce contrôle si.

La simulation en cours (Metro 8081, backend 3000) n'a pas été touchée ; les
bundlers de contrôle tournaient sur 8091/8092 et ont été arrêtés.

## Un piège à connaître

Le serveur de dev réécrit périodiquement `.expo/types/router.d.ts` en version
vide (voir `scripts/regen-router-types.mjs` pour la cause exacte). Si `tsc`
sort 48 erreurs de route d'un coup, ce n'est pas le code : lancer
`npm run typecheck`, qui régénère le fichier avant de vérifier.
