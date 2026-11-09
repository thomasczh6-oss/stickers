package expo.modules.whatsappstickers

import android.content.Context
import org.json.JSONObject
import java.io.File

/** One sticker as written by the JS side in contents.json. */
data class StickerEntry(val imageFile: String, val emojis: List<String>, val accessibilityText: String)

/** One pack folder: files/sticker_packs/<identifier>/contents.json plus its images. */
data class StickerPackEntry(
  val identifier: String,
  val name: String,
  val publisher: String,
  val trayImageFile: String,
  val imageDataVersion: String,
  val avoidCache: Boolean,
  val animated: Boolean,
  val publisherEmail: String,
  val publisherWebsite: String,
  val privacyPolicyWebsite: String,
  val licenseAgreementWebsite: String,
  val stickers: List<StickerEntry>,
)

object StickerPackFiles {
  const val CONTENTS = "contents.json"

  fun root(context: Context): File = File(context.filesDir, "sticker_packs")

  fun authority(context: Context): String = "${context.packageName}.stickercontentprovider"

  /** A file inside a pack folder, or null when the names try to leave it. */
  fun file(context: Context, identifier: String, name: String): File? {
    if (!isSafe(identifier) || !isSafe(name)) return null
    val f = File(File(root(context), identifier), name)
    return if (f.isFile) f else null
  }

  fun read(context: Context, identifier: String): StickerPackEntry? {
    if (!isSafe(identifier)) return null
    val json = File(File(root(context), identifier), CONTENTS)
    if (!json.isFile) return null
    return runCatching { parse(JSONObject(json.readText())) }.getOrNull()
  }

  fun readAll(context: Context): List<StickerPackEntry> =
    root(context).listFiles()?.filter { it.isDirectory }?.mapNotNull { read(context, it.name) } ?: emptyList()

  private fun isSafe(name: String) = name.isNotEmpty() && !name.contains('/') && !name.contains("..")

  private fun parse(o: JSONObject): StickerPackEntry {
    val arr = o.getJSONArray("stickers")
    val stickers = (0 until arr.length()).map { i ->
      val s = arr.getJSONObject(i)
      val emojis = s.optJSONArray("emojis")
      StickerEntry(
        imageFile = s.getString("image_file"),
        emojis = if (emojis == null) emptyList() else (0 until emojis.length()).map { emojis.getString(it) },
        accessibilityText = s.optString("accessibility_text", ""),
      )
    }
    return StickerPackEntry(
      identifier = o.getString("identifier"),
      name = o.getString("name"),
      publisher = o.getString("publisher"),
      trayImageFile = o.getString("tray_image_file"),
      imageDataVersion = o.optString("image_data_version", "1"),
      avoidCache = o.optBoolean("avoid_cache", false),
      animated = o.optBoolean("animated_sticker_pack", false),
      publisherEmail = o.optString("publisher_email", ""),
      publisherWebsite = o.optString("publisher_website", ""),
      privacyPolicyWebsite = o.optString("privacy_policy_website", ""),
      licenseAgreementWebsite = o.optString("license_agreement_website", ""),
      stickers = stickers,
    )
  }
}
