import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { FadeIn } from '@/components/FadeIn';
import { ListRow } from '@/components/ListRow';
import { LoadingBar } from '@/components/LoadingBar';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import { type SpaceDetail, type SpaceSummary, spacesApi } from '@/features/spaces/api';
import { cachedPosts, cachedSpace, loadPosts, loadSpace, rememberPosts } from '@/features/spaces/cache';
import { upsertPost } from '@/features/spaces/feed';
import { dismissUpload, useUploads } from '@/features/spaces/uploads';
import { displayAnswer } from '@/lib/answerDisplay';
import { realtimeConfigured, WEB_URL } from '@/lib/config';
import type { PostView } from '@/lib/photo/upload';
import { subscribeToSpace } from '@/lib/realtime';
import { formatPostTime } from '@/lib/time';
import { rule, space as grid } from '@/theme/tokens';

function PostItem({ post }: { post: PostView }) {
  return (
    <ListRow>
      <Text>
        {post.username} · {formatPostTime(post.created_at)}
      </Text>
      {post.status === 'processing' ? (
        <View style={styles.pending}>
          <Text variant="title">Analizando…</Text>
          <LoadingBar label="Analizando…" />
        </View>
      ) : (
        // Keyed by status so the answer fades in when "Analizando…" turns into it.
        <FadeIn key={post.status} offset={8}>
          {post.status === 'error' ? (
            <Text variant="title">{post.answer || 'No se pudo analizar la foto. Prueba de nuevo.'}</Text>
          ) : (
            <Text variant="answer" selectable style={keepSpaces}>
              {displayAnswer(post.answer)}
            </Text>
          )}
        </FadeIn>
      )}
    </ListRow>
  );
}

export default function Espacio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = String(id);
  const { token } = useAuth();
  const router = useRouter();
  // Open instantly with what the list (or the last visit) already knows.
  const [space, setSpace] = useState<SpaceDetail | SpaceSummary | null>(() => cachedSpace(spaceId) ?? null);
  const [posts, setPostsState] = useState<PostView[] | null>(() => cachedPosts(spaceId) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const uploads = useUploads(spaceId);

  const setPosts = useCallback(
    (update: (prev: PostView[] | null) => PostView[]) =>
      setPostsState((prev) => {
        const next = update(prev);
        rememberPosts(spaceId, next);
        return next;
      }),
    [spaceId],
  );

  const load = useCallback(async () => {
    if (!token) return;
    const [s, p] = await Promise.all([loadSpace(token, spaceId), loadPosts(token, spaceId)]);
    if (!s.ok) {
      setError(s.error);
      setNotFound(s.status === 404);
      return;
    }
    setSpace(s.data.space);
    if (p.ok) {
      setPostsState(p.data.posts);
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
  const channelId = space && 'channel_id' in space ? space.channel_id : undefined;
  useEffect(() => {
    if (!channelId || !token) return;
    return subscribeToSpace(channelId, (postId) => {
      void spacesApi.post(token, spaceId, postId).then((res) => {
        if (res.ok) setPosts((prev) => upsertPost(prev ?? [], res.data.post));
      });
    });
  }, [channelId, token, spaceId, setPosts]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

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

  const empty = posts?.length === 0 && uploads.list.length === 0;

  return (
    <Screen
      onBack={back}
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      headerRight={
        space && (
          <>
            <Button kind="ghost" label="Invitar" onPress={share} />
            <Button
              kind="ghost"
              label={`Miembros (${space.member_count})`}
              onPress={() => router.push(`/espacio/${spaceId}/miembros`)}
            />
          </>
        )
      }
      footer={
        <Button
          label="Tomar foto"
          onPress={() => router.push(`/espacio/${spaceId}/camara`)}
          disabled={!space}
          flex
          trailing="→"
        />
      }
    >
      <View>
        <Text variant="display" numberOfLines={3}>
          {space?.name ?? ' '}
        </Text>
        {space && (
          <Text variant="label" selectable>
            Código {space.join_code}
          </Text>
        )}
      </View>

      <Notice text={error} />
      {error && <Button label="Reintentar" kind="secondary" onPress={() => void load()} />}

      <View style={posts?.length || uploads.list.length ? styles.feed : undefined}>
        {uploads.list.map((u) => (
          <FadeIn key={u.id}>
            <ListRow>
              <Text>Tu foto</Text>
              {u.state === 'error' ? (
                <>
                  <Notice text={u.error} />
                  <Button label="Descartar" kind="secondary" onPress={() => dismissUpload(u.id)} />
                </>
              ) : (
                <View style={styles.pending}>
                  <Text variant="title">{u.state === 'preparing' ? 'Preparando…' : 'Enviando y analizando…'}</Text>
                  <LoadingBar label="Enviando y analizando…" />
                </View>
              )}
            </ListRow>
          </FadeIn>
        ))}
        {posts?.map((p, i) => (
          <FadeIn key={p.post_id} index={i}>
            <PostItem post={p} />
          </FadeIn>
        ))}
      </View>
      {posts === null && !error && <LoadingBar label="Cargando…" />}
      {empty && (
        <FadeIn>
          <View style={styles.empty}>
            <Text variant="title">Aún no hay fotos.</Text>
            <Text>Pulsa «Tomar foto» y encuadra las preguntas: las respuestas aparecen aquí para todo el grupo.</Text>
          </View>
        </FadeIn>
      )}

      {(Platform.OS === 'web' || !realtimeConfigured) && (
        <View style={styles.more}>
          <Button kind="ghost" label="Actualizar" onPress={() => void refresh()} />
          {!realtimeConfigured && <Text>Las respuestas nuevas aparecen al pulsar Actualizar.</Text>}
        </View>
      )}
    </Screen>
  );
}

// Browsers collapse the double spaces between answers unless told not to.
const keepSpaces = Platform.OS === 'web' ? ({ whiteSpace: 'pre-wrap' } as object) : undefined;

const styles = StyleSheet.create({
  feed: { borderBottomWidth: rule.width, borderBottomColor: rule.color },
  pending: { gap: grid(1) },
  empty: { gap: grid(1), paddingVertical: grid(2) },
  more: { marginTop: 'auto' },
});
