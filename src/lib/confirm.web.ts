/** Web: the browser's own confirm dialog. */
export async function confirmAction(title: string, message: string, _confirmLabel: string): Promise<boolean> {
  return window.confirm(`${title}\n\n${message}`);
}
