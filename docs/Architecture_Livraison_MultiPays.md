## Plateforme de Livraison Multi-Pays 

_Architecture Technique Complete Ghana - Togo - Benin_ 

BACKEND NODE.JS + FLUTTER 

Type: Application de livraison a la demande Stack: Node.js / Express / PostgreSQL / Prisma / Flutter Version: 1.0 - Juillet 2026 

## Table des Matieres 

## 1. Vue d ensemble du systeme 

- 1.1 Contexte et objectifs 

- 1.2 Portee geographique 

- 1.3 Architecture globale 

## 2. Modeles de donnees 

- 2.1 Diagramme entite-relation 

- 2.2 Description des tables 

- 2.3 Adaptation par pays 

## 3. API REST - Endpoints 

- 3.1 Authentification 

- 3.2 Commandes 

- 3.3 Offres et encheres 

- 3.4 Paiements 

- 3.5 Livraisons et suivi 

- 3.6 Messagerie 

- 3.7 Notations 

- 3.8 Gains et retraits 

- 3.9 Administration 

## 4. Flux metiers detailles 

- 4.1 Creation de commande 

- 4.2 Enchere inversee 

- 4.3 Cycle de livraison 

- 4.4 Commission degressive 

- 4.5 Paiement sequestre 

## 5. Infrastructure technique 

- 5.1 Stack technique 

- 5.2 Architecture deploiement 

- 5.3 Securite 

## 6. Mobile Flutter 

- 6.1 Structure du projet 

   - 6.2 Ecrans principaux 

   - 6.3 Services et providers 

7. Implementation par pays 

   - 7.1 Ghana - PCSRC 

   - 7.2 Togo - Carte professionnelle 

   - 7.3 Benin - Permis livreur 

8. Plan de mise en oeuvre 

1. Vue d ensemble du systeme 

## 1. Vue d ensemble du systeme 

## 1.1 Contexte et objectifs 

La presente architecture definit une plateforme de livraison a la demande operationnelle dans trois pays d Afrique de l Ouest : le Ghana, le Togo et le Benin. Le systeme met en relation des clients (particuliers et commercants) avec des livreurs independants via une application mobile Flutter et un backend Node.js robuste. 

Les objectifs principaux sont : 

- Permettre la creation et la gestion de commandes de livraison en temps reel Implementer un systeme d encheres inversees ou les livreurs proposent leurs prix Assurer un paiement securise via sequestre avec liberation post-livraison 

- Adapter le processus d inscription des livreurs aux reglementations locales de chaque pays 

- Calculer une commission degressive encourageant l activite des livreurs 

- Fournir un suivi GPS en temps reel et une messagerie integree 

## 1.2 Portee geographique 

Tableau 1 Couverture geographique et specificites 

|Pays<br>Villes cibles (Phase<br>1)<br>Monnaie<br>Specifcite livreur|Moyens de paiement|
|---|---|
|Ghana<br>Accra, Kumasi,<br>Tamale<br>GHS (Cedi)<br>Licence PCSRC + QR<br>Code|MOMO, Carte bancaire|
|Togo<br>Lome, Sokode, Kara<br>XOF (Franc<br>CFA)<br>Carte professionnelle<br>livreur|MOMO (TMoney),<br>Carte, Flooz|
|Benin<br>Cotonou, Porto-<br>Novo, Parakou<br>XOF (Franc<br>CFA)<br>Permis livreur<br>professionnel|MOMO (MTN), Carte,<br>Moov Money|



4 

2. Modeles de donnees 

## 1.3 Architecture globale 

Le systeme adopte une architecture en trois tiers : 

## Architecture 3-Tiers 

Presentation (Flutter) : Application mobile iOS/Android avec cartes GPS, messagerie temps reel, notifications push. 

Application (Node.js/Express) : API RESTful + WebSocket pour les operations metiers, authentification, calculs de prix, gestion des paiements. 

Donnees (PostgreSQL + Redis) : Base relationnelle pour les transactions avec Prisma ORM, cache Redis pour sessions et positions GPS. 

Les composants externes integres sont : 

- Google Maps API : Geocoding, Distance Matrix, Directions 

- Firebase Cloud Messaging : Notifications push (Android + iOS) 

- Passerelle de paiement : Paystack (Ghana), Kkiapay (Togo/Benin) - placeholder pour l integration 

- Socket.io : Communication temps reel (chat, suivi GPS) 

- AWS S3 / Cloudflare R2 : Stockage des photos (cartes d identite, colis) 

## 2. Modeles de donnees 

## 2.1 Diagramme entite-relation 

Le schema de base de donnees comprend les entites principales suivantes avec leurs relations : 

Tableau 2 Entites principales et relations 

Entite Description Relations 

5 

2. Modeles de donnees 

|User|Utilisateur (client et/ou|Orders (1:N), Ofers (1:N), Ratings (1:N), Messages|
|---|---|---|
||livreur)|(1:N), Withdrawals (1:N)|
|Order|Commande de livraison|User (N:1), Ofers (1:N), Delivery (1:1), Messages (1:N)|
|Ofer|Ofre de prix d un livreur|Order (N:1), User (N:1)|
||Details d une livraison||
|Delivery|efectuee|Order (1:1), User livreur (N:1), Ratings (1:N)|
|Rating|Notation client-livreur|Delivery (N:1), User auteur (N:1), User cible (N:1)|
|Message|Message dans le chat|Delivery (N:1), User expediteur (N:1), User<br>destinataire (N:1)|
|Transaction|Transaction fnanciere|User (N:1), Delivery (N:1)|
|Withdrawal|Demande de retrait<br>livreur|User livreur (N:1)|
|CountryConfg|Confguration par pays|-|
|LitigationFund|Suivi du fonds de litige|Transaction (1:N)|



## 2.2 Description des tables 

6 

2. Modeles de donnees 

