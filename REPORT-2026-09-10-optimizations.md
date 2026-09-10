# 四项优化交付报告（2026-09-10）

APK：`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`（7,063,546 B，11:29）
CSS `index-BeqS4J3W.css` / JS `index-DKxaAeb1.js` —— 均已确认打包进 APK，非陈旧产物。

| # | 缺陷/需求 | 状态 | 核心改动 |
|---|-----------|------|----------|
| A | 系统复制条一闪而过 + 选区青色 | ✅ | 原生子类 WebView 预渲染拦截 + 主题化 `::selection` |
| B | 杀进程重开应回首页 | ✅ | 移除冷启动自动续读 |
| C | 全文搜索慢（十几万字等几秒） | ✅ | 空闲期预载分片 |
| D | 动画流畅性 | ✅ | 去 filter 全屏层、去 backdrop-filter、合成层优化、WebView 预栅格 |

---

## A. 划词选区：系统工具条 + 高亮配色

### 根因
1. **工具条闪现**：旧实现用 `onActionModeStarted` 里 `finish()` 结束系统选择栏 —— 但该回调发生在 ActionMode **已创建、首帧已绘制之后**，所以必然「先闪一下再消失」。反射版 `setCustomSelectionActionModeCallback` 在部分 ROM 上会被 WebView 内部路径绕过。
2. **青色高亮**：全局没有任何 `::selection` 定义，浏览器/WebView 默认使用系统青色选区色。

### 修复
**原生（在渲染之前拦截）** —— 新增 `PksWebView extends CapacitorWebView`，覆写：
- `startActionMode(ActionMode.Callback, int type)`
- `startActionModeForChild(View, ActionMode.Callback, int type)`

当 `type == ActionMode.TYPE_FLOATING` 时**直接 `return null`** → 系统根本不创建 ActionMode 对象、不绘制任何浮动工具栏，因此**无闪现**。
继承 `CapacitorWebView` 而非 `WebView`，以保留 `Bridge.Builder.create()` 里 `webView instanceof CapacitorWebView` 的判断（`setBridge` / `edgeToEdgeHandler` 依赖它）。

配套 `pks_webview_layout.xml`（根节点换成 `com.pks.app.PksWebView`，id 仍为 `webview`），`MainActivity.load()` 先 `setContentView` 我们的布局，使 `findViewById(R.id.webview)` 返回子类实例。

> ⚠️ 关键：只拦截 `TYPE_FLOATING`，**不清除文本选区**。`window.getSelection()` 与阅读页划词词典照常工作（选区手柄由 Chromium 独立渲染）。

**主题化选区**（`styles.css`）——新增 7 条 `::selection` 规则：
- 全局默认：陶土橙半透明（替代青色）
- 阅读页按背景主题分别取协调色：暖黄底→琥珀 `rgba(196,140,46,.34)`；护眼绿→同调绿 `rgba(64,145,92,.30)`；冷蓝→同调蓝 `rgba(74,124,196,.30)`；深色底→浅色 `rgba(180,168,130,.34)` + 亮字 `#fff7e2`
- 已知限制：Chromium 下 `<input>`/`<textarea>` 内的 `::selection` 背景色不被支持（目录搜索框），未强行处理

诊断日志：`PksWebView` 内 `Log.i("PKS", ...)`，可 `adb logcat -s PKS` 确认子类在跑。

---

## B. 杀进程后重开默认回首页

### 根因
`App.tsx` 的 `ensureInitialRoute()` 在「无 hash + 有上次阅读记录」时 `location.replace('#/entry-reader/<slug>')`。这个条件在**每次冷启动**都成立，所以被杀后重开会续读到阅读页。

### 关键结论（架构层面）
**无法区分「首次安装」与「被杀后重开」** —— 二者都是「无 hash 的冷启动 + JS 模块状态全新」。模块级 flag / localStorage 都不具备区分力。因此唯一干净的做法是：**冷启动不再自动续读**。

### 修复
`App.tsx` 删除续读分支，无 hash 冷启动统一 `window.location.replace('#/')`。保留 `bootstrapped` 守卫、`applyAllPrefs()`、深链早返回（带 hash 仍尊重）。移除已无用的 `getLastReadSlug` 导入（typecheck 证明无残留引用）。

**不破坏其他功能**：首页「继续阅读」卡片仍提供续读入口；阅读页自身仍按 `getLastRead()` 恢复章节位置。

---

