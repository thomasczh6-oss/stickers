export type PickedPhoto = { base64: string; mimeType: "image/jpeg"; previewUrl: string };

/** Downscales a picked photo to at most 1024px and re-encodes it as JPEG, so uploads stay small. */
export async function preparePhoto(file: File): Promise<PickedPhoto> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg", previewUrl: dataUrl };
}
