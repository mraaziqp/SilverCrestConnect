/**
 * Fills placeholders in admin-editable copy.
 *
 * Editable text needs to name the cause without the organiser having to retype
 * it everywhere — rename the drive once in settings and every sentence that
 * mentions it follows. `{cause}` is the only token, deliberately: more would
 * turn a text box into a templating language nobody asked for.
 */
export function fillCopy(template: string, values: { cause: string }): string {
  return (template ?? '').replace(/\{cause\}/g, values.cause);
}
