package expo.modules.whatsappstickers

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val ADD_PACK_REQUEST = 7301
private const val CONSUMER = "com.whatsapp"
private const val BUSINESS = "com.whatsapp.w4b"

class WhatsAppNotInstalledException : CodedException("WhatsApp is not installed")

/**
 * Android side of "Add to WhatsApp". The JS side writes the pack folder under
 * files/sticker_packs/<identifier>/ first; StickerContentProvider serves it to WhatsApp.
 */
class WhatsAppStickersModule : Module() {
  private var pending: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("WhatsAppStickers")

    Constant("packsDirectory") { Uri.fromFile(StickerPackFiles.root(context)).toString() + "/" }

    AsyncFunction("isWhatsAppInstalled") { installed().isNotEmpty() }

    /** True when every installed WhatsApp (consumer and Business) already has the pack. */
    AsyncFunction("isPackAdded") { identifier: String ->
      val apps = installed()
      apps.isNotEmpty() && apps.all { isWhitelisted(it, identifier) }
    }

    AsyncFunction("addPack") { identifier: String, name: String, promise: Promise ->
      val activity = appContext.currentActivity ?: throw IllegalStateException("No activity")
      val apps = installed()
      if (apps.isEmpty()) throw WhatsAppNotInstalledException()
      val missing = apps.filterNot { isWhitelisted(it, identifier) }
      if (missing.isEmpty()) {
        promise.resolve(mapOf("added" to true, "alreadyAdded" to true))
        return@AsyncFunction
      }
      val intent = Intent("com.whatsapp.intent.action.ENABLE_STICKER_PACK").apply {
        putExtra("sticker_pack_id", identifier)
        putExtra("sticker_pack_authority", StickerPackFiles.authority(context))
        putExtra("sticker_pack_name", name)
      }
      // With both apps installed and the pack in neither, let the user pick, like WhatsApp's sample does.
      val launch = if (missing.size == 1) intent.setPackage(missing[0]) else Intent.createChooser(intent, "Add to WhatsApp")
      pending?.resolve(mapOf("added" to false, "error" to "superseded"))
      pending = promise
      try {
        activity.startActivityForResult(launch, ADD_PACK_REQUEST)
      } catch (e: ActivityNotFoundException) {
        pending = null
        promise.reject(WhatsAppNotInstalledException())
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != ADD_PACK_REQUEST) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null
      if (payload.resultCode == Activity.RESULT_CANCELED) {
        // WhatsApp puts a reason here when the pack fails its checks (size, dimensions, emoji...).
        promise.resolve(mapOf("added" to false, "error" to payload.data?.getStringExtra("validation_error")))
      } else {
        promise.resolve(mapOf("added" to true))
      }
    }
  }

  private fun installed(): List<String> = listOf(CONSUMER, BUSINESS).filter { isInstalled(it) }

  private fun isInstalled(pkg: String): Boolean =
    try {
      context.packageManager.getApplicationInfo(pkg, 0).enabled
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }

  /** Asks WhatsApp whether it already has this pack (the "whitelist check" in WhatsApp's docs). */
  private fun isWhitelisted(pkg: String, identifier: String): Boolean {
    val authority = "$pkg.provider.sticker_whitelist_check"
    context.packageManager.resolveContentProvider(authority, PackageManager.GET_META_DATA) ?: return false
    val uri = Uri.Builder()
      .scheme(ContentResolver.SCHEME_CONTENT)
      .authority(authority)
      .appendPath("is_whitelisted")
      .appendQueryParameter("authority", StickerPackFiles.authority(context))
      .appendQueryParameter("identifier", identifier)
      .build()
    return runCatching {
      context.contentResolver.query(uri, null, null, null, null)?.use { c ->
        c.moveToFirst() && c.getInt(c.getColumnIndexOrThrow("result")) == 1
      } ?: false
    }.getOrDefault(false)
  }
}
