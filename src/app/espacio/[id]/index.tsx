import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppState, BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { RoundUploadButton } from '@/components/RoundButton';
import { FadeIn } from '@/components/FadeIn';
import { Badge, Chip, initials } from '@/components/Badge';
import { LoadingBar } from '@/components/LoadingBar';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Section';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import { AnswerList } from '@/features/spaces/AnswerList';
import { type SpaceDetail, type SpaceSummary, spacesApi } from '@/features/spaces/api';
import { cachedPosts, cachedSpace, loadPosts, loadSpace, rememberPosts } from '@/features/spaces/cache';
import { upsertPost } from '@/features/spaces/feed';
import { pickPhoto } from '@/features/camera/pickPhoto';
import { dismissUpload, startUpload, useUploads } from '@/features/spaces/uploads';
import { compressPhoto } from '@/lib/photo/compress';
import { realtimeConfigured } from '@/lib/config';
import type { PostView } from '@/lib/photo/upload';
import { subscribeToSpace } from '@/lib/realtime';
import { enterFullscreen, exitFullscreen, onFullscreenExit } from '@/lib/fullscreen';
import { memo } from '@/lib/memo';
import { formatPostTime } from '@/lib/time';
import { space as grid } from '@/theme/tokens';

/** Full screen mode: only the answers (and a small time line to tell photos apart). */
function FocusPostItem({ post }: { post: PostView }) {
  return (
    <Card>
      <Text variant="caption" tone="secondary">
        {formatPostTime(post.created_at)}
      </Text>
      {post.status === 'processing' ? (
        <LoadingBar label="Analizando…" />
      ) : (
        <FadeIn key={post.status} offset={8}>
          {post.status === 'error' ? (
            <Text variant="headline" tone="accent">
              {post.answer || 'No se pudo analizar la foto. Prueba de nuevo.'}
            </Text>
          ) : (
            <AnswerList answer={post.answer} labels={post.labels ?? {}} />
          )}
        </FadeIn>
      )}
    </Card>
  );
}