## Table : users 

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
email           VARCHAR(255) UNIQUE NOT NULL
phone           VARCHAR(20) UNIQUE NOT NULL
password_hash   VARCHAR(255) NOT NULL
full_name       VARCHAR(255) NOT NULL
age             INTEGER
id_card_photo   VARCHAR(500)           -- URL photo carte identite
profile_photo   VARCHAR(500)           -- URL photo profil
role            VARCHAR(20) NOT NULL   -- 'client', 'livreur', 'both'
country_code    VARCHAR(3) NOT NULL    -- 'GHA', 'TGO', 'BEN'
city            VARCHAR(100)
is_verified     BOOLEAN DEFAULT FALSE  -- Compte verifie par admin
is_active       BOOLEAN DEFAULT TRUE   -- Compte actif/suspendu
created_at      TIMESTAMP DEFAULT NOW()
updated_at      TIMESTAMP DEFAULT NOW()
-- Champs specifiques livreur (NULL si role = 'client')
driver_license_number  VARCHAR(100)   -- Numero permis (pays specifique)
driver_license_photo   VARCHAR(500)   -- Photo du permis/carte
driver_qr_code         VARCHAR(500)   -- QR code scanne
vehicle_type           VARCHAR(50)    -- 'moto', 'voiture', 'camionnette'
vehicle_registration   VARCHAR(100)   -- Immatriculation
vehicle_photo          VARCHAR(500)   -- Photo vehicule
location_lat           DECIMAL(10,8)  -- Position actuelle
location_lng           DECIMAL(11,8)
location_updated_at    TIMESTAMP
is_online              BOOLEAN DEFAULT FALSE  -- Statut en ligne
rating_driver          DECIMAL(2,1) DEFAULT 5.0
total_deliveries       INTEGER DEFAULT 0
daily_deliveries       INTEGER DEFAULT 0     -- Reset a minuit
balance                DECIMAL(12,2) DEFAULT 0.00  -- Gains cumules
fcm_token              VARCHAR(500)   -- Token Firebase pour push
```

7 

2. Modeles de donnees 

## Table : orders 

```
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
client_id           UUID NOT NULL REFERENCES users(id)
pickup_address      TEXT NOT NULL
pickup_lat          DECIMAL(10,8) NOT NULL
pickup_lng          DECIMAL(11,8) NOT NULL
delivery_address    TEXT NOT NULL
delivery_lat        DECIMAL(10,8) NOT NULL
delivery_lng        DECIMAL(11,8) NOT NULL
description         TEXT           -- Description du colis
package_photo       VARCHAR(500)   -- Photo du colis (client)
weight_kg           DECIMAL(6,2)   -- Poids approximatif
dimensions          VARCHAR(50)    -- "LxlxH en cm"
scheduled_time      TIMESTAMP      -- NULL = immediate
published_at        TIMESTAMP      -- Quand publie aux livreurs
status              VARCHAR(30) NOT NULL DEFAULT 'draft'
    -- 'draft', 'published', 'offers_received', 'accepted',
    -- 'driver_en_route', 'picked_up', 'in_transit',
    -- 'delivered', 'cancelled', 'disputed'
min_price_suggested DECIMAL(10,2)  -- Prix minimum calcule
distance_km         DECIMAL(6,2)   -- Distance calculee
accepted_offer_id   UUID REFERENCES offers(id)
created_at          TIMESTAMP DEFAULT NOW()
updated_at          TIMESTAMP DEFAULT NOW()
cancel_reason       TEXT           -- Raison annulation
```

## Table : offers 

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id        UUID NOT NULL REFERENCES orders(id)
livreur_id      UUID NOT NULL REFERENCES users(id)
proposed_price  DECIMAL(10,2) NOT NULL
min_price       DECIMAL(10,2) NOT NULL  -- Prix minimum a l epoque
status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    -- 'pending', 'accepted', 'rejected', 'expired'
created_at      TIMESTAMP DEFAULT NOW()
expires_at      TIMESTAMP      -- Expiration de l offre
UNIQUE(order_id, livreur_id)  -- Un seul offre par livreur par commande
```

8 

2. Modeles de donnees 

## Table : deliveries 

```
id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id                UUID UNIQUE NOT NULL REFERENCES orders(id)
livreur_id              UUID NOT NULL REFERENCES users(id)
pickup_photo            VARCHAR(500)   -- Photo prise en charge
pickup_photo_taken_at   TIMESTAMP
delivery_photo          VARCHAR(500)   -- Photo confirmation livraison
delivery_confirmed_at   TIMESTAMP
start_time              TIMESTAMP      -- Debut de la course
pickup_time             TIMESTAMP      -- Heure de recuperation
delivery_time           TIMESTAMP      -- Heure de livraison
distance_km             DECIMAL(6,2)
base_price              DECIMAL(10,2)  -- Prix de base de la course
commission_rate         DECIMAL(4,2)   -- Taux commission (0.20, 0.15...)
commission_amount       DECIMAL(10,2)  -- Montant commission
litigation_fee          DECIMAL(6,2) DEFAULT 1.00  -- 1 GHS/XOF
net_earnings            DECIMAL(10,2)  -- Gain net livreur
client_payment_status   VARCHAR(20) DEFAULT 'pending'
    -- 'pending', 'escrow_held', 'released', 'refunded'
driver_payout_status    VARCHAR(20) DEFAULT 'pending'
    -- 'pending', 'processed', 'withdrawn'
status                  VARCHAR(30) NOT NULL DEFAULT 'in_progress'
    -- 'in_progress', 'completed', 'cancelled', 'disputed'
created_at              TIMESTAMP DEFAULT NOW()
updated_at              TIMESTAMP DEFAULT NOW()
```

## Table : ratings 

```
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
delivery_id UUID NOT NULL REFERENCES deliveries(id)
from_user_id    UUID NOT NULL REFERENCES users(id)
to_user_id      UUID NOT NULL REFERENCES users(id)
role_type       VARCHAR(10) NOT NULL  -- 'client' ou 'livreur' (role de l evaluateur)
score           INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5)
comment         TEXT
created_at      TIMESTAMP DEFAULT NOW()
```

