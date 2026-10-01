import { renderMockCheckoutPage, safeRedirect } from './mock-checkout.page';

describe('safeRedirect', () => {
  it('allows the app scheme deep link the client actually sends', () => {
    expect(safeRedirect('kayaclient://payment/return')).toBe('kayaclient://payment/return');
  });

  it('allows http(s), which dev-client return URLs use', () => {
    expect(safeRedirect('https://example.com/done')).toBe('https://example.com/done');
  });

  ['javascript://alert(1)', 'data://text/html,x', 'vbscript://x', 'file:///etc/passwd'].forEach(
    (url) => {
      it(`rejects ${url.split(':')[0]}: URLs`, () => {
        expect(safeRedirect(url)).toBeUndefined();
      });
    },
  );

  it('rejects schemeless values -- a bare path would resolve inside this origin', () => {
    expect(safeRedirect('/somewhere')).toBeUndefined();
    expect(safeRedirect('javascript:alert(1)')).toBeUndefined();
  });

  it('passes emptiness through as undefined', () => {
    expect(safeRedirect(undefined)).toBeUndefined();
    expect(safeRedirect('')).toBeUndefined();
  });
});

describe('renderMockCheckoutPage', () => {
  const view = {
    reference: 'KAYA-1-abc',
    amount: 33.66,
    currency: 'GHS',
    status: 'pending',
  };

  it('renders the amount in the currency own unit', () => {
    expect(renderMockCheckoutPage(view)).toContain('33.66 GHS');
    expect(renderMockCheckoutPage({ ...view, amount: 2000, currency: 'XOF' })).toContain(
      '2000 XOF',
    );
  });

  it('escapes the reference -- it is path input, not trusted markup', () => {
    const html = renderMockCheckoutPage({ ...view, reference: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('embeds only a vetted redirect', () => {
    const hostile = renderMockCheckoutPage({ ...view, redirect: 'javascript://alert(1)' });
    expect(hostile).toContain('var redirect = null');

    const fine = renderMockCheckoutPage({ ...view, redirect: 'kayaclient://payment/return' });
    expect(fine).toContain('"kayaclient://payment/return"');
  });

  it('disables the buttons once the payment is settled', () => {
    const settled = renderMockCheckoutPage({ ...view, status: 'completed' });
    expect(settled).toContain('id="pay" disabled');
  });
});
