import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { FadeIn } from '@/components/FadeIn';
import { ListRow } from '@/components/ListRow';
import { LoadingBar } from '@/components/LoadingBar';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import { type FileView, filesApi } from '@/features/files/api';
import { pickFile } from '@/features/files/pick';
import { typeLabel } from '@/features/files/picked';
import { dismissFileJob, startFileUpload, useFileJobs } from '@/features/files/uploads';
import { confirmAction } from '@/lib/confirm';
import { memo } from '@/lib/memo';
import { rule, space as grid } from '@/theme/tokens';

const MAX_FILES = 20;
const MAX_BYTES = 50 * 1024 * 1024;
const key = (id: string) => `files:${id}`;

const pagesLabel = (n: number | null, type: string) =>
  n === null || type === 'txt' || type === 'md' || type === 'docx' ? null : n === 1 ? '1 página' : `${n} páginas`;
const statusLabel = (s: string) => (s === 'listo' ? 'Listo' : s === 'error' ? 'Error' : 'Procesando…');

function FileRow({ file, onDelete, busy }: { file: FileView; onDelete: () => void; busy: boolean }) {
  const meta = [typeLabel(file.type), pagesLabel(file.pages, file.type), statusLabel(file.status)].filter(Boolean).join(' · ');
  return (
    <ListRow>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Text variant="label" numberOfLines={2}>
            {file.name}
          </Text>
          <Text>{meta}</Text>
          {file.status === 'error' && !!file.error && <Text>{file.error}</Text>}
          {file.status === 'procesando' && <LoadingBar label="Procesando…" />}
        </View>
        {file.can_delete && <Button kind="ghost" label="Borrar" onPress={onDelete} disabled={busy} />}
      </View>
    </ListRow>
  );
}

export default function Archivos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = String(id);
  const { token } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<FileView[] | null>(() => memo.get<FileView[]>(key(spaceId)) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const jobs = useFileJobs(spaceId);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await filesApi.list(token, spaceId);
    if (res.ok) {
      memo.set(key(spaceId), res.data.files);
      setFiles(res.data.files);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [token, spaceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    if (jobs.finished > 0) void load();
  }, [jobs.finished, load]);

  // Another member's file may still be processing: check again every few seconds.
  const processing = files?.some((f) => f.status === 'procesando') ?? false;
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [processing, load]);

  const add = async () => {
    if (!token) return;
    setError(null);
    if ((files?.length ?? 0) + jobs.list.length >= MAX_FILES) {
      return setError('Este espacio ya tiene 20 archivos. Borra alguno para añadir otro.');
    }
    let picked;
    try {
      picked = await pickFile();
    } catch {
      return setError('No se pudo abrir el archivo. Prueba de nuevo.');
    }
    if (!picked) return;
    if (picked.size > MAX_BYTES) return setError('El archivo pesa demasiado (máximo 50 MB).');
    startFileUpload(spaceId, picked, token);
  };

  const remove = async (f: FileView) => {
    if (!token) return;
    const ok = await confirmAction('Borrar archivo', `¿Borrar «${f.name}»? La IA dejará de usarlo.`, 'Borrar');
    if (!ok) return;
    setBusy(true);
    const res = await filesApi.remove(token, spaceId, f.file_id);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setFiles((prev) => prev?.filter((x) => x.file_id !== f.file_id) ?? null);
    void load();
  };

  const empty = files?.length === 0 && jobs.list.length === 0;

  return (
    <Screen
      onBack={() => (router.canGoBack() ? router.back() : router.replace(`/espacio/${spaceId}`))}
      footer={<Button label="Añadir archivo" onPress={() => void add()} flex trailing="+" />}
    >
      <View style={styles.head}>
        <Text variant="display">Archivos</Text>
        <Text>
          El libro o los apuntes del grupo. Al analizar una foto, la IA los usa como fuente principal. Nadie puede abrirlos ni
          descargarlos desde la app.
        </Text>
        <Text variant="label">PDF, Word, texto o imagen · hasta 50 MB y 500 páginas · máximo 20</Text>
      </View>

      <Notice text={error} />

      <View style={files?.length || jobs.list.length ? styles.list : undefined}>
        {jobs.list.map((j) => (
          <FadeIn key={j.id}>
            <ListRow>
              <Text variant="label" numberOfLines={2}>
                {j.name}
              </Text>
              {j.state === 'error' ? (
                <>
                  <Notice text={j.error} />
                  <Button kind="ghost" label="Descartar" onPress={() => dismissFileJob(j.id)} />
                </>
              ) : (
                <>
                  <Text>
                    {j.state === 'subiendo' ? 'Subiendo' : 'Procesando'}
                    {j.progress ? ` · ${j.progress}` : '…'}
                  </Text>
                  <LoadingBar label={j.state === 'subiendo' ? 'Subiendo…' : 'Procesando…'} />
                </>
              )}
            </ListRow>
          </FadeIn>
        ))}
        {files?.map((f, i) => (
          <FadeIn key={f.file_id} index={i}>
            <FileRow file={f} busy={busy} onDelete={() => void remove(f)} />
          </FadeIn>
        ))}
      </View>
      {files === null && !error && <LoadingBar label="Cargando…" />}
      {empty && (
        <FadeIn>
          <View style={styles.empty}>
            <Text variant="title">Aún no hay archivos.</Text>
            <Text>Añade el libro del curso o los apuntes del profesor para que las respuestas sigan vuestro temario.</Text>
          </View>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: grid(1) },
  list: { borderBottomWidth: rule.width, borderBottomColor: rule.color },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: grid(2) },
  grow: { flex: 1, gap: grid(1) },
  empty: { gap: grid(1), paddingVertical: grid(2) },
});