function PostItem({ post }: { post: PostView }) {
  return (
    <Card>
      <View style={styles.meta}>
        <Badge text={initials(post.username)} round tone="neutral" />
        <View style={styles.grow}>
          <Text variant="label">{post.username}</Text>
          <Text variant="caption" tone="secondary">
            {formatPostTime(post.created_at)}
          </Text>
        </View>
        {post.status === 'processing' && <Chip label="Analizando" tone="neutral" />}
      </View>
      {post.status === 'processing' ? (
        <LoadingBar label="Analizando…" />
      ) : (
        // Keyed by status so the answer fades in when "Analizando…" turns into it.
        <FadeIn key={post.status} offset={8}>
          {post.status === 'error' ? (
            <Text variant="headline" tone="accent">
              {post.answer || 'No se pudo analizar la foto. Prueba de nuevo.'}
            </Text>
          ) : (
            <AnswerList answer={post.answer} labels={post.labels ?? {}} />
          )}
        </FadeIn>
      )}
    </Card>
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
  // Full screen mode: only the answers and the photo buttons. Remembered while the app is open.
  const focusKey = `focus:${spaceId}`;
  const [focus, setFocusState] = useState(() => memo.get<boolean>(focusKey) === true);
  const setFocus = useCallback(
    (on: boolean) => {
      memo.set(focusKey, on);
      setFocusState(on);
      if (on) enterFullscreen();
      else exitFullscreen();
    },
    [focusKey],
  );

  // Android back button (only while this screen is on top, not under the camera)
  // and the browser leaving full screen by itself: back to the normal view.
  useFocusEffect(
    useCallback(() => {
      if (!focus) return;
      const back = BackHandler.addEventListener('hardwareBackPress', () => {
        setFocus(false);
        return true;
      });
      return () => back.remove();
    }, [focus, setFocus]),
  );
  useEffect(() => (focus ? onFullscreenExit(() => setFocus(false)) : undefined), [focus, setFocus]);

  /** Send an existing photo (gallery / files) for answers, like one taken with the camera. */
  const uploadPhoto = async () => {
    if (!token) return;
    let photo;
    try {
      photo = await pickPhoto();
    } catch {
      return setError('No se pudo leer la foto. Prueba con otra.');
    }
    if (!photo) return;
    const picked = photo;
    startUpload(
      spaceId,
      async () => {
        try {
          return await compressPhoto(picked.uri, picked.width, picked.height);
        } finally {
          // Web: free the full-size image once the small JPEG exists.
          if (picked.uri.startsWith('blob:')) URL.revokeObjectURL(picked.uri);
        }
      },
      token,
    );
  };

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

  // A locked phone or hidden tab misses live messages: catch up when it comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

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

  if (notFound) {
    return (
      <Screen onBack={() => router.replace('/')}>
        <Notice text={error} />
        <Button label="Ir a mis espacios" kind="secondary" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const empty = posts?.length === 0 && uploads.list.length === 0;

  const photoButtons = (
    <>
      <Button label="Tomar foto" onPress={() => router.push(`/espacio/${spaceId}/camara`)} disabled={!space} flex large />
      <RoundUploadButton label="Subir foto" onPress={() => void uploadPhoto()} disabled={!space} />
    </>
  );

  const uploadCards = uploads.list.map((u) => (
    <FadeIn key={u.id}>
      <Card>
        <View style={styles.meta}>
          <Badge text="Tú" round />
          <View style={styles.grow}>
            <Text variant="label">Tu foto</Text>
            <Text variant="caption" tone="secondary">
              {u.state === 'error' ? 'No se envió' : u.state === 'preparing' ? 'Preparando…' : 'Enviando y analizando…'}
            </Text>
          </View>
        </View>
        {u.state === 'error' ? (
          <>
            <Notice text={u.error} />
            <Button label="Descartar" kind="secondary" onPress={() => dismissUpload(u.id)} />
          </>
        ) : (
          <LoadingBar label="Enviando y analizando…" />
        )}
      </Card>
    </FadeIn>
  ));

  if (focus) {
    return (
      <Screen onRefresh={() => void refresh()} refreshing={refreshing} footer={photoButtons}>
        <StatusBar style="light" hidden />
        {/* The only other control: a quiet way out (Android's back button works too). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salir de pantalla completa"
          onPress={() => setFocus(false)}
          hitSlop={12}
          style={({ pressed }) => [styles.exit, pressed && { opacity: 0.4 }]}
        >
          <Text variant="caption" tone="secondary">
            Salir
          </Text>
        </Pressable>
        <View style={styles.feed}>
          {uploadCards}
          {posts?.map((p, i) => (
            <FadeIn key={p.post_id} index={i}>
              <FocusPostItem post={p} />
            </FadeIn>
          ))}
        </View>
        {posts === null && !error && <LoadingBar label="Cargando…" />}
        {empty && <Text tone="secondary">Aún no hay respuestas.</Text>}
      </Screen>
    );
  }

  return (
    <Screen
      onBack={back}
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      headerRight={
        space && (
          <>
            <Button kind="ghost" label="Fotos" onPress={() => router.push(`/espacio/${spaceId}/fotos`)} />
            <Button kind="ghost" label="Archivos" onPress={() => router.push(`/espacio/${spaceId}/archivos`)} />
            <Button
              kind="ghost"
              label={`Miembros (${space.member_count})`}
              onPress={() => router.push(`/espacio/${spaceId}/miembros`)}
            />
          </>
        )
      }
      footer={photoButtons}
    >
      <View style={styles.titleBlock}>
        <Text variant="display" numberOfLines={3}>
          {space?.name ?? ' '}
        </Text>
        {space && (
          <View style={styles.codeRow}>
            <Button kind="secondary" small label="Pantalla completa" onPress={() => setFocus(true)} />
          </View>
        )}
        {space?.archived && (
          <Text variant="caption" tone="secondary">
            Espacio archivado: está en «Espacios archivados». Recupéralo en Miembros.
          </Text>
        )}
      </View>

      <Notice text={error} />
      {error && <Button label="Reintentar" kind="secondary" onPress={() => void load()} />}

      <View style={styles.feed}>
        {uploadCards}
        {posts?.map((p, i) => (
          <FadeIn key={p.post_id} index={i}>
            <PostItem post={p} />
          </FadeIn>
        ))}
      </View>
      {posts === null && !error && <LoadingBar label="Cargando…" />}
      {empty && (
        <FadeIn>
          <Card>
            <Text variant="headline">Aún no hay fotos</Text>
            <Text tone="secondary">Pulsa «Tomar foto» y encuadra las preguntas: las respuestas aparecen aquí para todo el grupo.</Text>
          </Card>
        </FadeIn>
      )}

      {!realtimeConfigured && (
        <View style={styles.more}>
          <Button kind="ghost" label="Actualizar" onPress={() => void refresh()} />
          {!realtimeConfigured && <Text tone="secondary">Las respuestas nuevas aparecen al pulsar Actualizar.</Text>}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: grid(1) },
  codeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: grid(1.5) },
  exit: { alignSelf: 'flex-end', paddingVertical: grid(0.5) },
  feed: { gap: grid(1.5) },
  meta: { flexDirection: 'row', alignItems: 'center', gap: grid(1.5) },
  grow: { flex: 1 },
  more: { marginTop: 'auto', alignItems: 'center' },
});
