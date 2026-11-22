/** Android: pick an existing photo from the gallery (to send it for answers). */
import * as ImagePicker from 'expo-image-picker';

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

export async function pickPhoto(): Promise<PickedPhoto | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width, height: a.height };
}
