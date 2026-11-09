package expo.modules.whatsappstickers

import android.content.ContentProvider
import android.content.ContentValues
import android.content.res.AssetFileDescriptor
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor

/**
 * The provider WhatsApp queries after the ENABLE_STICKER_PACK intent. URIs and column names
 * follow WhatsApp's official sample app (github.com/WhatsApp/stickers):
 *
 *   content://<authority>/metadata                      all packs
 *   content://<authority>/metadata/<id>                 one pack
 *   content://<authority>/stickers/<id>                 stickers of a pack
 *   content://<authority>/stickers_asset/<id>/<file>    a sticker or tray image
 */
class StickerContentProvider : ContentProvider() {
  override fun onCreate(): Boolean = true

  override fun query(uri: Uri, projection: Array<String>?, selection: String?, selectionArgs: Array<String>?, sortOrder: String?): Cursor? {
    val ctx = context ?: return null
    checkAuthority(uri)
    val segments = uri.pathSegments
    return when {
      segments.size == 1 && segments[0] == METADATA -> packCursor(StickerPackFiles.readAll(ctx))
      segments.size == 2 && segments[0] == METADATA -> packCursor(listOfNotNull(StickerPackFiles.read(ctx, segments[1])))
      segments.size == 2 && segments[0] == STICKERS -> stickerCursor(StickerPackFiles.read(ctx, segments[1]))
      else -> throw IllegalArgumentException("Unknown URI: $uri")
    }.also { it.setNotificationUri(ctx.contentResolver, uri) }
  }

  override fun openAssetFile(uri: Uri, mode: String): AssetFileDescriptor? {
    val ctx = context ?: return null
    checkAuthority(uri)
    val segments = uri.pathSegments
    require(segments.size == 3 && segments[0] == STICKERS_ASSET) { "Unknown URI: $uri" }
    val file = StickerPackFiles.file(ctx, segments[1], segments[2]) ?: return null
    return AssetFileDescriptor(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY), 0, file.length())
  }

  override fun getType(uri: Uri): String? {
    val authority = uri.authority ?: return null
    val segments = uri.pathSegments
    return when {
      segments.size == 1 && segments[0] == METADATA -> "vnd.android.cursor.dir/vnd.$authority.$METADATA"
      segments.size == 2 && segments[0] == METADATA -> "vnd.android.cursor.item/vnd.$authority.$METADATA"
      segments.size == 2 && segments[0] == STICKERS -> "vnd.android.cursor.dir/vnd.$authority.$STICKERS"
      segments.size == 3 && segments[0] == STICKERS_ASSET -> if (segments[2].endsWith(".png")) "image/png" else "image/webp"
      else -> null
    }
  }

  private fun checkAuthority(uri: Uri) {
    val expected = StickerPackFiles.authority(context!!)
    require(uri.authority == expected) { "Unexpected authority ${uri.authority}" }
  }

  private fun packCursor(packs: List<StickerPackEntry>): MatrixCursor {
    val cursor = MatrixCursor(
      arrayOf(
        "sticker_pack_identifier", "sticker_pack_name", "sticker_pack_publisher", "sticker_pack_icon",
        "android_play_store_link", "ios_app_download_link", "sticker_pack_publisher_email",
        "sticker_pack_publisher_website", "sticker_pack_privacy_policy_website",
        "sticker_pack_license_agreement_website", "image_data_version",
        "whatsapp_will_not_cache_stickers", "animated_sticker_pack",
      ),
    )
    for (p in packs) {
      cursor.addRow(
        arrayOf<Any>(
          p.identifier, p.name, p.publisher, p.trayImageFile,
          "", "", p.publisherEmail,
          p.publisherWebsite, p.privacyPolicyWebsite,
          p.licenseAgreementWebsite, p.imageDataVersion,
          if (p.avoidCache) 1 else 0, if (p.animated) 1 else 0,
        ),
      )
    }
    return cursor
  }

  private fun stickerCursor(pack: StickerPackEntry?): MatrixCursor {
    val cursor = MatrixCursor(arrayOf("sticker_file_name", "sticker_emoji", "sticker_accessibility_text"))
    pack?.stickers?.forEach { cursor.addRow(arrayOf<Any>(it.imageFile, it.emojis.joinToString(","), it.accessibilityText)) }
    return cursor
  }

  override fun insert(uri: Uri, values: ContentValues?): Uri? = throw UnsupportedOperationException("read only")
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int = throw UnsupportedOperationException("read only")
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<String>?): Int =
    throw UnsupportedOperationException("read only")

  companion object {
    const val METADATA = "metadata"
    const val STICKERS = "stickers"
    const val STICKERS_ASSET = "stickers_asset"
  }
}
