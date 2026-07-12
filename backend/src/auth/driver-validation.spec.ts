import { CountryCode } from '@prisma/client';
import { validateDriverFields } from './driver-validation';

describe('validateDriverFields (per-country driver onboarding)', () => {
  describe('Ghana (GHA)', () => {
    it('accepts a valid PCSRC number with QR code', () => {
      expect(
        validateDriverFields(CountryCode.GHA, {
          driverLicenseNumber: 'PCSRC-2024-001234',
          driverQrCode: 'data:image/png;base64,abc',
        }),
      ).toBeNull();
    });

    it('rejects a PCSRC number with the wrong format', () => {
      expect(
        validateDriverFields(CountryCode.GHA, {
          driverLicenseNumber: 'PCSRC-24-1234',
          driverQrCode: 'qr',
        }),
      ).toMatch(/format/);
    });

    it('requires the QR code in Ghana', () => {
      expect(
        validateDriverFields(CountryCode.GHA, { driverLicenseNumber: 'PCSRC-2024-001234' }),
      ).toMatch(/driverQrCode/);
    });

    it('requires a license number', () => {
      expect(validateDriverFields(CountryCode.GHA, {})).toMatch(/driverLicenseNumber is required/);
    });
  });

  describe('Togo (TGO)', () => {
    it('accepts a valid CPL-TG number without QR code', () => {
      expect(
        validateDriverFields(CountryCode.TGO, { driverLicenseNumber: 'CPL-TG-2024-005678' }),
      ).toBeNull();
    });

    it('rejects a Ghana-format number in Togo', () => {
      expect(
        validateDriverFields(CountryCode.TGO, { driverLicenseNumber: 'PCSRC-2024-001234' }),
      ).toMatch(/TGO format/);
    });
  });

  describe('Benin (BEN)', () => {
    it('accepts a valid PL-BEN number', () => {
      expect(
        validateDriverFields(CountryCode.BEN, { driverLicenseNumber: 'PL-BEN-2024-001234' }),
      ).toBeNull();
    });

    it('rejects an invalid Benin number', () => {
      expect(
        validateDriverFields(CountryCode.BEN, { driverLicenseNumber: 'BEN-2024-1' }),
      ).toMatch(/BEN format/);
    });
  });
});
