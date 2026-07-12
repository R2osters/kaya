import 'package:flutter/foundation.dart' show SynchronousFuture;
import 'package:flutter/material.dart';

/// App localizations (FR default, EN toggle).
///
/// This is a hand-written delegate backed by the same keys as
/// `lib/l10n/app_fr.arb` / `app_en.arb`. It is intentionally not the
/// `flutter gen-l10n` output so the package compiles without a codegen step;
/// the ARB files remain the formal source and can regenerate this later.
class KayaL10n {
  KayaL10n(this.locale);

  final Locale locale;

  static KayaL10n of(BuildContext context) =>
      Localizations.of<KayaL10n>(context, KayaL10n)!;

  static const LocalizationsDelegate<KayaL10n> delegate = _KayaL10nDelegate();

  /// FR first — French is the default language.
  static const List<Locale> supportedLocales = [Locale('fr'), Locale('en')];

  bool get _fr => locale.languageCode == 'fr';
  String _t(String fr, String en) => _fr ? fr : en;

  // Navigation
  String get navHome => _t('Accueil', 'Home');
  String get navHistory => _t('Historique', 'History');
  String get navMessaging => _t('Messages', 'Messaging');
  String get navProfile => _t('Profil', 'Profile');
  String get navEarnings => _t('Gains', 'Earnings');
  String get navRequests => _t('Demandes', 'Requests');

  // Actions
  String get actionContinue => _t('Continuer', 'Continue');
  String get actionConfirm => _t('Confirmer', 'Confirm');
  String get actionCancel => _t('Annuler', 'Cancel');
  String get actionAccept => _t('Accepter', 'Accept');
  String get actionRefuse => _t('Refuser', 'Refuse');
  String get actionRetry => _t('Réessayer', 'Retry');
  String get actionSave => _t('Enregistrer', 'Save');
  String get actionNext => _t('Suivant', 'Next');
  String get actionSend => _t('Envoyer', 'Send');
  String get actionClose => _t('Fermer', 'Close');
  String get actionCall => _t('Appeler', 'Call');
  String get actionChat => _t('Discuter', 'Chat');

  // Auth / onboarding
  String get authWelcomeTitle => _t('Livrez tout, partout', 'Deliver anything, anywhere');
  String get authWelcomeSubtitle => _t(
      'Mettez en relation avec des livreurs de confiance près de vous.',
      'Connect with trusted drivers near you.');
  String get authLogin => _t('Se connecter', 'Sign in');
  String get authRegister => _t('Créer un compte', 'Create account');
  String get authPhone => _t('Téléphone', 'Phone');
  String get authEmail => _t('E-mail', 'Email');
  String get authPassword => _t('Mot de passe', 'Password');
  String get authFullName => _t('Nom complet', 'Full name');
  String get authOtpTitle => _t('Vérification', 'Verification');
  String get authOtpSubtitle =>
      _t('Saisissez le code envoyé à votre téléphone.', 'Enter the code sent to your phone.');
  String get authVerify => _t('Vérifier', 'Verify');
  String get authLogout => _t('Se déconnecter', 'Sign out');
  String get authCountry => _t('Pays', 'Country');

  // Home
  String get homeWhatMoving => _t('Que faut-il livrer ?', 'What needs moving?');
  String get homeNewDelivery => _t('Nouvelle livraison', 'New Delivery');
  String get homeScheduled => _t('Planifié', 'Scheduled');
  String get homeRecentDropoffs => _t('Livraisons récentes', 'Recent drop-offs');
  String get homeSearchHint => _t('Où livrons-nous ?', 'Where are we delivering?');

  // Order creation
  String get orderPickup => _t('Point de retrait', 'Pickup');
  String get orderDropoff => _t('Point de livraison', 'Drop-off');
  String get orderDescription => _t('Description du colis', 'Package description');
  String get orderSize => _t('Taille', 'Size');
  String get orderPhoto => _t('Photo', 'Photo');
  String get orderSchedule => _t('Planifier', 'Schedule');
  String get orderScheduleDay => _t('Jour', 'Day');
  String get orderScheduleHour => _t('Heure', 'Hour');
  String get orderSuggestedPrice => _t('Prix suggéré', 'Suggested price');
  String get orderCreate => _t('Publier la commande', 'Publish order');
  String get orderCancelTitle => _t('Annuler la commande', 'Cancel order');
  String get orderReportDispute => _t('Signaler un litige', 'Report a dispute');