```
UNIQUE(delivery_id, from_user_id)  -- Une note par utilisateur par livraison
```

9 

2. Modeles de donnees 

## Table : messages 

```
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
delivery_id UUID NOT NULL REFERENCES deliveries(id)
sender_id   UUID NOT NULL REFERENCES users(id)
receiver_id UUID NOT NULL REFERENCES users(id)
message_text    TEXT
image_url       VARCHAR(500)
is_read     BOOLEAN DEFAULT FALSE
read_at     TIMESTAMP
created_at  TIMESTAMP DEFAULT NOW()
```

## Table : transactions 

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID NOT NULL REFERENCES users(id)
delivery_id     UUID REFERENCES deliveries(id)
type            VARCHAR(20) NOT NULL
    -- 'payment_in', 'escrow_release', 'commission', 'litigation_fee',
    -- 'driver_payout', 'withdrawal', 'refund', 'adjustment'
amount          DECIMAL(12,2) NOT NULL
currency        VARCHAR(3) NOT NULL DEFAULT 'GHS'
    -- 'GHS', 'XOF'
status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    -- 'pending', 'completed', 'failed', 'reversed'
reference       VARCHAR(255)   -- Reference externe (passerelle paiement)
payment_method  VARCHAR(50)    -- 'momo', 'card', 'bank_transfer', 'cash'
metadata        JSONB          -- Donnees additionnelles
created_at      TIMESTAMP DEFAULT NOW()
processed_at    TIMESTAMP
```

10 

2. Modeles de donnees 

## Table : withdrawals 

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
livreur_id      UUID NOT NULL REFERENCES users(id)
amount          DECIMAL(12,2) NOT NULL
method          VARCHAR(20) NOT NULL
    -- 'momo', 'bank_transfer'
account_details JSONB NOT NULL
    -- { "phone": "+233...", "provider": "mtn" } pour MOMO
    -- { "account_name": "...", "account_number": "...", "bank_code": "..." } pour
bank
status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    -- 'pending', 'processing', 'completed', 'failed'
fee_amount      DECIMAL(8,2) DEFAULT 0.00  -- Frais de retrait
requested_at    TIMESTAMP DEFAULT NOW()
processed_at    TIMESTAMP
processed_by    UUID REFERENCES users(id)  -- Admin qui a traite
rejection_reason TEXT
```

## Table : country_configs 

```
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
country_code        VARCHAR(3) UNIQUE NOT NULL  -- 'GHA', 'TGO', 'BEN'
country_name        VARCHAR(100) NOT NULL
currency_code       VARCHAR(3) NOT NULL         -- 'GHS', 'XOF'
currency_symbol     VARCHAR(10) NOT NULL        -- 'GHS', 'CFA'
price_per_km        DECIMAL(6,2) NOT NULL DEFAULT 1.00
base_pickup_fee     DECIMAL(8,2) NOT NULL DEFAULT 2.00
commission_tier1    DECIMAL(4,2) NOT NULL DEFAULT 0.20  -- <= 6 livraisons
commission_tier2    DECIMAL(4,2) NOT NULL DEFAULT 0.15  -- >= 7
commission_tier3    DECIMAL(4,2) NOT NULL DEFAULT 0.12  -- >= 11
commission_tier4    DECIMAL(4,2) NOT NULL DEFAULT 0.09  -- >= 15
litigation_fee      DECIMAL(6,2) NOT NULL DEFAULT 1.00
search_radius_km    INTEGER NOT NULL DEFAULT 5
scheduled_publish_buffer_min  INTEGER DEFAULT 30
reminder_before_min INTEGER DEFAULT 60
withdrawal_methods  JSONB NOT NULL DEFAULT '["momo"]'
    -- ["momo", "bank_transfer"] disponibles par pays
momo_providers      JSONB           -- ["mtn", "vodafone", "airteltigo"] etc.
is_active           BOOLEAN DEFAULT TRUE
created_at          TIMESTAMP DEFAULT NOW()
updated_at          TIMESTAMP DEFAULT NOW()
```

11 

3. API REST - Endpoints 

