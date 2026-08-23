/**
 * Thin fetch wrapper.
 *
 * Every API call funnels through here so error handling is uniform: a non-2xx
 * response becomes a thrown ApiRequestError carrying the server's message and
 * any per-field validation errors, rather than a silent undefined.
 */

export class ApiRequestError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  /** Bearer token for the admin endpoints. */
  token?: string;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiRequestError('Could not reach the server. Check your connection and try again.', 0);
  }

  // An HTML error page would blow up .json(), so branch on content type.
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new ApiRequestError(
      payload?.error ?? `Request failed (${response.status}).`,
      response.status,
      payload?.fieldErrors,
    );
  }

  return payload as T;
}

/**
 * Formats rands as R350 / R1 234.50.
 *
 * Deliberately not Intl: the en-ZA locale uses a comma as the decimal
 * separator (R350,00) while PayFast's own checkout shows periods (R350.00).
 * Mixing the two across the hand-off looks like a bug to the payer, so the
 * whole site follows PayFast — space for thousands, period for decimals.
 */
export function formatZAR(amount: number, withDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const negative = safe < 0;
  const value = Math.abs(safe);

  const fixed = withDecimals ? value.toFixed(2) : Math.round(value).toString();
  const [whole, fraction] = fixed.split('.');

  // Group thousands with a narrow gap, e.g. 1234567 -> "1 234 567".
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return `${negative ? '-' : ''}R${grouped}${fraction ? `.${fraction}` : ''}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
