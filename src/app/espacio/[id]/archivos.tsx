import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Badge, Chip } from '@/components/Badge';
import { FadeIn } from '@/components/FadeIn';
import { ListRow } from '@/components/ListRow';
import { LoadingBar } from '@/components/LoadingBar';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Card, Section } from '@/components/Section';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import { type FileView, filesApi } from '@/features/files/api';
import { pickFile } from '@/features/files/pick';
import { typeLabel } from '@/features/files/picked';
import { dismissFileJob, startFileUpload, useFileJobs } from '@/features/files/uploads';
import { confirmAction } from '@/lib/confirm';
import { memo } from '@/lib/memo';
import { space as grid } from '@/theme/tokens';

const MAX_FILES = 20;
const MAX_BYTES = 50 * 1024 * 1024;
const key = (id: string) => `files:${id}`;

const pagesLabel = (n: number | null, type: string) =>
  n === null || type === 'txt' || type === 'md' || type === 'docx' ? null : n === 1 ? '1 página' : `${n} páginas`;

const statusChip = (s: string) =>
  s === 'listo' ? <Chip label="Listo" tone="success" /> : s === 'error' ? <Chip label="Error" tone="danger" /> : <Chip label="Procesando" tone="neutral" />;

const badgeText = (type: string) => (type === 'jpg' || type === 'png' ? 'IMG' : type === 'docx' ? 'DOC' : type.toUpperCase());

function FileRow({ file, onDelete, busy }: { file: FileView; onDelete: () => void; busy: boolean }) {
  const meta = [typeLabel(file.type), pagesLabel(file.pages, file.type), `subido por ${file.uploader}`].filter(Boolean).join(' · ');
  return (
    <ListRow leading={<Badge text={badgeText(file.type)} tone={file.status === 'listo' ? 'accent' : 'neutral'} />}>
      <Text variant="headline" numberOfLines={2}>
        {file.name}
      </Text>
      <Text variant="caption" tone="secondary">
        {meta}
      </Text>
      {file.status === 'error' && !!file.error && (
        <Text variant="caption" tone="accent">
          {file.error}
        </Text>
      )}
      {file.status === 'procesando' && <LoadingBar label="Procesando…" />}
      <View style={styles.actions}>
        {statusChip(file.status)}
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
      footer={<Button label="Añadir archivo" onPress={() => void add()} flex />}
    >
      <View style={styles.head}>
        <Text variant="display">Archivos</Text>
        <Text tone="secondary">
          El libro o los apuntes del grupo. Al analizar una foto, la IA los usa como fuente principal.
        </Text>
      </View>

      <Notice text={error} />

      {(jobs.list.length > 0 || !!files?.length) && (
        <Section
          title={files ? `${files.length} de ${MAX_FILES} archivos` : undefined}
          footer="Nadie puede abrir ni descargar estos archivos desde la app: solo los lee la IA."
        >
          {jobs.list.map((j) => (
            <FadeIn key={j.id}>
              <ListRow leading={<Badge text="↑" tone="neutral" />}>
                <Text variant="headline" numberOfLines={2}>
                  {j.name}
                </Text>
                {j.state === 'error' ? (
                  <>
                    <Text variant="caption" tone="accent">
                      {j.error}
                    </Text>
                    <Button kind="ghost" label="Descartar" onPress={() => dismissFileJob(j.id)} />
                  </>
                ) : (
                  <>
                    <Text variant="caption" tone="secondary">
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
        </Section>
      )}
      {files === null && !error && <LoadingBar label="Cargando…" />}
      {empty && (
        <FadeIn>
          <Card>
            <Text variant="headline">Aún no hay archivos</Text>
            <Text tone="secondary">
              Añade el libro del curso o los apuntes del profesor (PDF, Word, texto o imagen, hasta 50 MB y 500 páginas) para que
              las respuestas sigan vuestro temario.
            </Text>
          </Card>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: grid(1) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: grid(2), marginTop: grid(0.5) },
});
