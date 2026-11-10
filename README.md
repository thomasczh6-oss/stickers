# Stickers AI

用 AI 把自拍、宠物或一句描述变成 WhatsApp 动态贴纸包。iOS、Android 和 Web 三端，面向美国和欧洲市场（界面为英文）。

- **apps/server**：API 和出图任务。Node + Hono，Postgres 任务队列，sharp 处理图片。出图走公司 AI 网关（OpenAI Images 协议），默认用 `gpt-image-2.6-flare`，想换回 2.5 就改 `IMAGE_MODEL=gpt-image-2.5-flare`。2.6 返回的是自带透明背景的图，2.5 返回绿幕图，管线两种都能处理。
- **apps/web**：Next.js 官网和网页版创建流程。生成贴纸包、看进度、看贴纸包，手机上一键跳 App，电脑上扫码。
- **apps/mobile**：Expo（SDK 58）App。`modules/whatsapp-stickers` 是本地原生模块，负责“添加到 WhatsApp”。
- **packages/shared**：三端共用的 WhatsApp 贴纸规格、风格和动作预设、请求校验、API 客户端。

## 一张贴纸是怎么做出来的

1. 先用照片（图生图）或文字（文生图）画一个**角色设定图**，后面每张贴纸都以它为参考，保证是同一个角色。
2. 每个动作（Hi!、LOL、Love you…）让模型画一张 **3×2 的六帧动作图**（1536×1024）。提示词要求纯绿背景；gpt-image-2.6 会直接给透明背景，也能用。
3. 服务端切出六帧，去掉背景（绿幕抠图，或直接用模型给的透明通道），按脚的位置对齐，加白色描边和可选的文字，来回播放，第一帧停留稍长。
4. 压成 512×512 的动态 WebP，并按 WhatsApp 规则自检：动态 ≤500KB、静态 ≤100KB、托盘图 96×96 PNG ≤50KB、每包 3 到 30 张。
5. 文件存本地磁盘或 S3。用户上传的照片在任务结束后立即删除。

gpt-image-2.6-flare 输出的仍是静态 PNG，所以动画还是靠六帧动作图拼出来。以后如果有模型直接输出 GIF 或动态 WebP，`pipeline/encode.ts` 里的 `decodeAnimation` 已经能把它拆成帧，直接接到第 3 步。

## 添加到 WhatsApp

WhatsApp 只接受**已安装 App** 提交的第三方贴纸包，所以网页负责制作和展示，添加这一步在 App 里完成：

- **Android**：App 内置一个 ContentProvider（`${applicationId}.stickercontentprovider`），WhatsApp 通过它读取 `files/sticker_packs/<id>/` 下的贴纸。App 再发 `com.whatsapp.intent.action.ENABLE_STICKER_PACK` intent，并通过 whitelist 查询判断这个包是否已经添加过。WhatsApp 和 WhatsApp Business 都支持。
- **iOS**：把贴纸包按 WhatsApp 的格式写进剪贴板（`net.whatsapp.third-party.sticker-pack`，60 秒后过期、仅本机），再打开 `whatsapp://stickerPack`。

网页上的 `/p/<id>` 同时是通用链接（Universal Links / App Links）：装了 App 就直接打开对应贴纸包。

## 本地运行

需要 Node 22 和 pnpm 10。

```bash
pnpm install

# API，默认 http://localhost:8787。没有网关 key 时用离线 mock 画图，整条流程照样能跑。
cp apps/server/.env.example apps/server/.env   # 填 GATEWAY_API_KEY；不要提交 .env
pnpm dev:server

# 网页，默认 http://localhost:3000
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web

# App：添加到 WhatsApp 需要原生代码，Expo Go 不行，要用开发构建
cp apps/mobile/.env.example apps/mobile/.env   # API 地址填电脑的局域网 IP
cd apps/mobile && npx expo run:android   # 或 npx expo run:ios
```

不配 `DATABASE_URL` 时用内置的 PGlite，数据在 `apps/server/data/`。不配 `S3_BUCKET` 时文件也存在那里，由 API 的 `/files/*` 提供。

### 安卓测试包（APK）

手机和跑 API 的电脑连同一个 Wi‑Fi。服务器的 `apps/server/.env` 里把 `PUBLIC_BASE_URL` 设成电脑的局域网地址（例如 `http://192.168.1.20:8787`），否则手机拿到的贴纸链接是 localhost。

```bash
cd apps/mobile
ALLOW_HTTP=1 EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8787 npx expo prebuild --platform android
cd android && ALLOW_HTTP=1 EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8787 ./gradlew assembleRelease
# 输出 android/app/build/outputs/apk/release/app-release.apk（用 debug 证书签名，只能测试用）
```

`ALLOW_HTTP=1` 允许 App 走明文 http 连局域网服务器，正式包不要加。服务器地址也可以在 App 首页右上角的 Settings 里改，改完点 Test connection 看能不能连上。需要 JDK 17 和 Android SDK（`ANDROID_HOME`）。

## 常用命令

```bash
pnpm typecheck      # 全部包的类型检查
pnpm test           # 共享校验 + 服务端管线和 API 测试（用 mock，不调网关）
pnpm build:web      # 网页生产构建
pnpm smoke -- --prompt "a corgi in a hoodie" --kind animated   # 真实调用网关做一个包，输出到 apps/server/out/
pnpm gen:assets     # 用 image 模型生成 App 图标、启动图、分享图、官网示例贴纸
```

`gen:assets` 让模型只画吉祥物和示例角色，背景渐变和文字由代码合成，所以图标风格稳定。仓库里的图标、分享图和示例包都是用网关真实生成的；`pnpm gen:assets -- --only samples --samples corgi,cat` 可以只重做指定的示例包。

## 上线前要定的事

- App 名称、Bundle ID（现在是占位的 `ai.stickers.app`）、Web 域名（`WEB_DOMAIN`）。
- Apple Team ID 和 Android 签名证书指纹，用于通用链接（见 `apps/web/.env.example`）。
- 生产数据库（Postgres）和对象存储（S3 兼容，配 CDN 地址 `S3_PUBLIC_BASE_URL`）。
- 账号体系和付费：现在用设备 ID 匿名识别用户，每台设备同时最多 2 个进行中的任务。
