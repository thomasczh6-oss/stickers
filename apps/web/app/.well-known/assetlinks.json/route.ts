/** Android App Links: lets https://<site>/p/<id> open the app when it is installed. */
export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: process.env.ANDROID_PACKAGE ?? "ai.stickers.app", sha256_cert_fingerprints: fingerprints },
    },
  ]);
}
