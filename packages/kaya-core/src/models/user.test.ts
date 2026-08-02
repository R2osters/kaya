import { isClient, isDriver, userCurrency, userSchema } from "./user";

const raw = {
  id: "u1",
  email: "ama@example.com",
  phone: "+233201234567",
  fullName: "Ama Owusu",
  role: "livreur",
  countryCode: "TGO",
  isVerified: true,
  ratingDriver: "4.80",
  balance: "1200.00",
  dailyDeliveries: "6",
  vehicleType: "moto",
};

describe("userSchema", () => {
  it("parses a driver, coercing Decimal strings", () => {
    const u = userSchema.parse(raw);
    expect(u.fullName).toBe("Ama Owusu");
    expect(u.ratingDriver).toBe(4.8);
    expect(u.balance).toBe(1200);
    expect(u.dailyDeliveries).toBe(6);
    expect(u.vehicleType).toBe("moto");
  });

  it("applies the documented defaults for absent fields", () => {
    const u = userSchema.parse({ id: "u2" });
    expect(u.role).toBe("client");
    expect(u.countryCode).toBe("GHA");
    expect(u.isActive).toBe(true);
    expect(u.isVerified).toBe(false);
    expect(u.isOnline).toBe(false);
    expect(u.ratingDriver).toBe(5);
    expect(u.ratingClient).toBe(5);
    expect(u.totalDeliveries).toBe(0);
    expect(u.balance).toBe(0);
    expect(u.vehicleType).toBeNull();
  });

  it("derives role predicates and currency", () => {
    const driver = userSchema.parse(raw);
    expect(isDriver(driver)).toBe(true);
    expect(isClient(driver)).toBe(false);
    expect(userCurrency(driver)).toBe("XOF");

    const both = userSchema.parse({ ...raw, role: "both", countryCode: "GHA" });
    expect(isDriver(both)).toBe(true);
    expect(isClient(both)).toBe(true);
    expect(userCurrency(both)).toBe("GHS");
  });
});
