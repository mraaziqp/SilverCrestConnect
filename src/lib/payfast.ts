/**
 * Client-side hand-off to PayFast.
 *
 * PayFast's custom integration expects a form POST, not a redirect with query
 * parameters, so we build a hidden form from the server-signed field set and
 * submit it. The signature is computed server-side; nothing here can alter the
 * amount without invalidating it.
 */

export interface PayFastHandoff {
  processUrl: string;
  fields: Record<string, string>;
}

export function redirectToPayFast({ processUrl, fields }: PayFastHandoff): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = processUrl;
  form.style.display = 'none';
  // Leaving the referrer off keeps our internal URLs out of PayFast's logs.
  form.rel = 'noreferrer';

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
