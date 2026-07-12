/**
 * Seeds reference data: per-country configs (GHA/TGO/BEN) and one admin user.
 * Idempotent - safe to run repeatedly (uses upserts on unique keys).
 *
 * Run: npm run db:seed
 */
import { CountryCode, Currency, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Commission tiers are identical across countries (Blueprint decision).
const COMMISSION = {
  commissionTier1: 0.2,
  commissionTier2: 0.15,
  commissionTier3: 0.12,
  commissionTier4: 0.09,
};

const COMMON = {
  ...COMMISSION,
  searchRadiusKm: 5,
  scheduledPublishBufferMin: 30,
  reminderBeforeMin: 60,
  isActive: true,
};

const COUNTRY_CONFIGS = [
  {
    countryCode: CountryCode.GHA,
    countryName: 'Ghana',
    currencyCode: Currency.GHS,
    currencySymbol: 'GHS',
    pricePerKm: 1.0,
    basePickupFee: 2.0,
    litigationFee: 1.0,
    withdrawalMethods: ['momo', 'bank_transfer'],
    momoProviders: ['mtn', 'vodafone', 'airteltigo'],
    ...COMMON,
  },
  {
    countryCode: CountryCode.TGO,
    countryName: 'Togo',
    currencyCode: Currency.XOF,
    currencySymbol: 'CFA',
    pricePerKm: 150.0,
    basePickupFee: 300.0,
    litigationFee: 100.0,
    withdrawalMethods: ['momo', 'bank_transfer'],
    momoProviders: ['tmoney', 'flooz'],
    ...COMMON,
  },
  {
    countryCode: CountryCode.BEN,
    countryName: 'Benin',
    currencyCode: Currency.XOF,
    currencySymbol: 'CFA',
    pricePerKm: 150.0,
    basePickupFee: 300.0,
    litigationFee: 100.0,
    withdrawalMethods: ['momo', 'bank_transfer'],
    momoProviders: ['mtn', 'moov'],
    ...COMMON,
  },
];

async function seedCountryConfigs(): Promise<void> {
  for (const cfg of COUNTRY_CONFIGS) {
    await prisma.countryConfig.upsert({
      where: { countryCode: cfg.countryCode },
      update: cfg,
      create: cfg,
    });
    // eslint-disable-next-line no-console
    console.log(`  country_config ${cfg.countryCode} (${cfg.currencyCode}) ready.`);
  }
}

async function seedAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@kaya.local').toLowerCase();
  const phone = process.env.ADMIN_PHONE ?? '+233200000000';
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash(password, rounds);

  await prisma.user.upsert({
    where: { email },
    update: { role: Role.admin, isVerified: true, isActive: true },
    create: {
      email,
      phone,
      passwordHash,
      fullName: 'Platform Admin',
      role: Role.admin,
      countryCode: CountryCode.GHA,
      isVerified: true,
      isActive: true,
    },
  });
  // eslint-disable-next-line no-console
  console.log(`  admin user ${email} ready.`);
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Seeding reference data...');
  await seedCountryConfigs();
  await seedAdmin();
  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
