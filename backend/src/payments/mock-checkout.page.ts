/**
 * The mock gateway's hosted checkout page, served by this backend in
 * development (GET /payments/mock/checkout/:reference).
 *
 * A real Paystack/Kkiapay flow opens the provider's page in a system tab, the
 * user pays there, and the provider redirects back into the app. The keyless
 * mock has no provider -- so the backend plays the provider: this page shows
 * the amount, its buttons call the mock complete endpoint, and then it
 * redirects to the deep link the app registered at initialize. Without it the
 * "hosted checkout" was a URL that resolved nowhere and the payment flow could
 * only be demonstrated with curl.
 *
 * Plain string template on purpose: one dev page does not justify a template
 * engine, and keeping it dependency-free keeps it out of the production
 * bundle's way (the route 404s in production regardless).
 */

export interface MockCheckoutView {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  redirect?: string;
}

/**
 * Only forward the user to URLs that cannot execute in this page's origin.
 * The redirect comes from a query parameter, so treat it as hostile: an app
 * scheme (kayaclient://...) or http(s) is fine, javascript:/data:/anything
 * schemeless is not.
 */
export function safeRedirect(redirect: string | undefined): string | undefined {
  if (redirect === undefined || redirect === '') return undefined;
  const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(redirect);
  if (!match) return undefined;
  const scheme = match[1]!.toLowerCase();
  if (scheme === 'javascript' || scheme === 'data' || scheme === 'vbscript' || scheme === 'file') {
    return undefined;
  }
  return redirect;
}

/**
 * JSON.stringify alone is not safe inside a <script> block: a value containing
 * `</script>` closes the block and the rest becomes markup. Escaping angle
 * brackets as \u003c/\u003e keeps the JS meaning identical and the parser out
 * of reach.
 */
const jsString = (value: string | null): string =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderMockCheckoutPage(view: MockCheckoutView): string {
  const redirect = safeRedirect(view.redirect);
  const amount = `${view.amount.toFixed(view.currency === 'XOF' ? 0 : 2)} ${view.currency}`;
  const settled = view.status !== 'pending';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kaya — paiement de démonstration</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #F4F6FA; color: #10141C;
         display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  main { width: min(420px, calc(100vw - 32px)); background: #fff; border-radius: 20px;
         padding: 28px 24px; box-shadow: 0 12px 32px rgba(16, 20, 28, .10); }
  .tag { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
         color: #B45309; background: #FEF3C7; border-radius: 999px; padding: 4px 10px; display: inline-block; }
  h1 { font-size: 20px; margin: 14px 0 2px; }
  .amount { font-size: 36px; font-weight: 700; letter-spacing: -.02em; margin: 12px 0 2px; }
  .ref { font-size: 12px; color: #5A6472; word-break: break-all; }
  p { font-size: 14px; color: #5A6472; line-height: 1.5; }
  button { width: 100%; border: 0; border-radius: 999px; padding: 15px 16px; font-size: 16px;
           font-weight: 600; cursor: pointer; margin-top: 10px; }
  .pay { background: #1466FF; color: #fff; }
  .fail { background: transparent; color: #B3261E; }
  button:disabled { opacity: .5; cursor: default; }
  .done { display: none; text-align: center; font-weight: 600; margin-top: 16px; }
</style>
</head>
<body>
<main>
  <span class="tag">Démonstration — aucun argent réel</span>
  <h1>Paiement Kaya</h1>
  <div class="amount">${escapeHtml(amount)}</div>
  <div class="ref">Réf. ${escapeHtml(view.reference)}</div>
  <p>Cette page tient le rôle de l'opérateur de paiement pendant le développement.
     Choisissez le résultat à simuler.</p>
  <button class="pay" id="pay" ${settled ? 'disabled' : ''}>Payer ${escapeHtml(amount)}</button>
  <button class="fail" id="fail" ${settled ? 'disabled' : ''}>Simuler un échec</button>
  <p class="done" id="done">Terminé. Vous pouvez revenir dans l'application.</p>
</main>
<script>
  var reference = ${jsString(view.reference)};
  var redirect = ${jsString(redirect ?? null)};
  function finish(success) {
    document.getElementById('pay').disabled = true;
    document.getElementById('fail').disabled = true;
    fetch('/api/v1/payments/mock/complete/' + encodeURIComponent(reference) + '?success=' + success, { method: 'POST' })
      .then(function () {
        if (redirect) {
          // Real gateways append the reference to the callback (Paystack
          // does exactly this), and the app's return route needs it to verify.
          var sep = redirect.indexOf('?') >= 0 ? '&' : '?';
          window.location.replace(redirect + sep + 'reference=' + encodeURIComponent(reference));
        }
        else { document.getElementById('done').style.display = 'block'; }
      })
      .catch(function () {
        document.getElementById('pay').disabled = false;
        document.getElementById('fail').disabled = false;
      });
  }
  document.getElementById('pay').addEventListener('click', function () { finish(true); });
  document.getElementById('fail').addEventListener('click', function () { finish(false); });
</script>
</body>
</html>`;
}
