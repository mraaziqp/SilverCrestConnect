/**
 * Copying text to the clipboard, honestly.
 *
 * `navigator.clipboard.writeText` fails more often than it looks: it is absent
 * entirely outside a secure context, and it rejects when the document is not
 * focused or permission is refused. Called bare, the rejection surfaces as an
 * uncaught promise error and the caller carries on showing "Copied" — so the
 * applicant believes their reference is on the clipboard when nothing was
 * copied, and pastes nothing into the form that needs it.
 *
 * This resolves to whether the text actually reached the clipboard, so callers
 * can confirm only what really happened. It falls back to the deprecated
 * execCommand path, which still works in several places the modern API does
 * not.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Not focused, permission refused, or insecure context. Try the old way.
    }
  }

  if (typeof document === 'undefined') return false;

  try {
    const field = document.createElement('textarea');
    field.value = text;
    // Off-screen rather than hidden: a display:none field cannot be selected.
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-1000px';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}