## Table : litigation_fund 

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
transaction_id  UUID NOT NULL REFERENCES transactions(id)
amount          DECIMAL(12,2) NOT NULL
description     TEXT NOT NULL
balance_after   DECIMAL(12,2) NOT NULL  -- Solde apres operation
created_at      TIMESTAMP DEFAULT NOW()
created_by      UUID REFERENCES users(id)
```

## 2.3 Adaptation par pays 

Chaque pays possede sa propre configuration dans la table `country_configs` . L adaptation principale concerne le processus d inscription des livreurs. 

## Tableau recapitulatif par pays 

|Aspect|Ghana|Togo|Benin|
|---|---|---|---|
|Monnaie|GHS|XOF|XOF|
|Prix/km|1.00 GHS|150 XOF|150 XOF|
|Frais prise en charge|2.00 GHS|300 XOF|300 XOF|
|ID livreur|Numero PCSRC|Carte professionnelle|Permis livreur|
|Verifcation|QR Code PCSRC|Photo carte + numero|Photo permis + numero|
|MOMO disponible|MTN, Vodafone, AT|TMoney, Flooz|MTN, Moov|
|Frais retrait MOMO|1%|1%|1%|



## 3. API REST - Endpoints 

Tous les endpoints retournent du JSON. L authentification se fait via JWT Bearer token dans le header `Authorization` . Les codes de statut HTTP standard sont utilises (200, 201, 400, 401, 403, 404, 500). 

12 

3. API REST - Endpoints 

## 3.1 Authentification 

Tableau 3 Endpoints d authentification 

|Methode|Endpoint|Auth|Description|
|---|---|---|---|
|POST|/api/v1/auth/register|Non|Inscription (client ou livreur)|
|POST|/api/v1/auth/login|Non|Connexion email/telephone + mot de passe|
|POST|/api/v1/auth/otp/send|Non|Envoi OTP (SMS ou email)|
|POST|/api/v1/auth/otp/verify|Non|Verifcation du code OTP|
|POST|/api/v1/auth/refresh|Non|Rafraichissement du token JWT|
|POST|/api/v1/auth/logout|Oui|Deconnexion (invalidate token)|
|GET|/api/v1/auth/me|Oui|Profl de l utilisateur connecte|
|PUT|/api/v1/auth/profle|Oui|Mise a jour du profl|
|POST|/api/v1/auth/upload-id|Oui|Upload carte d identite|
|POST|/api/v1/auth/upload-license|Oui|Upload permis/carte livreur (pays specifque)|



## Exemple : Inscription livreur Ghana 

```
POST /api/v1/auth/register
Content-Type: application/json
{
  "email": "livreur@example.com",
  "phone": "+233201234567",
  "password": "SecurePass123!",
  "full_name": "Kofi Mensah",
  "age": 28,
  "role": "livreur",
  "country_code": "GHA",
  "city": "Accra",
  "driver_license_number": "PCSRC-2024-001234",
  "driver_qr_code": "data:image/png;base64,...",
  "vehicle_type": "moto",
  "vehicle_registration": "GR-1234-19"
}
```

13 

3. API REST - Endpoints 

## Exemple : Inscription livreur Togo 

```
POST /api/v1/auth/register
Content-Type: application/json
{
  "email": "livreur@example.tg",
  "phone": "+22890123456",
  "password": "SecurePass123!",
  "full_name": "Amouzou Kodjo",
  "age": 32,
  "role": "livreur",
  "country_code": "TGO",
  "city": "Lome",
  "driver_license_number": "CPL-TG-2024-005678",
  "vehicle_type": "moto",
  "vehicle_registration": "TG-AB-1234"
}
```

## 3.2 Commandes 

Tableau 4 Endpoints de gestion des commandes 

|Methode|Endpoint|Auth|Description|
|---|---|---|---|
|POST|/api/v1/orders|Client|Creer une commande|
|GET|/api/v1/orders|Client|Lister mes commandes|
|GET|/api/v1/orders/:id|Client|Detail d une commande|
|PUT|/api/v1/orders/:id|Client|Modifer une commande (avant publication)|
|DELETE|/api/v1/orders/:id|Client|Annuler une commande|
|POST|/api/v1/orders/:id/publish|Client|Publier la commande aux livreurs|
|GET|/api/v1/orders/nearby|Livreur|Commandes disponibles a proximite|



14 

3. API REST - Endpoints 

## Exemple : Creation de commande 

```
POST /api/v1/orders
Authorization: Bearer <jwt_token>
Content-Type: application/json
{
  "pickup_address": "123 Oxford Street, Accra Central",
  "pickup_lat": 5.6037,
  "pickup_lng": -0.1870,
  "delivery_address": "45 Airport Road, East Legon",
  "delivery_lat": 5.6346,
  "delivery_lng": -0.1664,
  "description": "Boite de chaussures, environ 2kg",
  "weight_kg": 2.0,
  "dimensions": "30x20x15",
  "scheduled_time": null
}
```

## 3.3 Offres et encheres 

Tableau 5 Endpoints du systeme d encheres 

|Methode|Endpoint|Auth|Description|
|---|---|---|---|
|POST|/api/v1/orders/:id/ofers|Livreur|Soumettre une ofre de prix|
|GET|/api/v1/orders/:id/ofers|Client|Voir les ofres recues|
|POST|/api/v1/ofers/:id/accept|Client|Accepter une ofre|
|POST|/api/v1/ofers/:id/reject|Client|Rejeter une ofre|
|GET|/api/v1/calculate-price|Oui|Calculer prix estime (distance x tarif)|



## Exemple : Soumission d offre 

```
POST /api/v1/orders/550e8400-e29b-41d4-a716-446655440000/offers
Authorization: Bearer <jwt_token>
Content-Type: application/json
{
  "proposed_price": 25.00
}
```

15 

3. API REST - Endpoints 

## Reponse : Liste des offres 

```
{
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "min_price": 18.50,
  "offers": [
    {
      "id": "...",
      "livreur_name": "Kofi Mensah",
      "livreur_photo": "https://...",
      "livreur_rating": 4.7,
      "livreur_total_deliveries": 156,
      "proposed_price": 22.00,
      "status": "pending",
      "created_at": "2026-07-08T10:30:00Z"
    }
  ]
}
```

## 3.4 Paiements 

Tableau 6 Endpoints de paiement 

|Methode|Endpoint|Auth|Description|
|---|---|---|---|
|POST|/api/v1/payments/initialize|Client|Initialiser un paiement (lien<br>sequestre)|
|POST|/api/v1/payments/verify|Client|Verifer le statut d un paiement|
|POST|/api/v1/payments/webhook|Non (IP<br>whitelist)|Webhook retour passerelle paiement|
|POST|/api/v1/payments/release|Systeme|Liberer le sequestre au livreur|
|POST|/api/v1/payments/refund|Admin|Rembourser un client (litige)|



## 3.5 Livraisons et suivi 

Tableau 7 Endpoints de livraison 

|Methode|Endpoint|Auth|Description|
|---|---|---|---|
|GET|/api/v1/deliveries|Livreur|Mes livraisons en cours/historique|
|GET|/api/v1/deliveries/:id|Oui|Detail d une livraison|



16 

3. API REST - Endpoints 

|POST|/api/v1/deliveries/:id/start|Livreur|Commencer la course|
|---|---|---|---|
|POST|/api/v1/deliveries/:id/pickup|Livreur|Confrmer la prise en charge + photo|
|POST|/api/v1/deliveries/:id/confrm-delivery|Livreur|Confrmer la livraison|
|POST|/api/v1/deliveries/:id/cancel|Oui|Annuler la livraison|
|POST|/api/v1/location/update|Livreur|Mettre a jour la position GPS|
|GET|/api/v1/location/:livreurId|Client|Obtenir la position d un livreur|



## WebSocket : Suivi temps reel 

```
// Connexion Socket.io
const socket = io('wss://api.example.com', {
  auth: { token: jwt_token }
});
// Livreur : envoi position toutes les 5 secondes
socket.emit('location:update', {
  lat: 5.6037,
  lng: -0.1870
});
// Client : reception position livreur
socket.on('location:driver', (data) => {
  console.log(data); // { livreur_id, lat, lng, timestamp }
});
// Changement d etape
socket.on('delivery:status', (data) => {
  console.log(data); // { delivery_id, status, timestamp }
});
```

## 3.6 Messagerie 

Tableau 8 Endpoints de messagerie 

|Methode|Endpoint|Auth|Description|
|---|---|---|---|
|GET|/api/v1/deliveries/:id/messages|Oui|Historique des messages|
|POST|/api/v1/deliveries/:id/messages|Oui|Envoyer un message (REST fallback)|
|PUT|/api/v1/messages/:id/read|Oui|Marquer comme lu|



17 

3. API REST - Endpoints 

## WebSocket : Chat temps reel 

```
// Rejoindre la room de la livraison
socket.emit('chat:join', { delivery_id: '...' });
// Envoyer un message
socket.emit('chat:message', {
  delivery_id: '...',
  message_text: 'Je suis arrive',
  image_url: null
});
// Recevoir un message
socket.on('chat:message', (msg) => {
  console.log(msg); // { id, sender_id, message_text, image_url, created_at }
});
```

## 3.7 Notations 

Tableau 9 Endpoints de notation 

|Methode|Endpoint|Auth|Description|
|---|---|---|---|
|POST|/api/v1/deliveries/:id/rate|Oui|Soumettre une notation (client ou livreur)|
|GET|/api/v1/users/:id/ratings|Oui|Voir les notations d un utilisateur|



## Exemple de notation 

```
POST /api/v1/deliveries/.../rate
Authorization: Bearer <jwt_token>
Content-Type: application/json
{
  "to_user_id": "uuid-du-destinataire",
  "score": 5,
  "comment": "Livraison rapide et soignee, merci !"
}
```

## 3.8 Gains et retraits 

Tableau 10 Endpoints financiers livreur 

Methode Endpoint Auth Description 

18 

3. API REST - Endpoints 

|GET|/api/v1/driver/balance|Livreur|Solde actuel et historique|
|---|---|---|---|
|GET|/api/v1/driver/earnings|Livreur|Historique detaille des gains|
|POST|/api/v1/driver/withdraw|Livreur|Demande de retrait|
|GET|/api/v1/driver/withdrawals|Livreur|Historique des retraits|
|GET|/api/v1/driver/stats|Livreur|Statistiques (livraisons du jour, commission)|



## Exemple : Demande de retrait 

```
POST /api/v1/driver/withdraw
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

