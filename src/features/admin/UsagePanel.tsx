/** "Uso" tab: AI usage counted from the saved answers, plus OpenRouter credit use. */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { ListRow } from '@/components/ListRow';
import { LoadingBar } from '@/components/LoadingBar';
import { Notice } from '@/components/Notice';
import { Card, Section } from '@/components/Section';
import { Text } from '@/components/Text';
import { formatPostTime } from '@/lib/time';
import { colors, radius, space } from '@/theme/tokens';
import { adminApi, type UsageView, type UsageWindow } from './api';

const NAMES: Record<string, string> = { claude: 'Claude', gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
const WEEKDAY = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const WINDOWS: Array<[string, keyof UsageWindow]> = [
  ['24 h', 'day'],
  ['7 días', 'week'],
  ['Total', 'total'],
];

function Counts({ w }: { w: UsageWindow }) {
  return (
    <View style={styles.counts}>
      {WINDOWS.map(([label, key]) => (
        <View key={label} style={styles.count}>
          <Text variant="headline">{String(w[key])}</Text>
          <Text variant="caption" tone="secondary">
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Row({ label, w, hint }: { label: string; w: UsageWindow; hint?: string }) {
  return (
    <ListRow trailing={<Counts w={w} />}>
      <Text>{label}</Text>
      {hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
    </ListRow>
  );
}

/** Seven small bars, one per day. */
function Daily({ days }: { days: UsageView['daily'] }) {
  const max = Math.max(1, ...days.map((d) => d.photos));
  return (
    <Card>
      <Text variant="label">Fotos por día</Text>
      <View style={styles.chart} accessibilityLabel={days.map((d) => `${d.date}: ${d.photos}`).join(', ')}>
        {days.map((d) => (
          <View key={d.date} style={styles.barCol}>
            <Text variant="caption" tone="secondary">
              {String(d.photos)}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { height: `${(d.photos / max) * 100}%` }]} />
            </View>
            <Text variant="caption" tone="secondary">
              {WEEKDAY[new Date(`${d.date}T12:00:00Z`).getUTCDay()]}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function creditsText(c: NonNullable<UsageView['openrouter_credits']>): string {
  const used = `${c.usage.toFixed(2)} USD usados`;
  const limit = c.limit !== null ? ` de ${c.limit.toFixed(2)} USD` : '';
  return used + limit + (c.free_tier ? ' · plan gratuito' : '');
}

export function UsagePanel({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await adminApi.usage();
    if (res.ok) setUsage(res.data);
    else if (res.status === 401) onSessionEnded();
    else setError(res.error);
  }, [onSessionEnded]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!usage) return error ? <Notice text={error} /> : <LoadingBar label="Cargando…" />;

  const credits = usage.openrouter_credits;
  return (
    <View style={styles.wrap}>
      <Notice text={error} />
      <Section title="Fotos analizadas">
        <Row label="Fotos" w={usage.photos} />
        <Row label="Con archivos de referencia" w={usage.with_references} />
        <Row label="Errores" w={usage.errors} />
        <Row label="Límite de IA alcanzado" w={usage.quota} />
        <Row label="Foto ilegible" w={usage.unreadable} />
      </Section>

      <Daily days={usage.daily} />

      <Section
        title="Respuestas por IA"
        footer="Cuenta las fotos en las que cada IA dio respuestas, y cuántas veces falló y por qué. Claude responde siempre que tenga clave; la otra respuesta es de la siguiente IA disponible. Los límites exactos de Gemini, Groq y Claude solo se ven en la consola de cada proveedor."
      >
        {usage.providers.map((p) => (
          <Row
            key={p.id}
            label={NAMES[p.id] ?? p.id}
            w={p}
            hint={
              !usage.configured[p.id]
                ? 'Sin clave'
                : [
                    p.last_at ? `${p.model} · última ${formatPostTime(p.last_at)}` : 'Aún no ha respondido',
                    p.failed?.week ? `${p.failed.week} fallos en 7 días` : '',
                    p.last_error ? `último error: ${p.last_error}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
            }
          />
        ))}
        {credits && (
          <ListRow>
            <Text>Créditos de OpenRouter</Text>
            <Text variant="caption" tone="secondary">
              {creditsText(credits)}
            </Text>
          </ListRow>
        )}
      </Section>

      <Button label="Actualizar" kind="secondary" onPress={() => void load()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(3) },
  counts: { flexDirection: 'row', gap: space(2) },
  count: { alignItems: 'flex-end', minWidth: 40 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: space(1), height: 120 },
  barCol: { flex: 1, alignItems: 'center', gap: space(0.5), height: '100%' },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    backgroundColor: colors.fill,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  bar: { width: '100%', backgroundColor: colors.accent, borderRadius: radius.sm },
});
