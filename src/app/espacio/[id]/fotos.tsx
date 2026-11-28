/**
 * Fotos: every photo sent to the space in the last 7 days (R2 deletes them
 * after that), newest first, in a two-column grid. Tapping one opens it full
 * screen with who sent it, when, and its answers.
 */
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, hovered } from '@/components/Button';
import { FadeIn } from '@/components/FadeIn';
import { LoadingBar } from '@/components/LoadingBar';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Section';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import { type PhotoView, spacesApi } from '@/features/spaces/api';
import { AnswerList } from '@/features/spaces/AnswerList';
import { apiUrl } from '@/lib/api';
import { memo } from '@/lib/memo';
import { formatPostTime } from '@/lib/time';
import { colors, radius, space as grid } from '@/theme/tokens';

const key = (id: string) => `photos:${id}`;

function PhotoViewer({ photo, onClose }: { photo: PhotoView; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.viewer, { paddingTop: insets.top }]}>
        <View style={styles.viewerBar}>
          <View style={styles.grow}>
            <Text variant="label">{photo.username}</Text>
            <Text variant="caption" tone="secondary">
              {formatPostTime(photo.created_at)}
            </Text>
          </View>
          <Button kind="ghost" label="Cerrar" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={[styles.viewerBody, { paddingBottom: insets.bottom + grid(3) }]}>
          <Image
            source={{ uri: apiUrl(photo.url) }}
            style={[styles.full, { height: Math.round(height * 0.62) }]}
            resizeMode="contain"
            accessibilityLabel={`Foto de ${photo.username}`}
          />
          {photo.status === 'done' ? (
            <Card>
              <AnswerList answer={photo.answer} labels={photo.labels ?? {}} />
            </Card>
          ) : photo.status === 'error' ? (
            <Notice text={photo.answer || 'No se pudo analizar la foto.'} />
          ) : (
            <LoadingBar label="Analizando…" />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function Fotos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = String(id);
  const { token } = useAuth();
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoView[] | null>(() => memo.get<PhotoView[]>(key(spaceId)) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<PhotoView | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await spacesApi.photos(token, spaceId);
    if (res.ok) {
      memo.set(key(spaceId), res.data.photos);
      setPhotos(res.data.photos);
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

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen onBack={() => router.back()} onRefresh={() => void refresh()} refreshing={refreshing}>
      <Text variant="display">Fotos</Text>
      <Notice text={error} />
      {photos === null && !error && <LoadingBar label="Cargando…" />}
      {photos?.length === 0 && (
        <Card>
          <Text variant="headline">Aún no hay fotos</Text>
          <Text tone="secondary">Las fotos que envíe el grupo aparecen aquí durante 7 días.</Text>
        </Card>
      )}
      {!!photos?.length && (
        <>
          <View style={styles.grid}>
            {photos.map((p, i) => (
              <FadeIn key={p.post_id} index={i} style={styles.cell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Foto de ${p.username}, ${formatPostTime(p.created_at)}`}
                  onPress={() => setOpen(p)}
                  style={(state) => [styles.tile, (state.pressed || hovered(state)) && styles.tilePressed]}
                >
                  <Image source={{ uri: apiUrl(p.url) }} style={styles.thumb} resizeMode="cover" />
                  <View style={styles.caption}>
                    <Text variant="caption" numberOfLines={1}>
                      {p.username}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {formatPostTime(p.created_at)}
                    </Text>
                  </View>
                </Pressable>
              </FadeIn>
            ))}
          </View>
          <Text variant="caption" tone="secondary" style={styles.note}>
            Las fotos se borran solas a los 7 días.
          </Text>
        </>
      )}
      {open && <PhotoViewer photo={open} onClose={() => setOpen(null)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: grid(1.5) },
  cell: { width: '48.5%' },
  tile: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  tilePressed: { opacity: 0.8 },
  thumb: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.fill },
  caption: { paddingHorizontal: grid(1.5), paddingVertical: grid(1) },
  note: { textAlign: 'center' },
  viewer: { flex: 1, backgroundColor: colors.black },
  viewerBar: { flexDirection: 'row', alignItems: 'center', gap: grid(1.5), paddingHorizontal: grid(2), minHeight: 52 },
  viewerBody: { paddingHorizontal: grid(2), gap: grid(2) },
  full: { width: '100%', backgroundColor: colors.black },
  grow: { flex: 1 },
});
