import '../constants.dart';
import 'enums.dart';
import 'json_utils.dart';

/// A platform user (client and/or driver). Mirrors backend `users` (camelCase).
class User {
  const User({
    required this.id,
    required this.email,
    required this.phone,
    required this.fullName,
    required this.role,
    required this.countryCode,
    this.age,
    this.city,
    this.profilePhoto,
    this.idCardPhoto,
    this.isVerified = false,
    this.isActive = true,
    this.isOnline = false,
    this.ratingDriver = 5.0,
    this.ratingClient = 5.0,
    this.totalDeliveries = 0,
    this.dailyDeliveries = 0,
    this.balance = 0,
    this.driverLicenseNumber,
    this.driverLicensePhoto,
    this.driverQrCode,
    this.vehicleType,
    this.vehicleRegistration,
    this.vehiclePhoto,
  });

  final String id;
  final String email;
  final String phone;
  final String fullName;
  final UserRole role;
  final CountryCode countryCode;
  final int? age;
  final String? city;
  final String? profilePhoto;
  final String? idCardPhoto;
  final bool isVerified;
  final bool isActive;
  final bool isOnline;
  final double ratingDriver;
  final double ratingClient;
  final int totalDeliveries;
  final int dailyDeliveries;
  final double balance;

  // Driver-specific
  final String? driverLicenseNumber;
  final String? driverLicensePhoto;
  final String? driverQrCode;
  final VehicleType? vehicleType;
  final String? vehicleRegistration;
  final String? vehiclePhoto;

  Currency get currency => countryCode.currency;
  bool get isDriver => role == UserRole.livreur || role == UserRole.both;
  bool get isClient => role == UserRole.client || role == UserRole.both;

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: asString(j['id']),
        email: asString(j['email']),
        phone: asString(j['phone']),
        fullName: asString(j['fullName']),
        role: userRoleFromWire(j['role'] as String?),
        countryCode: CountryCodeX.fromWire(j['countryCode'] as String?),
        age: asIntOrNull(j['age']),
        city: asStringOrNull(j['city']),
        profilePhoto: asStringOrNull(j['profilePhoto']),
        idCardPhoto: asStringOrNull(j['idCardPhoto']),
        isVerified: asBool(j['isVerified']),
        isActive: asBool(j['isActive'], true),
        isOnline: asBool(j['isOnline']),
        ratingDriver: asDouble(j['ratingDriver'], 5),
        ratingClient: asDouble(j['ratingClient'], 5),
        totalDeliveries: asInt(j['totalDeliveries']),
        dailyDeliveries: asInt(j['dailyDeliveries']),
        balance: asDouble(j['balance']),
        driverLicenseNumber: asStringOrNull(j['driverLicenseNumber']),
        driverLicensePhoto: asStringOrNull(j['driverLicensePhoto']),
        driverQrCode: asStringOrNull(j['driverQrCode']),
        vehicleType: vehicleTypeFromWire(j['vehicleType'] as String?),
        vehicleRegistration: asStringOrNull(j['vehicleRegistration']),
        vehiclePhoto: asStringOrNull(j['vehiclePhoto']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'phone': phone,
        'fullName': fullName,
        'role': role.name,
        'countryCode': countryCode.wire,
        'age': age,
        'city': city,
        'profilePhoto': profilePhoto,
        'isVerified': isVerified,
        'isOnline': isOnline,
        'ratingDriver': ratingDriver,
        'ratingClient': ratingClient,
        'totalDeliveries': totalDeliveries,
        'dailyDeliveries': dailyDeliveries,
        'balance': balance,
        'driverLicenseNumber': driverLicenseNumber,
        'driverQrCode': driverQrCode,
        'vehicleType': vehicleType?.name,
        'vehicleRegistration': vehicleRegistration,
      };

  User copyWith({bool? isOnline, double? balance}) => User(
        id: id,
        email: email,
        phone: phone,
        fullName: fullName,
        role: role,
        countryCode: countryCode,
        age: age,
        city: city,
        profilePhoto: profilePhoto,
        idCardPhoto: idCardPhoto,
        isVerified: isVerified,
        isActive: isActive,
        isOnline: isOnline ?? this.isOnline,
        ratingDriver: ratingDriver,
        ratingClient: ratingClient,
        totalDeliveries: totalDeliveries,
        dailyDeliveries: dailyDeliveries,
        balance: balance ?? this.balance,
        driverLicenseNumber: driverLicenseNumber,
        driverLicensePhoto: driverLicensePhoto,
        driverQrCode: driverQrCode,
        vehicleType: vehicleType,
        vehicleRegistration: vehicleRegistration,
        vehiclePhoto: vehiclePhoto,
      );
}