  // Offers
  String get offersTitle => _t('Offres des livreurs', 'Driver Offers');
  String get offersAwaiting => _t("En attente d'offres…", 'Awaiting offers…');
  String get offersAppSuggested => _t('Prix suggéré', 'App Suggested Price');
  String offersTrips(String count) => _t('$count courses', '$count trips');
  String offersMinAway(String min) => _t('$min min', '$min min away');

  // Payment
  String get payTitle => _t('Paiement séquestre', 'Escrow payment');
  String get payMomo => _t('Mobile Money', 'Mobile Money');
  String get payCard => _t('Carte', 'Card');
  String get payLitigationFee => _t('Frais de litige', 'Litigation fee');
  String get payTotal => _t('Total', 'Total');
  String get payPay => _t('Payer', 'Pay');
  String get payReceipt => _t('Reçu de paiement', 'Payment receipt');
  String get payEscrowNote => _t(
      "Les fonds sont bloqués jusqu'à la livraison.",
      'Funds are held until delivery is complete.');

  // Tracking
  String get trackTitle => _t('Suivi en direct', 'Live tracking');
  String get trackEnRoute => _t('En route', 'En route');
  String get trackPickedUp => _t('Récupéré', 'Picked up');
  String get trackInTransit => _t('En cours', 'On the way');
  String get trackDelivered => _t('Livré', 'Delivered');
  String get trackEta => _t('Arrivée estimée', 'Estimated arrival');

  // Chat / inbox
  String get chatToday => _t("Aujourd'hui", 'Today');
  String get chatHint => _t('Écrire un message…', 'Type a message…');
  String get chatArrived => _t('Le livreur est arrivé', 'Driver has arrived');
  String get inboxTitle => _t('Messages', 'Messaging');
  String get inboxEmpty => _t('Aucune conversation pour le moment.', 'No conversations yet.');

  // Rating
  String get rateTitle => _t('Notez votre expérience', 'Rate your experience');
  String get rateComment => _t('Ajouter un commentaire (facultatif)', 'Add a comment (optional)');
  String get rateSubmit => _t('Envoyer la note', 'Submit rating');

  // Notifications
  String get notifTitle => _t('Notifications', 'Notifications');
  String get notifEmpty => _t('Vous êtes à jour.', "You're all caught up.");

  // History
  String get historyPast => _t('Passées', 'Past');
  String get historyScheduled => _t('Programmées', 'Scheduled');
  String get historyEmpty => _t('Aucune livraison pour le moment.', 'No deliveries yet.');

  // Profile
  String get profileTitle => _t('Profil', 'Profile');
  String get profileClient => _t('Client', 'Client');
  String get profileDriver => _t('Livreur', 'Driver');
  String get profileRating => _t('Note moyenne', 'Average Rating');
  String profileDeliveries(String count) => _t('$count livraisons', '$count Deliveries');
  String get profileVerified => _t('Compte vérifié', 'Verified Account');
  String get profileIdVerification => _t("Vérification d'identité", 'ID Verification');
  String get profileGhanaCard => _t('Carte Ghana', 'Ghana Card');
  String get profileLicense => _t('Permis de conduire', "Driver's License");
  String get profileRegistration => _t('Carte grise', 'Vehicle Registration');
  String get profileApproved => _t('Approuvé', 'Approved');
  String get profilePending => _t('En attente', 'Pending Review');
  String get profileAddresses => _t('Adresses', 'Addresses');
  String get profilePaymentMethods => _t('Moyens de paiement', 'Payment methods');
  String get profileCountryCurrency => _t('Pays et devise', 'Country & currency');
  String get profileQrCode => _t('Code QR livreur', 'Driver QR Code');
  String get profileQrHint => _t(
      'Montrez ceci aux commerçants pour un scan rapide.',
      'Show this to merchants for quick scan.');

