// Converts the Flutter ARB files into plain i18next JSON.
// ARB metadata keys start with "@" and are dropped; ICU placeholders {name}
// are already i18next-compatible.
import { readFileSync, writeFileSync } from "node:fs";

const pairs = [
  ["legacy/flutter/kaya_core/lib/l10n/app_fr.arb", "packages/kaya-core/src/i18n/fr.json"],
  ["legacy/flutter/kaya_core/lib/l10n/app_en.arb", "packages/kaya-core/src/i18n/en.json"],
];

for (const [src, dest] of pairs) {
  const arb = JSON.parse(readFileSync(src, "utf8"));
  const out = {};
  for (const [key, value] of Object.entries(arb)) {
    if (key.startsWith("@")) continue;
    out[key] = value;
  }
  writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`${dest}: ${Object.keys(out).length} keys`);
}