```
{
  "amount": 150.00,
  "method": "momo",
  "account_details": {
    "phone": "+233201234567",
    "provider": "mtn"
  }
}
```

## 3.9 Administration 

## Tableau 11 Endpoints admin 

|Methode|Endpoint|Auth|Description|
|---|---|---|---|
|GET|/api/v1/admin/users|Admin|Liste des utilisateurs (fltres)|
|PUT|/api/v1/admin/users/:id/verify|Admin|Verifer un livreur|
|PUT|/api/v1/admin/users/:id/suspend|Admin|Suspendre un compte|
|GET|/api/v1/admin/orders|Admin|Toutes les commandes|
|GET|/api/v1/admin/deliveries|Admin|Toutes les livraisons|
|PUT|/api/v1/admin/withdrawals/:id/process|Admin|Traiter un retrait|
|GET|/api/v1/admin/litigation-fund|Admin|Solde du fonds de litige|
|GET|/api/v1/admin/stats|Admin|Statistiques globales|
|PUT|/api/v1/admin/country-confg/:code|Admin|Modifer confg pays|



19 

4. Flux metiers detailles 

## 4. Flux metiers detailles 

## 4.1 Creation de commande 

Le flux de creation d une commande suit les etapes suivantes : 

1. Saisie des adresses : Le client saisit l adresse de retrait et de livraison. L autocompletion Google Maps suggere les adresses et fournit les coordonnees GPS (lat, lng). 

2. Description du colis : Le client decrit le contenu, indique le poids approximatif et les dimensions si necessaire. Une photo optionnelle peut etre prise. 

3. Planification (optionnel) : Si le client choisit une livraison programmee, il selectionne une date et heure futures. La commande reste en statut `draft` jusqu a 30 minutes avant l horaire. 

4. Calcul du prix minimum : Le backend calcule la distance via Google Maps Distance Matrix et applique la formule : `prix_min = (distance_km x price_per_km) + base_pickup_fee` . 

5. Publication : Si immediate, la commande passe en `published` et est diffusee aux livreurs dans un rayon de 5 km. Si programmee, un cron job la publie automatiquement 30 min avant l horaire. 

## Regle de planification 

Si `scheduled_time` est defini, la commande n est pas publiee immediatement. Un cron job s execute toutes les minutes pour publier les commandes dont l heaire de publication est atteinte (scheduled_time - 30 min). Le client recoit un rappel push 1 heure avant la livraison. 

## 4.2 Enchere inversee 

Le systeme d encheres inversees fonctionne comme suit : 

20 

4. Flux metiers detailles 

1. Notification : Lorsqu une commande est publiee, les livreurs en ligne dans un rayon de 5 km recoivent une notification push avec les details (adresses, distance, description). 

2. Consultation : Le livreur ouvre l app et voit la liste des commandes disponibles avec le prix minimum suggere. 

3. Proposition : Le livreur propose un prix superieur ou egal au minimum suggere. Il ne peut soumettre qu une seule offre par commande. 