  // Driver
  String get driverOnline => _t('En ligne', 'Online');
  String get driverOffline => _t('Hors ligne', 'Offline');
  String get driverTodayEarnings => _t('Gains du jour', "Today's earnings");
  String get driverNearbyRequests => _t('Demandes à proximité', 'Nearby requests');
  String get driverNewRequest => _t('Nouvelle demande', 'New request');
  String get driverProposePrice => _t('Proposer un prix', 'Propose a price');
  String get driverNetAfterCommission => _t('Net après commission', 'Net after commission');
  String get driverCommission => _t('Commission', 'Commission');
  String get driverMinimum => _t('Minimum', 'Minimum');
  String get driverActiveDelivery => _t('Course active', 'Active delivery');
  String get driverConfirmNextStep => _t("Confirmer l'étape suivante", 'Confirm next step');
  String get driverTakePickupPhoto => _t('Photo de prise en charge', 'Pickup photo');
  String get driverStats => _t('Statistiques', 'Statistics');
  String get driverWeeklyEarnings => _t('Gains hebdomadaires', 'Weekly earnings');
  String get driverAcceptanceRate => _t("Taux d'acceptation", 'Acceptance rate');
  String get driverPunctuality => _t('Ponctualité', 'Punctuality');
  String get driverWithdraw => _t('Retrait', 'Withdraw');
  String get driverWithdrawNotice => _t('Un seul retrait par jour.', 'One withdrawal per day.');
  String get driverBank => _t('Banque', 'Bank');
  String get driverCommissionTiers => _t('Commission dégressive', 'Degressive commission');
  String get driverVerifyDocuments => _t('Vérification des documents', 'Document verification');

  // Driver onboarding / documents / vehicle
  String get driverWelcomeSubtitle =>
      _t('Gagnez en livrant près de chez vous.', 'Earn by delivering near you.');
  String get driverUploadDocsHint => _t(
      'Téléversez vos documents pour être vérifié.',
      'Upload your documents to get verified.');
  String get driverVehicle => _t('Véhicule', 'Vehicle');
  String get driverVehicleType => _t('Type', 'Type');
  String get driverVehicleRegistration => _t('Immatriculation', 'Registration');
  String get driverLicenseNumber => _t('Licence', 'Licence');
  String get driverLicensePcsrc => _t('Licence PCSRC', 'PCSRC licence');
  String get driverCardPro => _t('Carte professionnelle', 'Professional card');
  String get driverCourierPermit => _t('Permis de livreur', 'Courier permit');
  String get docIdCard => _t('Carte Ghana / Pièce', 'Ghana Card / ID');
  String get docLicense => _t('Permis de conduire', "Driver's licence");
  String get docRegistration => _t('Carte grise', 'Vehicle registration');
  String get docPcsrcQr => _t('Licence PCSRC + QR', 'PCSRC licence + QR');
  String get driverTierCurrent => _t('Actuel', 'Current');
  String driverDeliveryRange(String range) =>
      _t('Livraisons $range', 'Deliveries $range');
  String driverTierLine(String number, String pct) => _t(
      'Livraison n°$number du jour — palier $pct%.',
      'Delivery #$number today — $pct% tier.');
  String get driverTotalDeliveries =>
      _t('Total livraisons', 'Total deliveries');
  String get offerSent => _t('Offre envoyée', 'Offer sent');
  String get withdrawRequested => _t('Retrait demandé', 'Withdrawal requested');
  String get invalidAmount => _t('Montant invalide', 'Invalid amount');
  String get clientLabel => _t('Client', 'Client');

  // Order actions
  String get orderNumber => _t('Commande', 'Order');
  String get addressTitle => _t('Adresse', 'Address');
  String get cancelReason => _t('Motif', 'Reason');
  String get disputeSubmitted => _t(
      'Litige signalé. Notre équipe vous contactera.',
      'Dispute reported. Our team will contact you.');
  String get orderCancelConfirm =>
      _t('Voulez-vous vraiment annuler ?', 'Are you sure you want to cancel?');

  // Common
  String get commonLoading => _t('Chargement…', 'Loading…');
  String get commonError => _t('Une erreur est survenue.', 'Something went wrong.');
  String get commonEmpty => _t('Rien à afficher.', 'Nothing to show.');
  String commonKm(String km) => '$km km';
}

class _KayaL10nDelegate extends LocalizationsDelegate<KayaL10n> {
  const _KayaL10nDelegate();

  @override
  bool isSupported(Locale locale) =>
      ['fr', 'en'].contains(locale.languageCode);

  @override
  Future<KayaL10n> load(Locale locale) =>
      SynchronousFuture<KayaL10n>(KayaL10n(locale));

  @override
  bool shouldReload(_KayaL10nDelegate old) => false;
}
