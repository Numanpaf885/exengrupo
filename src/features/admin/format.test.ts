import { describe, expect, it } from 'vitest';
import { formatDateTime, inviteMessage, userStatusText } from './format';

describe('admin formatting', () => {
  it('formats dates in Spanish', () => {
    expect(formatDateTime(new Date(2026, 10, 22, 9, 5).toISOString())).toBe('22 nov 2026, 09:05');
    expect(formatDateTime('')).toBe('');
  });

  it('describes each user status', () => {
    expect(userStatusText({ status: 'active', code_expires_at: '', last_login: '' })).toBe('Activo');
    expect(userStatusText({ status: 'pending', code_expires_at: new Date(2026, 10, 25, 12, 0).toISOString(), last_login: '' })).toBe(
      'Pendiente · el código caduca el 25 nov 2026, 12:00',
    );
    expect(userStatusText({ status: 'expired', code_expires_at: '', last_login: '' })).toMatch(/caducado/);
  });

  it('builds the invite message with user, code and link', () => {
    const m = inviteMessage('luis', 'ABCD-EFGH-JKMN', 'https://exengrupo.vercel.app/activar');
    expect(m).toContain('Usuario: luis');
    expect(m).toContain('ABCD-EFGH-JKMN');
    expect(m).toContain('https://exengrupo.vercel.app/activar');
  });
});