4. Consultation client : Le client voit toutes les offres en temps reel avec le nom, photo, note et nombre de livraisons de chaque livreur. 

5. Acceptation : Le client choisit une offre. Toutes les autres sont automatiquement rejetees (statut `expired` ). 

6. Verrouillage : La commande passe en `accepted` . Un lien de paiement est genere. 

## 4.3 Cycle de livraison 

Une fois l offre acceptee et le paiement effectue, la livraison suit ce cycle : 

Tableau 12 Timeline des statuts de livraison 

|Etape|Statut|Action|Notifcation|
|---|---|---|---|
|1|accepted|Ofre acceptee, paiement en attente|Push au client (lien<br>paiement)|
|2|driver_en_route|Livreur clique "Commencer" et se dirige<br>vers le retrait|Push au client (livreur en<br>route)|
|3|picked_up|Livreur arrive, prend le colis, photo<br>optionnelle|Push au client (colis<br>recupere)|
|4|in_transit|Livreur confrme le depart vers la<br>livraison|Push au client (en cours de<br>livraison)|
|5|delivered|Livreur livre et confrme|Push au client (livre), notif<br>notation|



## 4.4 Commission degressive 

La commission est calculee a chaque livraison terminee selon le nombre de livraisons effectuees par le livreur dans la journee courante (reset a minuit heure locale). 

21 

4. Flux metiers detailles 

## Formule de commission 

```
function calculateCommission(basePrice, dailyDeliveries, countryConfig) {
  let rate;
  if (dailyDeliveries <= 6) rate = countryConfig.commission_tier1;  // 20%
else if (dailyDeliveries >= 7 && dailyDeliveries <= 10) rate =
countryConfig.commission_tier2;  // 15%
else if (dailyDeliveries >= 11 && dailyDeliveries <= 14) rate =
countryConfig.commission_tier3;  // 12%
  else rate = countryConfig.commission_tier4;  // 9% (>= 15)
  const commission = basePrice * rate;
  const litigationFee = countryConfig.litigation_fee;  // 1 GHS / 100 XOF
  const netEarnings = basePrice - commission - litigationFee;
  return { rate, commission, litigationFee, netEarnings };
}
```

Le cron de reset s execute a minuit pour chaque fuseau horaire : 

```
-- Reset du compteur journalier
UPDATE users
SET daily_deliveries = 0
WHERE role IN ('livreur', 'both')
AND DATE_TRUNC('day', location_updated_at AT TIME ZONE 'UTC')
    != DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC');
```

## 4.5 Paiement sequestre 

Le flux de paiement sequestre garantit la securite des transactions : 

1. Initialisation : Lorsque le client accepte une offre, le backend genere une transaction de paiement et appelle l API Paystack/Kkiapay pour creer un lien de paiement. 

2. Paiement client : Le client paie via MOMO ou carte. L argent est achemine vers le compte sequestre de la plateforme. 

3. Verification : Le webhook de la passerelle confirme le paiement. Le statut passe a `escrow_held` . 

4. Liberation : Apres confirmation de livraison, le backend calcule commission + frais de litige, credite le solde du livreur et met a jour la transaction. 

5. Remboursement : En cas de litige resolu en faveur du client, le montant integral est rembourse. 

22 

5. Infrastructure technique 

## 5. Infrastructure technique 

## 5.1 Stack technique 

Tableau 13 Stack technique complete 

|Couche|Technologie|Version|Role|
|---|---|---|---|
|Mobile|Flutter|3.22+|Application iOS/Android|
|Backend|Node.js|20 LTS|Runtime serveur|
|Framework|Express.js|4.21+|Framework web|
|Langage|TypeScript|5.5+|Typage statique|
|Base de donnees|PostgreSQL|16+|Donnees relationnelles|
|ORM|Prisma|5.16+|Acces base de donnees|
|Cache|Redis|7+|Sessions, GPS, cache|
|Temps reel|Socket.io|4.7+|Chat, suivi GPS|
|Auth|JWT (jsonwebtoken)|9+|Tokens d authentifcation|
|Validation|Zod|3.23+|Validation schemas|
|Upload|Multer + AWS SDK|-|Upload photos vers S3|
|Push|Firebase Admin SDK|12+|Notifcations push|
|Cartes|Google Maps API|-|Geocoding, Distance, Directions|
|Paiement|Paystack / Kkiapay|-|Passerelle de paiement|
|Email/SMS|Twilio / SendGrid|-|OTP et notifcations|
|Tests|Jest + Supertest|29+|Tests unitaires et integration|
|Docs|Swagger / OpenAPI|3.0|Documentation API|
|DevOps|Docker + Docker Compose|-|Conteneurisation|



23 

5. Infrastructure technique 

## 5.2 Architecture deploiement 

Le deploiement utilise Docker Compose pour l environnement de developpement et peut etre adapte pour Kubernetes en production. 

```
version: '3.8'
services:
  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/delivery
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - PAYSTACK_SECRET=${PAYSTACK_SECRET}
      - FIREBASE_SERVICE_ACCOUNT=${FIREBASE_SA}
    depends_on:
      - postgres
      - redis
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=delivery
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  flutter-web:
    build: ./frontend/flutter_app
    ports:
      - "8080:80"
volumes:
  postgres_data:
```

## 5.3 Securite 

Tableau 14 Mesures de securite 

24 

6. Mobile Flutter 

|Couche|Mesure|Implementation|
|---|---|---|
|Transport|HTTPS obligatoire|TLS 1.3 via Nginx / Cloudfare|
|Authentifcation|JWT securise|Tokens signes (RS256), expiration 15 min, refresh 7<br>jours|
|Donnees<br>sensibles|Chifrement|bcrypt (mots de passe), AES-256 (donnees bancaires)|
|Uploads|Validation|Type MIME, taille max 5MB, scan virus|
|API|Rate limiting|100 req/min par IP, 1000 req/min par utilisateur|
|Injection|Requetes<br>parametrees|Prisma ORM (protection SQL injection)|
|XSS|Validation|Zod schemas, echappement sortie|
|CORS|Restriction origines|Whitelist domaines autorises|
|Headers|Securisation|Helmet.js (HSTS, CSP, X-Frame-Options)|
|Logs|Audit|Winston (sans donnees sensibles)|
|Secrets|Gestion|Variables d environnement, jamais en dur|



