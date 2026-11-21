import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { ListRow } from '@/components/ListRow';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import { type SpaceDetail, spacesApi } from '@/features/spaces/api';
import { upsertPost } from '@/features/spaces/feed';
import { dismissUpload, useUploads } from '@/features/spaces/uploads';
import { displayAnswer } from '@/lib/answerDisplay';
import { realtimeConfigured, WEB_URL } from '@/lib/config';
import type { PostView } from '@/lib/photo/upload';
import { subscribeToSpace } from '@/lib/realtime';
import { formatPostTime } from '@/lib/time';
import { space as grid } from '@/theme/tokens';

function PostItem({ post }: { post: PostView }) {
  const processing = post.status === 'processing';
  return (
    <ListRow>
      <Text>
        {post.username} · {formatPostTime(post.created_at)}
      </Text>
      {processing ? (
        <Text variant="title">Analizando…</Text>
      ) : post.status === 'error' ? (
        <Text variant="title">{post.answer || 'No se pudo analizar la foto. Prueba de nuevo.'}</Text>
      ) : (
        <Text variant="answer" selectable style={keepSpaces}>
          {displayAnswer(post.answer)}
        </Text>
      )}
    </ListRow>
  );
}

export default function Espacio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = String(id);
  const { token } = useAuth();
  const router = useRouter();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const uploads = useUploads(spaceId);

  const load = useCallback(async () => {
    if (!token) return;
    const [s, p] = await Promise.all([spacesApi.get(token, spaceId), spacesApi.posts(token, spaceId)]);
    if (!s.ok) {
      setError(s.error);
      setNotFound(s.status === 404);
      return;
    }
    setSpace(s.data.space);
    if (p.ok) {
      setPosts(p.data.posts);
      setError(null);
    } else {
      setError(p.error);
    }
  }, [token, spaceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Reload when one of my uploads finishes.
  useEffect(() => {
    if (uploads.finished > 0) void load();
  }, [uploads.finished, load]);

  // Live: the server broadcasts only { post_id }; fetch that post with my session.
  const channelId = space?.channel_id;
  useEffect(() => {
    if (!channelId || !token) return;
    return subscribeToSpace(channelId, (postId) => {
      void spacesApi.post(token, spaceId, postId).then((res) => {
        if (res.ok) setPosts((prev) => upsertPost(prev ?? [], res.data.post));
      });
    });
  }, [channelId, token, spaceId]);

  const share = () => {
    if (!space) return;
    const link = `${WEB_URL}/unirse/${space.join_code}`;
    void Share.share({
      message: `Únete a "${space.name}" en exengrupo. Código: ${space.join_code} — ${link}`,
    }).catch(() => undefined);
  };

  if (notFound) {
    return (
      <Screen onBack={() => router.replace('/')}>
        <Notice text={error} />
        <Button label="Ir a mis espacios" kind="secondary" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <Text variant="display">{space?.name ?? ' '}</Text>
      <Button label="Tomar foto" onPress={() => router.push(`/espacio/${spaceId}/camara`)} disabled={!space} />

      <Notice text={error} />
      {error && <Button label="Reintentar" kind="secondary" onPress={() => void load()} />}

      <View>
        {uploads.list.map((u) => (
          <ListRow key={u.id}>
            <Text>Tu foto</Text>
            {u.state === 'sending' ? (
              <Text variant="title">Enviando y analizando…</Text>
            ) : (
              <>
                <Notice text={u.error} />
                <Button label="Descartar" kind="secondary" onPress={() => dismissUpload(u.id)} />
              </>
            )}
          </ListRow>
        ))}
        {posts?.map((p) => <PostItem key={p.post_id} post={p} />)}
        {posts === null && !error && <Text>Cargando…</Text>}
        {posts?.length === 0 && uploads.list.length === 0 && (
          <Text>Aún no hay fotos. Toma la primera: las respuestas aparecen aquí para todo el grupo.</Text>
        )}
      </View>

      {space && (
        <View style={styles.block}>
          <ListRow>
            <Text variant="label">Código para unirse</Text>
            <Text variant="title" selectable>
              {space.join_code}
            </Text>
          </ListRow>
          <Button label="Compartir invitación" kind="secondary" onPress={share} />
          <Button
            label={`Miembros (${space.member_count})`}
            kind="secondary"
            onPress={() => router.push(`/espacio/${spaceId}/miembros`)}
          />
          <Button label="Actualizar" kind="secondary" onPress={() => void load()} />
          {!realtimeConfigured && <Text>Las respuestas nuevas aparecen al pulsar Actualizar.</Text>}
        </View>
      )}
    </Screen>
  );
}

// Browsers collapse the double spaces between answers unless told not to.
const keepSpaces = Platform.OS === 'web' ? ({ whiteSpace: 'pre-wrap' } as object) : undefined;

const styles = StyleSheet.create({ block: { gap: grid(2) } });
