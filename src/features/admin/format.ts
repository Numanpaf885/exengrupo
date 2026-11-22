/** Spanish date/time for the admin panel: "22 nov 2026, 14:05". Pure, unit-tested. */
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hm}`;
}

export function userStatusText(u: { status: string; code_expires_at: string; last_login: string }): string {
  if (u.status === 'active') return u.last_login ? `Activo · último acceso ${formatDateTime(u.last_login)}` : 'Activo';
  if (u.status === 'pending') return `Pendiente · el código caduca el ${formatDateTime(u.code_expires_at)}`;
  return 'Código caducado o agotado · dale un código nuevo';
}

export function inviteMessage(username: string, code: string, link: string): string {
  return `Tu cuenta de exengrupo:\nUsuario: ${username}\nCódigo de un solo uso: ${code}\nÁbrelo en ${link} y elige tu contraseña. Caduca en 72 horas.`;
}

/** Link in the invite: opens the app on Android (App Links), the website elsewhere. */
export const activationLink = (base: string, username: string): string =>
  `${base}/activar?u=${encodeURIComponent(username)}`;