## 6. Mobile Flutter 

25 

6. Mobile Flutter 

## 6.1 Structure du projet 

```
flutter_delivery_app/
```

```
├── android/                    # Configuration Android
├── ios/                        # Configuration iOS
├── lib/
│   ├── main.dart               # Point d entree
│   ├── app.dart                # MaterialApp + routing
│   ├── config/
│   │   ├── constants.dart      # URLs, timeouts, cles
│   │   ├── theme.dart          # ThemeMaterial + couleurs
│   │   └── routes.dart         # Named routes
│   ├── models/
│   │   ├── user.dart           # Modele utilisateur
│   │   ├── order.dart          # Modele commande
│   │   ├── offer.dart          # Modele offre
│   │   ├── delivery.dart       # Modele livraison
│   │   ├── message.dart        # Modele message
│   │   ├── rating.dart         # Modele notation
│   │   └── transaction.dart    # Modele transaction
│   ├── services/
│   │   ├── api_service.dart    # HTTP client (Dio)
│   │   ├── auth_service.dart   # Authentification
│   │   ├── socket_service.dart # Socket.io client
│   │   ├── location_service.dart   # Geolocalisation
│   │   ├── fcm_service.dart    # Firebase Cloud Messaging
│   │   └── payment_service.dart    # Paiement
│   ├── providers/
```

```
│   │   ├── auth_provider.dart  # Etat authentification
│   │   ├── order_provider.dart # Etat commandes
│   │   ├── delivery_provider.dart  # Etat livraisons
│   │   ├── chat_provider.dart  # Etat messagerie
│   │   └── location_provider.dart  # Etat positions GPS
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   ├── register_screen.dart
│   │   │   ├── otp_screen.dart
│   │   │   └── role_selection_screen.dart
│   │   ├── client/
│   │   │   ├── home_screen.dart
│   │   │   ├── create_order_screen.dart
│   │   │   ├── order_detail_screen.dart
│   │   │   ├── offers_screen.dart
│   │   │   ├── payment_screen.dart
│   │   │   ├── tracking_screen.dart
│   │   │   └── order_history_screen.dart
│   │   ├── driver/
│   │   │   ├── driver_home_screen.dart
│   │   │   ├── available_orders_screen.dart
│   │   │   ├── my_deliveries_screen.dart
│   │   │   ├── delivery_detail_screen.dart
```

26 

6. Mobile Flutter 

```
flutter_delivery_app/
```

```
├── android/                    # Configuration Android
├── ios/                        # Configuration iOS
├── lib/
│   ├── main.dart               # Point d entree
│   ├── app.dart                # MaterialApp + routing
│   ├── config/
│   │   ├── constants.dart      # URLs, timeouts, cles
│   │   ├── theme.dart          # ThemeMaterial + couleurs
│   │   └── routes.dart         # Named routes
│   ├── models/
│   │   ├── user.dart           # Modele utilisateur
│   │   ├── order.dart          # Modele commande
│   │   ├── offer.dart          # Modele offre
│   │   ├── delivery.dart       # Modele livraison
│   │   ├── message.dart        # Modele message
│   │   ├── rating.dart         # Modele notation
│   │   └── transaction.dart    # Modele transaction
│   ├── services/
```

```
│   │   ├── api_service.dart    # HTTP client (Dio)
│   │   ├── auth_service.dart   # Authentification
│   │   ├── socket_service.dart # Socket.io client
│   │   ├── location_service.dart   # Geolocalisation
│   │   ├── fcm_service.dart    # Firebase Cloud Messaging
│   │   └── payment_service.dart    # Paiement
│   ├── providers/
```

```
│   │   ├── auth_provider.dart  # Etat authentification
│   │   ├── order_provider.dart # Etat commandes
│   │   ├── delivery_provider.dart  # Etat livraisons
│   │   ├── chat_provider.dart  # Etat messagerie
│   │   └── location_provider.dart  # Etat positions GPS
│   ├── screens/
```

```
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   ├── register_screen.dart
│   │   │   ├── otp_screen.dart
│   │   │   └── role_selection_screen.dart
│   │   ├── client/
│   │   │   ├── home_screen.dart
│   │   │   ├── create_order_screen.dart
│   │   │   ├── order_detail_screen.dart
│   │   │   ├── offers_screen.dart
│   │   │   ├── payment_screen.dart
│   │   │   ├── tracking_screen.dart
│   │   │   └── order_history_screen.dart
│   │   ├── driver/
│   │   │   ├── driver_home_screen.dart
```

```
│   │   │   ├── available_orders_screen.dart
│   │   │   ├── my_deliveries_screen.dart
│   │   │   ├── delivery_detail_screen.dart
│   │   │   ├── earnings_screen.dart
│   │   │   └── withdrawal_screen.dart
│   │   ├── chat/
│   │   │   └── chat_screen.dart
```

27 

6. Mobile Flutter 

## 6.2 Ecrans principaux 

## Flux Client 

Tableau 15 Ecrans client 

|Ecran|Fonctionnalites|Widgets cles|
|---|---|---|
|Home|Carte avec position, bouton nouvelle|GoogleMap, FloatingActionButton,|
||commande, historique rapide|BottomNav|
|CreateOrder|Autocompletion adresses, description colis,|PlaceAutocomplete, TextField,|
||photo, planifcation|ImagePicker|
|Ofers|Liste des ofres livreurs avec prix, note, photo|ListView, OferCard,<br>CountdownTimer|
|Payment|Webview pour paiement Paystack/Kkiapay|WebView, LoadingIndicator|
|Tracking|Carte temps reel avec position livreur,<br>timeline statuts|GoogleMap (markers),<br>DeliveryTimeline|
|Chat|Messagerie temps reel texte + images|ListView (bulles), TextField,<br>ImagePicker|
|Rating|Notation 5 etoiles + commentaire|RatingBar, TextField, SubmitButton|



