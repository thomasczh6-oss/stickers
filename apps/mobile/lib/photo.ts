import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export type PickedPhoto = { uri: string; base64: string };

/** Square crop from the photo library, then at most 1024px as JPEG to keep the upload small. */
export async function pickPhoto(): Promise<PickedPhoto | undefined> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = res.canceled ? undefined : res.assets[0];
  if (!asset) return undefined;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1024 || asset.height > 1024) ctx.resize(asset.width >= asset.height ? { width: 1024 } : { height: 1024 });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.88, base64: true });
  return saved.base64 ? { uri: saved.uri, base64: saved.base64 } : undefined;
}
