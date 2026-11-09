import ExpoModulesCore
import UIKit

/**
 * iOS side of "Add to WhatsApp". WhatsApp's documented flow for third-party apps:
 * put the pack as JSON on the general pasteboard under
 * "net.whatsapp.third-party.sticker-pack", then open whatsapp://stickerPack.
 * The JS side writes the pack folder (contents.json, tray.png, NN.webp) first.
 */
public class WhatsAppStickersModule: Module {
  private static let pasteboardType = "net.whatsapp.third-party.sticker-pack"
  private static let pasteboardExpiry: TimeInterval = 60

  public func definition() -> ModuleDefinition {
    Name("WhatsAppStickers")

    Constant("packsDirectory") { () -> String in
      let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      return docs.appendingPathComponent("sticker_packs", isDirectory: true).absoluteString
    }

    AsyncFunction("isWhatsAppInstalled") { () -> Bool in
      guard let url = URL(string: "whatsapp://") else { return false }
      return UIApplication.shared.canOpenURL(url)
    }.runOnQueue(.main)

    AsyncFunction("addPack") { (directory: String, links: [String: String]) -> [String: Any] in
      guard let whatsapp = URL(string: "whatsapp://stickerPack"), UIApplication.shared.canOpenURL(whatsapp) else {
        throw WhatsAppNotInstalledException()
      }
      let payload = try Self.buildPayload(directory: directory, links: links)
      let data = try JSONSerialization.data(withJSONObject: payload, options: [])
      UIPasteboard.general.setItems(
        [[Self.pasteboardType: data]],
        options: [.localOnly: true, .expirationDate: Date(timeIntervalSinceNow: Self.pasteboardExpiry)]
      )
      UIApplication.shared.open(whatsapp, options: [:], completionHandler: nil)
      return ["added": true]
    }.runOnQueue(.main)
  }

  private static func buildPayload(directory: String, links: [String: String]) throws -> [String: Any] {
    guard let dir = URL(string: directory) else { throw PackFolderException("bad folder \(directory)") }
    let contents = try Data(contentsOf: dir.appendingPathComponent("contents.json"))
    guard let pack = try JSONSerialization.jsonObject(with: contents) as? [String: Any],
          let trayFile = pack["tray_image_file"] as? String,
          let stickers = pack["stickers"] as? [[String: Any]] else {
      throw PackFolderException("contents.json is incomplete")
    }

    let tray = try Data(contentsOf: dir.appendingPathComponent(trayFile))
    var json: [String: Any] = [
      "identifier": pack["identifier"] ?? "",
      "name": pack["name"] ?? "",
      "publisher": pack["publisher"] ?? "",
      "tray_image": tray.base64EncodedString(),
      "animated_sticker_pack": (pack["animated_sticker_pack"] as? Bool) ?? false,
    ]
    for key in ["publisher_email", "publisher_website", "privacy_policy_website", "license_agreement_website"] {
      if let value = pack[key] as? String, !value.isEmpty { json[key] = value }
    }
    if let ios = links["ios"], !ios.isEmpty { json["ios_app_store_link"] = ios }
    if let android = links["android"], !android.isEmpty { json["android_play_store_link"] = android }

    json["stickers"] = try stickers.map { sticker -> [String: Any] in
      guard let file = sticker["image_file"] as? String else { throw PackFolderException("sticker without image_file") }
      let image = try Data(contentsOf: dir.appendingPathComponent(file))
      return [
        "image_data": image.base64EncodedString(),
        "emojis": (sticker["emojis"] as? [String]) ?? [],
        "accessibility_text": (sticker["accessibility_text"] as? String) ?? "",
      ]
    }
    return json
  }
}

final class WhatsAppNotInstalledException: Exception {
  override var reason: String { "WhatsApp is not installed" }
}

final class PackFolderException: GenericException<String> {
  override var reason: String { "Sticker pack folder problem: \(param)" }
}