## Flux Livreur 

Tableau 16 Ecrans livreur 

|Ecran|Fonctionnalites|Widgets cles|
|---|---|---|
|DriverHome|Statut en ligne/hors ligne, gains du jour,|ToggleButton, StatsCards,|
||commandes actives|ActiveDeliveryCard|
|AvailableOrders|Liste commandes a proximite avec prix|ListView, OrderCard,|
||suggere|DistanceBadge|
|DeliveryDetail|Details commande, boutons etapes, photo<br>prise en charge|Stepper, Camera, ActionButtons|
|Earnings|Solde, historique gains, graphique<br>commission|BalanceCard, ListView, BarChart|



28 

6. Mobile Flutter 

Form, Dropdown, ConfirmDialog 

Withdrawal Formulaire retrait (MOMO/banque), limite 1/jour 

## 6.3 Services et providers 

## SocketService (temps reel) 

```
class SocketService extends ChangeNotifier {
  late Socket _socket;
  void connect(String token) {
    _socket = io(Config.socketUrl, OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': token})
      .build());
    _socket.on('location:driver', (data) => notifyListeners());
    _socket.on('chat:message', (msg) => _handleMessage(msg));
    _socket.on('delivery:status', (data) => _handleStatus(data));
  }
  void sendLocation(double lat, double lng) {
    _socket.emit('location:update', {'lat': lat, 'lng': lng});
  }
  void sendMessage(String deliveryId, String text) {
    _socket.emit('chat:message', {
      'delivery_id': deliveryId,
      'message_text': text,
      'image_url': null
    });
  }
  void joinDelivery(String deliveryId) {
    _socket.emit('chat:join', {'delivery_id': deliveryId});
  }
}
```

29 

7. Implementation par pays 

## LocationService (geolocalisation) 

```
class LocationService {
  Stream<Position> getPositionStream() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // metres
      ),
    );
  }
  // Envoi position toutes les 5 secondes
  void startTracking(SocketService socket) {
    Timer.periodic(const Duration(seconds: 5), (_) async {
      final pos = await Geolocator.getCurrentPosition();
      socket.sendLocation(pos.latitude, pos.longitude);
    });
  }
}
```

## 7. Implementation par pays 

## 7.1 Ghana - PCSRC 

Le Ghana exige que chaque livreur possede une licence PCSRC (Private Commercial Service Regulatory Commission) avec QR code. 

## Champs obligatoires - Ghana 

- `driver_license_number` : Numero PCSRC (format : PCSRC-YYYY-NNNNNN) 

- `driver_qr_code` : Image du QR code officiel (upload ou scan) `driver_license_photo` : Photo de la carte PCSRC 

## Flux de verification : 

1. Le livreur saisit son numero PCSRC 

2. Il scanne le QR code officiel avec l appareil photo de l app 

3. L admin verifie manuellement la correspondance (integration future avec iCOLMS-GH) 

30 

8. Plan de mise en oeuvre 

4. Le compte est marque `is_verified = true` 

## 7.2 Togo - Carte professionnelle 

Le Togo delivre des cartes professionnelles de livreur via les autorites competentes. 

## Champs obligatoires - Togo 

- `driver_license_number` : Numero carte professionnelle (format : CPL-TG-YYYY- 

- NNNNNN) 

- `driver_license_photo` : Photo de la carte professionnelle 

- Le QR code est optionnel 

Monnaie : XOF (Franc CFA). Prix de reference : 150 XOF/km, 300 XOF frais de prise en charge. 

## 7.3 Benin - Permis livreur 

Le Benin exige un permis livreur professionnel delivre par les autorites de transport. 

## Champs obligatoires - Benin 

- `driver_license_number` : Numero permis livreur (format : PL-BEN-YYYY-NNNNNN) `driver_license_photo` : Photo du permis livreur 

- Attestation de non condamnation (optionnel pour MVP) 

Monnaie : XOF (Franc CFA). Prix de reference : 150 XOF/km, 300 XOF frais de prise en charge. 

## 8. Plan de mise en oeuvre 

Tableau 17 Phases de developpement 

|Phase|Duree|Livrables|Priorite|
|---|---|---|---|
|Phase 1 - Fondation|2 semaines|Setup projet, DB, auth, inscription par pays|Critique|



31 

8. Plan de mise en oeuvre 

|Phase|2 - Commandes|2 semaines|Creation commande, calcul prix, publication|Critique|
|---|---|---|---|---|
|Phase|3 - Encheres|1 semaine|Systeme ofres, acceptation, notifcations push|Critique|
|Phase|4 - Paiements|2 semaines|Sequestre, passerelle, webhooks|Critique|
|Phase|5 - Livraison|2 semaines|Suivi GPS, timeline, photos|Haute|
|Phase|6 - Messagerie|1 semaine|Chat temps reel Socket.io|Haute|
|Phase|7 - Notations|3 jours|Double notation, calcul moyenne|Moyenne|
|Phase|8 - Gains|1 semaine|Solde, historique, retraits|Haute|
|Phase|9 - Admin|1 semaine|Dashboard, gestion litiges, stats|Moyenne|
|Phase|10 - Flutter|4 semaines|App mobile complete (client + livreur)|Critique|
|Phase|11 - Tests|2 semaines|Tests unitaires, integration, E2E|Haute|
|Phase|12 - Deploiement|1 semaine|Docker, CI/CD, documentation|Haute|



## Total estime 

Duree totale du projet : 19-20 semaines (4.5 - 5 mois) avec une equipe de 2-3 developpeurs. 

MVP fonctionnel (Phases 1-6) : 10 semaines avec livraison complete de bout en bout. 

32 

