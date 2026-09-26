# 发布与分发（B2 / B3）

本地离线优先知识站（PKS）的 Android 发布流程与分发渠道说明。Web 端为在线浏览，APK 为离线优先载体。

## 1. 构建产物链路（顺序不可乱）

```
① pnpm build:index        # 构建索引束 .index/（core 预编译）
② pnpm -F @pks/web copy:content   # 投递 content → apps/web/public/content
③ pnpm -F @pks/web build   # vite 把 public/content 打进 dist/
④ node scripts_sync_android_assets.mjs  # 把 dist/** 同步进 android/app/src/main/assets/public/
⑤ gradle assembleRelease  # 产出签名 release APK
```

> 本沙箱曾遇：vite 前台构建被 SIGTERM → 用 `run_in_background` + `CODEBUDDY_SAFE_DELETE_ENABLED=0`；
> PowerShell 跑 gradle 必须用原生 `*>` 重定向（禁用 `| Out-File`/`| Tee-Object`，否则吞退出码致假失败）。

## 2. 发布签名（B2）

`android/app/build.gradle` 已内置 release 签名脚手架：

- **仅当** `apps/web/android/keystore.properties` 存在时才对 release 包签名；
- 缺失时 `assembleRelease` 产出**未签名**包（不报错，便于本地联调）；
- 真实密钥属**凭证**，由维护者按 `keystore.properties.example` 填好后放入（已 gitignore）。

生成密钥（在仓库外执行，切勿提交 `release.keystore`）：

```bash
keytool -genkey -v -keystore release.keystore -alias pks \
        -keyalg RSA -keysize 2048 -validity 10000
```

填入 `keystore.properties`：

```
STORE_FILE=release.keystore
STORE_PASSWORD=****
KEY_ALIAS=pks
KEY_PASSWORD=****
```

> ⚠️ 密钥库与密码为不可恢复凭证：丢失即永久无法更新已发布应用，务必离线备份。

## 3. 分发渠道（B3）

| 渠道 | 适用 | 说明 |
|------|------|------|
| **Gitee Releases** | 公开/私有分发 | 在仓库 Releases 页上传 `app-release.apk`；用户浏览器下载安装。最简单。 |
| **局域网 / OTA 自更新** | 已装 APK 增量更新 | 复用现有 OTA 校验（sha1 防损坏，非防伪造）；推送新 content 包，端侧校验后应用，无需重装。 |
| **直接文件分发** | 小范围/内测 | 直接传 `app-release.apk`；Android 需开启「未知来源」安装权限。 |

建议：稳定版走 Gitee Releases（带版本号 `versionName`）；内容频繁更新走 OTA（不升版本号，仅换 content 包）。

## 4. 校验产出

```bash
# APK 完整性：确认 EOCD(PK 头) + central dir 条目数
unzip -l app/build/outputs/apk/release/app-release.apk | tail -1
# assets/public/ 是否含最新 content（含 backfill 后内容）
unzip -l app/build/outputs/apk/release/app-release.apk | grep "assets/public/index/manifest.json"
```
