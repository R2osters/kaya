import { CountryCode } from '@prisma/client';

/**
 * Per-country driver onboarding rules (Architecture doc section 7).
 * - Ghana (PCSRC): license number PCSRC-YYYY-NNNNNN + QR code required.
 * - Togo (carte pro): license number CPL-TG-YYYY-NNNNNN.
 * - Benin (permis livreur): license number PL-BEN-YYYY-NNNNNN.
 */
export interface DriverRule {
  licensePattern: RegExp;
  licenseExample: string;
  requiresQrCode: boolean;
}

export const DRIVER_RULES: Record<CountryCode, DriverRule> = {
  [CountryCode.GHA]: {
    licensePattern: /^PCSRC-\d{4}-\d{6}$/,
    licenseExample: 'PCSRC-2024-001234',
    requiresQrCode: true,
  },
  [CountryCode.TGO]: {
    licensePattern: /^CPL-TG-\d{4}-\d{6}$/,
    licenseExample: 'CPL-TG-2024-005678',
    requiresQrCode: false,
  },
  [CountryCode.BEN]: {
    licensePattern: /^PL-BEN-\d{4}-\d{6}$/,
    licenseExample: 'PL-BEN-2024-001234',
    requiresQrCode: false,
  },
};

export interface DriverFields {
  driverLicenseNumber?: string;
  driverQrCode?: string;
}

/** Returns a human-readable error message, or null when the fields are valid. */
export function validateDriverFields(
  country: CountryCode,
  fields: DriverFields,
): string | null {
  const rule = DRIVER_RULES[country];

  if (!fields.driverLicenseNumber) {
    return `driverLicenseNumber is required for drivers in ${country} (e.g. ${rule.licenseExample}).`;
  }
  if (!rule.licensePattern.test(fields.driverLicenseNumber)) {
    return `driverLicenseNumber must match the ${country} format ${rule.licenseExample}.`;
  }
  if (rule.requiresQrCode && !fields.driverQrCode) {
    return `driverQrCode (PCSRC QR) is required for drivers in ${country}.`;
  }
  return null;
}
