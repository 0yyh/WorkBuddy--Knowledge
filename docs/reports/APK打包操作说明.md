# PKS · APK 打包操作说明

> 面向「由作者本人手动打包 Android APK」的完整指引。
> 适用项目：PKS 个人本地知识学习站（Windows）。
> 最后核对：2026-09-12（版本号/配置以仓库当前状态为准）。
>
> **2026-09-12 复检结论**（打包前状态）：
> - 环境与工程前置**全部就绪**：`D:\JDK\jdk-19.0.1`、`D:\Android SDK`（含 platform-35 / build-tools）、
>   `apps/web/android/local.properties`（`sdk.dir` 已指向 SDK）、`apps/web/node_modules/@pks/core`（junction 正常）。
> - 内容源 **122 词条**已投递到 `apps/web/public/content/`（含新增 tcp-ip / http / relational-database / public-key-cryptography）。
> - ⚠️ `apps/web/dist/` 与 `android/app/src/main/assets/public/` 均为**旧产物**，**必须按下文完整链路重建**，
>   切勿只跑 `android:build`（否则会把旧 `dist` 打进 APK —— 见第 1 节的历史事故）。
> - 已清理：根目录临时日志、旧 APK（`release/pks-app-2026-09-10*.apk`）、失效 OTA 包（`release/latest`）。
>   需要局域网 OTA 时用 `npm run build:update` 重新生成 `release/latest`。

---

## 目录

