Pod::Spec.new do |s|
  s.name           = 'WhatsAppStickers'
  s.version        = '0.1.0'
  s.summary        = 'Adds sticker packs to WhatsApp'
  s.description    = 'Hands a sticker pack to WhatsApp through the pasteboard, as WhatsApp documents for iOS.'
  s.author         = ''
  s.homepage       = 'https://github.com/WhatsApp/stickers'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
