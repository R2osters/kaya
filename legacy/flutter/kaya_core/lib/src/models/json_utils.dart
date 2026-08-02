/// Defensive JSON coercion helpers.
///
/// The NestJS backend returns Prisma objects: fields are camelCase, and
/// Prisma `Decimal` values serialize to JSON *strings* (e.g. "50.00").
/// These helpers accept either strings or numbers so money never breaks.
library;

double? asDoubleOrNull(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

double asDouble(dynamic v, [double fallback = 0]) =>
    asDoubleOrNull(v) ?? fallback;

int? asIntOrNull(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? double.tryParse(v)?.toInt();
  return null;
}

int asInt(dynamic v, [int fallback = 0]) => asIntOrNull(v) ?? fallback;

bool asBool(dynamic v, [bool fallback = false]) {
  if (v is bool) return v;
  if (v is String) return v.toLowerCase() == 'true';
  if (v is num) return v != 0;
  return fallback;
}

String? asStringOrNull(dynamic v) => v?.toString();

String asString(dynamic v, [String fallback = '']) =>
    v?.toString() ?? fallback;

DateTime? asDateOrNull(dynamic v) {
  if (v == null) return null;
  if (v is DateTime) return v;
  if (v is String) return DateTime.tryParse(v)?.toLocal();
  return null;
}

DateTime asDate(dynamic v) => asDateOrNull(v) ?? DateTime.now();

Map<String, dynamic> asMap(dynamic v) =>
    v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

List<Map<String, dynamic>> asMapList(dynamic v) {
  if (v is List) {
    return v.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }
  return const [];
}
