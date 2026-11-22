import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { ListRow } from '@/components/ListRow';
import { Notice } from '@/components/Notice';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { space } from '@/theme/tokens';
import { adminApi, type ProviderView } from './api';

const SOURCE: Record<ProviderView['key_source'], string> = {
  admin: 'guardada aquí',
  vercel: 'en Vercel',
  none: '',
};
const MODEL_SOURCE: Record<ProviderView['model_source'], string> = {
  admin: 'guardado aquí',
  vercel: 'en Vercel',
  default: 'por defecto',
};

function ProviderCard({
  p,
  rank,
  onSaved,
  onSessionEnded,
}: {
  p: ProviderView;
  rank: number | null;
  onSaved: (providers: ProviderView[]) => void;
  onSessionEnded: () => void;
}) {
  const [key, setKey] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async <T,>(call: () => Promise<{ ok: boolean; status?: number; error?: string; data?: T }>) => {
    setBusy(true);
    setMessage(null);
    const res = await call();
    setBusy(false);
    if (!res.ok && res.status === 401) onSessionEnded();
    else if (!res.ok) setMessage(res.error ?? null);
    return res.ok ? (res.data as T) : null;
  };

  const save = async () => {
    const body: { key?: string; model?: string } = {};
    if (key.trim()) body.key = key.trim();
    if (model.trim()) body.model = model.trim();
    if (!body.key && !body.model) return setMessage('Escribe una clave o un modelo para guardar.');
    const data = await run(() => adminApi.saveKey(p.id, body));
    if (data) {
      setKey('');
      setModel('');
      setMessage('Guardado. Se usa desde ahora.');
      onSaved((data as { providers: ProviderView[] }).providers);
    }
  };

  const test = async () => {
    const data = await run(() => adminApi.testKey(p.id, { key: key.trim() || undefined, model: model.trim() || undefined }));
    if (data) {
      const r = data as { ok: boolean; message: string };
      setMessage(`${r.ok ? 'Funciona' : 'No funciona'}: ${r.message}`);
    }
  };

  const clear = async (what: 'key' | 'model') => {
    const data = await run(() => adminApi.saveKey(p.id, what === 'key' ? { key: '' } : { model: '' }));
    if (data) {
      setMessage(what === 'key' ? 'Clave guardada quitada.' : 'Modelo guardado quitado.');
      onSaved((data as { providers: ProviderView[] }).providers);
    }
  };

  return (
    <ListRow>
      <Text variant="title">{p.label}</Text>
      <Text>
        {p.key_set ? `Clave ${SOURCE[p.key_source]} ${p.key_hint}` : 'Sin clave'}
        {rank !== null ? ` · ${rank <= 2 ? `responde (n.º ${rank})` : `reserva (n.º ${rank})`}` : ''}
      </Text>
      <Text>
        Modelo: {p.model} ({MODEL_SOURCE[p.model_source]})
      </Text>
      <View style={styles.fields}>
        <TextField
          label={p.key_set ? 'Cambiar clave' : 'Clave'}
          value={key}
          onChangeText={setKey}
          secureTextEntry
        />
        <TextField
          label={`Cambiar modelo (opcional; por defecto ${p.model_default})`}
          value={model}
          onChangeText={setModel}
        />
      </View>
      <View style={styles.actions}>
        <Button label={busy ? 'Un momento…' : 'Guardar'} onPress={() => void save()} disabled={busy} />
        <Button label="Probar" kind="secondary" onPress={() => void test()} disabled={busy || (!p.key_set && !key.trim())} />
        {p.key_source === 'admin' && (
          <Button label="Quitar clave guardada" kind="secondary" onPress={() => void clear('key')} disabled={busy} />
        )}
        {p.model_source === 'admin' && (
          <Button label="Volver al modelo por defecto" kind="secondary" onPress={() => void clear('model')} disabled={busy} />
        )}
      </View>
      <Notice text={message} />
    </ListRow>
  );
}

export function KeysPanel({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [providers, setProviders] = useState<ProviderView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await adminApi.keys();
    if (!res.ok && res.status === 401) return onSessionEnded();
    if (!res.ok) return setError(res.error);
    setProviders(res.data.providers);
    setError(null);
  }, [onSessionEnded]);

  useEffect(() => {
    void load();
  }, [load]);

  // Rank among providers that have a key: 1 and 2 answer each photo, the rest step in when one fails.
  const ranks = new Map<string, number>();
  providers?.filter((p) => p.key_set).forEach((p, i) => ranks.set(p.id, i + 1));

  return (
    <View style={styles.block}>
      <Text>
        Orden de preferencia: Claude, Gemini, Groq, OpenRouter. Responden las 2 primeras que tengan clave; si una falla
        o llega a su límite, entra la siguiente. «Probar» no gasta tokens.
      </Text>
      <Notice text={error} />
      {providers === null && !error && <Text>Cargando…</Text>}
      <View>
        {providers?.map((p) => (
          <ProviderCard
            key={p.id}
            p={p}
            rank={ranks.get(p.id) ?? null}
            onSaved={setProviders}
            onSessionEnded={onSessionEnded}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space(2) },
  fields: { gap: space(2), marginTop: space(1) },
  actions: { gap: space(1), marginTop: space(1) },
});