- [0. 最短可照做清单（TL;DR）](#0-最短可照做清单tldr)
- [1. 先理解：打包分两层](#1-先理解打包分两层)
- [2. 前置环境](#2-前置环境)
- [3. 逐步操作](#3-逐步操作)
- [4. APK 输出路径](#4-apk-输出路径)
- [5. 不同打包方式的差别](#5-不同打包方式的差别)
- [6. 关键参数速查](#6-关键参数速查)
- [7. 常见报错与对策](#7-常见报错与对策)
- [8. 内容 vs 代码：什么时候需要重打包](#8-内容-vs-代码什么时候需要重打包)
- [附录 A：脚本速查](#附录-a脚本速查)

---

## 0. 最短可照做清单（TL;DR）

在 CMD 中依次执行（项目根 `D:\WorkBuddy--Knowledge`）：

```bat
cd /d D:\WorkBuddy--Knowledge
set JAVA_HOME=D:\JDK\jdk-19.0.1
set ANDROID_HOME=D:\Android SDK
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%

npm run build:index
npm run build:chardict
npm run content:copy
npm run build
npm run android:sync
cd apps\web\android
gradlew assembleDebug --no-daemon
```

产物路径：

```text
D:\WorkBuddy--Knowledge\apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```

> ⚠️ 顺序不能改。尤其 `content:copy` 必须在 `npm run build` 之前，`npm run android:sync` 必须在 `npm run build` 之后。

---

## 1. 先理解：打包分两层

APK 里跑的是**已经编译好的网页产物**。所以打包 = **先把网页编译出来，再塞进 Android 壳里用 Gradle 打包**。两层必须按顺序做：

| 层 | 干什么 | 产出 |
|---|---|---|
| **A. Web 产物层** | 生成内容索引 + 编译前端 | `apps/web/dist/` |
| **B. Android 打包层** | 把 dist 同步进安卓工程 + Gradle 编译 | `.apk` 文件 |

> **最容易踩的坑**
> 项目的 `npm run android:build` 脚本**只做 B 层，不做 A 层**。直接跑它，`cap sync` 会把**上一次残留的旧 `dist`** 拷进包里 —— 你装上的 APK 里是旧代码。本项目历史上真实发生过该事故（见 `docs/reports/REPORT-2026-09-10-APK-fixes.md`）。**必须先把 A 层做完。**

---

## 2. 前置环境

| 项 | 值 / 要求 | 说明 |
|---|---|---|
| Node | **managed Node 22.22.2** | 项目 `engines` 要求 ≥ 20.11；Vite5 在 Node16 下会报 `crypto.getRandomValues` 错 |
| JAVA_HOME | `D:\JDK\jdk-19.0.1` | 必须 JDK 17+（AGP 8.7.2 / Gradle 8.11.1 要求）；本机 PATH 默认 java 为 16.0.2，太旧，须显式指向 |
| ANDROID_HOME | `D:\Android SDK` | 需已安装 **SDK Platform 35**、**Build-Tools**、**platform-tools** |
| 依赖 | **已装好，禁止重装** | 任何位置都**不要**跑 `npm install` / `pnpm install` / `pnpm prune` |
| 网络 | 首次构建需联网 | Gradle Wrapper 会下载 `gradle-8.11.1-all.zip`（较大） |

**为什么禁止重装依赖**：web 端通过**手工 junction** 解析 `@pks/core`（`apps/web/node_modules/@pks/core` → `packages/core`）。npm/pnpm 重建 `node_modules` 会删掉该 junction，导致 web 构建直接断裂。

### 设置环境变量

CMD（临时，仅当前窗口）：
```bat
set JAVA_HOME=D:\JDK\jdk-19.0.1
set ANDROID_HOME=D:\Android SDK
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%
```

PowerShell（临时）：
```powershell
$env:JAVA_HOME="D:\JDK\jdk-19.0.1"
$env:ANDROID_HOME="D:\Android SDK"
```

永久生效：系统属性 → 高级 → 环境变量，新增/编辑 `JAVA_HOME`、`ANDROID_HOME`，并把 `%JAVA_HOME%\bin`、`%ANDROID_HOME%\platform-tools` 加入 `Path`。

> 若 `node` 未指向 22.22.2，可先把 managed Node 目录加到 `Path` 最前：
> `C:\Users\Yu\.workbuddy\binaries\node\versions\22.22.2-3`

---

## 3. 逐步操作

> 默认在**项目根目录** `D:\WorkBuddy--Knowledge` 执行（除标注外）。

### 第 1 步 · 生成内容索引
```bat
npm run build:index
```
- 脚本内部**先编译 `@pks/core`**（`tsc -p packages/core/tsconfig.json`），再跑 CLI 的 `build:index`。
- 产出 `content/.index/`（词条 / 搜索分片），默认**增量构建**；要强制全量加 `--full`。
- 改了 `packages/core/src/**` 时必须重跑，否则 web 消费的是旧产物。

### 第 2 步 · 生成字符词典索引（改了词典才需要）
```bat
npm run build:chardict
```
- 把 4 个原始词典文件合并为 `content/dict/chinese-dictionary/character/index.json`（约 21,056 字）。
- 该产物已被 `.gitignore` 忽略，**换机器必须重跑**，否则汉字词典不生效。

### 第 3 步 · 把内容投递到 web 的 public
```bat
npm run content:copy
```
- 把 `content/` 拷到 `apps/web/public/content/`，并把 `.index` **改名成 `index`**（不带点的目录才不会被 Capacitor / AGP 丢弃）。
- 必须在 `vite build` **之前**执行，否则 `public` 里是旧内容。

### 第 4 步 · 编译前端（vite build）
```bat
npm run build
```
或只构建 web：`cd apps/web && npm run build`
- 产出 `apps/web/dist/`。
- **注意**：vite 的 `emptyOutDir` 在 WorkBuddy 的受控终端里会触发安全删除守卫。若在**工作助手终端**里报错，先设 `CODEBUDDY_SAFE_DELETE_ENABLED=0`；在**你自己普通的 PowerShell/CMD** 里通常不需要。

### 第 5 步 · 同步进 Android 工程
```bat
npm run android:sync
```
等同 `cd apps/web && npx cap sync android`。
- Capacitor 会：把 `dist` 拷进 `android/app/src/main/assets/public`；重写 `capacitor.build.gradle`、`capacitor.settings.gradle`、`capacitor.config.json`。
- 此时 `dist` 必须已存在（第 4 步产物），否则 cap sync 报错。

### 第 6 步 · Gradle 编译出 APK
```bat
cd apps/web/android
gradlew assembleDebug --no-daemon
```
- Windows CMD/PowerShell 用 `gradlew.bat`；Git Bash / macOS 用 `./gradlew`。
- `--no-daemon` 表示用完不留常驻守护进程（脚本默认带）。
- 首次会下载 Gradle 8.11.1 发行包，耐心等待。
- `local.properties` 中已有 `sdk.dir=D:\Android SDK`，Gradle 靠它找 SDK（该文件 gitignored，属本机私有配置）。

### 第 7 步 · 取 APK

见 [第 4 节](#4-apk-输出路径)。可直接安装到手机：
```bat
adb install -r apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```
或把 APK 传到手机点击安装（debug 包已用调试签名，可直接安装）。

---

## 4. APK 输出路径

| 打包方式 | 命令 | 默认输出路径（相对项目根） |
|---|---|---|
| **Debug 调试包** | `gradlew assembleDebug` | `apps/web/android/app/build/outputs/apk/debug/app-debug.apk` |
| **Release 正式包** | `gradlew assembleRelease` | `apps/web/android/app/build/outputs/apk/release/app-release-unsigned.apk` |
| **AAB（上架用）** | `gradlew bundleRelease` | `apps/web/android/app/build/outputs/bundle/release/app-release.aab` |
| **直接装到已连设备** | `gradlew installDebug` | 不产出独立文件；产物仍在 debug 路径 |

绝对路径示例：
```text
D:\WorkBuddy--Knowledge\apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```

### 关于项目根的 `release/` 目录
- 这是**人工归档目录**，**不是** Gradle 自动写入的位置。
- Gradle **不会**自动往这里放东西；打完包后**手动复制**过去并按 `pks-app-YYYY-MM-DD[-后缀].apk` 命名。
- 该目录与 `*.apk` 均被根 `.gitignore` 忽略，不会进版本库。
- **2026-09-12 清理**：旧的按日期归档 APK（`pks-app-2026-09-10*.apk`）与失效的 OTA 包 `release/latest/`
  （2026-09-10 生成、旧 `df.json` 布局，与新 App 索引格式不兼容）已删除。需要 OTA 时用
  `npm run build:update` 从当前 `apps/web/public/content/` 重新生成 `release/latest`。

---

## 5. 不同打包方式的差别

### 5.1 Debug vs Release

| | Debug | Release |
|---|---|---|
| 签名 | 自动用调试密钥（`~/.android/debug.keystore`，自动生成） | **本项目未配置签名** → 产出 `app-release-unsigned.apk`，**无法直接安装** |
| 能否分发 | 能装、能测，不宜正式分发 | 需自行签名后才能安装/分发 |
| 优化 | 无压缩混淆、体积大、可调试 | 本项目 `minifyEnabled false`（未开混淆，仍为未签名包） |
| 路径 | `.../apk/debug/app-debug.apk` | `.../apk/release/app-release-unsigned.apk` |

> 想安装 release 包，需：用 Android Studio 的「Generate Signed Bundle/APK」生成带签名的包，或用 `apksigner` 手动签名，或在 `app/build.gradle` 补 `signingConfigs`（属改代码，本文不展开）。

### 5.2 命令行 Gradle vs Android Studio
- **命令行**：产物固定在 `app/build/outputs/...`（见第 4 节表格）。
- **Android Studio**：默认也是同一路径；若走「Build → Generate Signed Bundle / APK…」向导，会让你**自选**输出目录，并可选生成 `.aab`。
- 两者编译同一工程，结果一致，差别只在「取件位置由向导决定」。

### 5.3 APK vs AAB
- **APK**：可直接安装到手机（本项目日常自用选它）。
- **AAB**：Google Play 上架格式，不能直接安装，需 `bundletool` 或商店处理。自用**不需要**。

### 5.4 一键 `npm run android:build` vs 手动分步
- 一键脚本：`npm run android:build` = `cap sync android && cd android && gradlew assembleDebug --no-daemon`。
- **它不含第 1~4 步**（不生成索引、不拷内容、不 vite build）。正确的一键用法是：
  ```bat
  npm run build:index && npm run build:chardict && npm run content:copy && npm run build && npm run android:build
  ```
- 只有「纯 Android 原生配置改动、且 `dist` 没变」时，才可以只跑 `npm run android:build`。

### 5.5 内容变了要不要重打包？
- **只改内容**（`content/` 下的 Markdown、词典）→ **不用重打 APK**，走局域网 OTA：
  ```bat
  npm run build-update
  npm run serve:lan
  ```
  然后 App「我的 → 内容更新」填 `http://<电脑IP>:8080/` → 检查更新 → 立即更新。
- **改代码 / 依赖 / 原生配置** → **必须重打包**。App 内的内容更新**换不掉代码**。

---

## 6. 关键参数速查

| 位置 | 参数 | 当前值 | 改动影响 |
|---|---|---|---|
| `apps/web/capacitor.config.ts` | `appId` | `com.pks.app` | 包名，改了等于换应用 |
| | `appName` | `知识` | 桌面显示名 |
| | `webDir` | `dist` | cap sync 拷贝的源目录 |
| | `android.allowMixedContent` | `true` | **必须保持 true**，否则 App 连局域网明文更新源会 `Failed to fetch` |
| `apps/web/android/variables.gradle` | `compileSdkVersion` | 35 | Capacitor 7 硬性要求 ≥ 35 |
| | `targetSdkVersion` | 34 | 刻意压到 34，规避 Android 15 行为变更 |
| | `minSdkVersion` | 23 | 兼容 Android 6+ |
| | `androidxCoreVersion` | 1.13.1 | 1.14/1.15 不存在或需更高 SDK，勿改 |
| `apps/web/android/app/build.gradle` | `applicationId` | `com.pks.app` | 与 appId 对应 |
| | `versionCode` / `versionName` | `1` / `"1.0"` | **每次发新版建议递增**（覆盖安装/升级判断靠它） |
| `apps/web/android/build.gradle` | AGP 版本 | 8.7.2 | 与 Gradle 8.11.1 + JDK17 配套 |
| | compileOptions 覆写 | 强制 Java 17 | 覆盖 cap 生成的 Java 21（本机无 JDK21） |
| | `resolutionStrategy.force` | androidx.core 1.13.1 | 锁版本，避免拉高 compileSdk 需求 |
| `app/src/main/AndroidManifest.xml` | `usesCleartextTraffic` | `true` | 放行明文网络（与 WebView 混合内容是两道独立的门） |
| `gradle.properties` | `org.gradle.jvmargs` | `-Xmx1536m` | 内存不足可调大 |
| `gradle/wrapper/gradle-wrapper.properties` | distributionUrl | gradle-8.11.1-all | 首次自动下载 |

---

## 7. 常见报错与对策

| 现象 | 原因 | 对策 |
|---|---|---|
| `TypeError: crypto.getRandomValues is not a function` | 用了 Node 16 | 换 managed Node 22.22.2 |
| Gradle 报 Java 版本不支持 / 找不到 toolchain 21 | JAVA_HOME 指向了旧 JDK | 设 `JAVA_HOME=D:\JDK\jdk-19.0.1` |
| 装上的 App 是旧代码 / 观感没变 | 没重跑 vite build，cap sync 拷了旧 dist | 严格按第 1~6 步顺序重做 |
| 索引 404 / 搜索失效 | `.index` 没被改名成 `index` | 确认走过 `npm run content:copy` |
| App 连更新源报 `Failed to fetch` | `allowMixedContent` 被关 | 恢复 `capacitor.config.ts` 的 `android.allowMixedContent: true`，重新 cap sync 打包 |
| `gradlew` 提示找不到 SDK | `local.properties` 丢失 | 新建 `apps/web/android/local.properties`，写 `sdk.dir=D:\\Android SDK` |
| `vite build` 因 safe-delete 守卫生效失败 | 在受控终端里跑 | 设 `CODEBUDDY_SAFE_DELETE_ENABLED=0` 再跑 |
| `cap sync` 报 webDir 不存在 | 没先 vite build | 先跑第 4 步生成 `dist` |

---

## 8. 内容 vs 代码：什么时候需要重打包

| 变更类型 | 示例 | 是否重打 APK | 备注 |
|---|---|---|---|
| 内容 | `content/entries/**`、`content/dict/**` | ❌ 不需要 | 走 `build-update` + `serve:lan` 局域网 OTA |
| 前端代码 | `apps/web/src/**` | ✅ 需要 | 必须 `vite build` + `cap sync` + Gradle |
| 核心库 | `packages/core/src/**` | ✅ 需要 | `build:index` 会连带编译 core |
| 原生/构建配置 | `capacitor.config.ts`、`*.gradle`、`AndroidManifest.xml` | ✅ 需要 | cap sync 会重写部分生成文件 |
| 依赖 | `package.json` | ✅ 需要 | 注意：仅**升级依赖**才需动，日常勿 `install` |

---

## 附录 A：脚本速查

| 脚本（项目根） | 等价 / 说明 |
|---|---|
| `npm run build:index` | 编译 core + 生成内容索引到 `content/.index` |
| `npm run build:chardict` | 编译 core + 生成汉字词典 `character/index.json` |
| `npm run content:copy` | 投递内容到 `apps/web/public/content`（`.index` → `index`） |
| `npm run build` | 编译 core + cli + typecheck + `vite build`（→ `apps/web/dist`） |
| `npm run android:sync` | `cap sync android` |
| `npm run android:build` | `cap sync android && cd android && gradlew assembleDebug --no-daemon`（**不含 vite build**） |
| `npm run build-update` | 生成局域网内容更新包到 `release/latest` |
| `npm run serve-lan` | 托管更新包（默认端口 8080） |

---

_本说明为操作参考文档，如与仓库实际配置不一致，以仓库当前 `capacitor.config.ts` / `*.gradle` / `package.json` 为准。_