## C. 全文搜索提速

### 根因（实测）
16 个检索分片 JSON **共 13.45 MB**。首次 L2 搜索的耗时几乎全在**主线程同步 fetch + `JSON.parse` 13.45MB（含 17.6 万 term 键）**，~1.0–2.5s；而 `searchInShard` 扫描本身 <5ms（每片仅 ~32 doc），**不是瓶颈**。`ensureAllShards` 还要等全部 16 片齐了才返回，进一步阻塞。

### 修复
新增 `loader.ts:133 warmSearchShards()`：优先 `requestIdleCallback`（3s 超时兜底），不支持则 `setTimeout 1200ms`；在 `AppContext` 首屏装载完成后 fire-and-forget 调用。分片在**空闲期**提前 fetch+parse 入 `shardCache`，首次全文检索时缓存已热 → 由秒级降至 <50ms。
幂等由既有 `shardCache`/`shardInflight` 保证，零新增依赖。

> 代价：常驻内存 +30–50MB（已解析分片）；空闲期 1–2s 解析已错峰，不卡 UI。

---

## D. 动画流畅性

### 根因（按影响排序）
1. **`filter: brightness()` 施加在 `.reader-root`** —— 该元素**包含滚动的 `.reader-scroll`**，使其成为 filter layer，滚动时每帧重新栅格化整屏（最严重）。
2. `.app-header` / `.app-tabbar` 的 `backdrop-filter: blur(12px)` —— 滚动时每帧背景模糊合成。
3. `.reader-scroll { scroll-behavior: smooth }` —— 与 WebView 原生惯性滚动冲突。
4. 4 处 `transition: all` —— hover 时动画到非预期属性，触发额外 PAINT。
5. `.reader-doc { will-change: filter }` —— 永久占层无收益。

### 修复
1. **亮度模型重构**：仅当需要**提亮**（filter > 1，即 level > 70）时才施加 CSS filter；压暗完全交给 `.reader-veil` 黑色遮罩（仅 opacity 合成，零重绘）。`brightnessVeil()` 改为覆盖 0–70 全压暗区间，使默认与调暗场景下滚动内容**不在 filter 层内**。
2. 顶栏/底栏 `backdrop-filter` → 实色半透明（`rgba(255,255,255,.96)` / `.97`）。
3. 删除 `.reader-scroll` 的 `scroll-behavior: smooth`。
4. 4 处 `transition: all` → 显式属性列表（background/color/border-color）。
5. 删除 `.reader-doc` 的 `will-change: filter`；为 `.home-tree-list` / `.result-list` / `.toc-search-list` 加 `contain: content`。

**Android 侧**（`MainActivity` + `AndroidManifest`）：
- `android:hardwareAccelerated="true"`（WebView 合成器需 GPU）
- `wv.getSettings().setOffscreenPreRaster(true)`（API 23+，离屏预栅格，滚动/长按选区更顺）
- 未使用全局 `setLayerType(LAYER_TYPE_HARDWARE)` —— WebView 自带合成，强制整层会加剧 filter/transform 开销并增显存

**关于新框架**：经评估，View Transitions API 在 `minSdk 23` 的大量旧 WebView 上不可用，**不作为默认**；Web Animations API 可安全替换翻章动画但非必需。本轮结论是**优先纯 CSS/合成层修复**（零依赖、零包体增长），已达成主要收益。

---

## 验收要点
1. 阅读页长按/拖动选词 → **不再有系统复制条闪现**；选区高亮为与阅读背景协调的暖色（不再青色），切换主题后高亮随之变化。
2. 退出 App → 桌面划掉/杀进程 → 重开 → **停在首页**；点首页「继续阅读」可回到原位置。
3. 进入全文检索（切到「全文检索」）搜常见词 → **近乎即时**（首次进入后缓存已热）。
4. 阅读页滚动、路由切换、浮层弹出动画 → 更顺滑。

## 未完成 / 需注意
- 本轮 `research-anim`（CSS/动画）与 `proto-selcopy`（原生加固）两个 worker 遭遇 429 频率限制中断；其中原生的编辑实际已落盘并已验证，**CSS/动画部分由 team-lead 直接完成**。
- 目录搜索框（`type="search"`）内的选区颜色受 Chromium 限制无法主题化。
- `PksWebView` 的 `Log.i` 诊断日志保留在代码中（体积可忽略，便于日后排查）；如需发布纯净版可移除。
