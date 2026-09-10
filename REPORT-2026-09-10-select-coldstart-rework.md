# 返工报告 · 阅读页选词失效 & 冷启动闪阅读页

日期：2026-09-10
产物：`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`（7,015,036 B，BUILD SUCCESSFUL）

---

## 缺陷一：长按选词时系统菜单条 + 选词条「一闪即消失，完全无法完成选词」

### 原因（上一轮修复用错了契约）

上一轮为了屏蔽系统「复制/分享/搜索」浮动工具栏，`PksWebView` 覆写
`startActionMode(callback, type)` / `startActionModeForChild(...)`，遇到
`type == ActionMode.TYPE_FLOATING` 时**直接 `return null`**。

这在 Android WebView 上是**错误的契约**：

> WebView 请求浮动 ActionMode（文本选区工具栏）时，如果拿到 `null`，它会认为
> 「应用不愿意处理这次选择」，于是**连同选区手柄一起把正在进行的选区清除掉**。

由此产生用户看到的现象：

1. 长按拖选 → 选区手柄闪一下 → 立即消失，用户**永远选不成字**；
2. `window.getSelection()` 瞬间变空 → 划词词典卡片 100% 不弹。

同一类「会清掉选区」的还有另外两处（上一轮也加了，属于互相打架的多层防御）：
- `onActionModeStarted` 里 `mode.finish()`；
- 反射 `setCustomSelectionActionModeCallback` 的 `onCreateActionMode` 返回 `false`。

### 修改位置与改动

| 文件 | 改动 |
|---|---|
| `android/app/src/main/java/com/pks/app/PksWebView.java` | **重写**。构造时安装 `EMPTY_SELECTION_CALLBACK`：`onCreateActionMode` 返回 **`true`**（让 ActionMode 成立 → WebView 保留选区与手柄），但**不往 menu 加任何 item**（工具栏没有按钮可画 → 不可见）；`onPrepareActionMode` 再 `menu.clear()` 防止系统回填「复制/全选/分享」。`startActionMode*` 覆写**只打日志、一律 `super`**，不再 `return null`。 |
| `MainActivity.java` | **删除**反射版 `setCustomSelectionActionModeCallback`（`onCreateActionMode` 返回 `false`）与 `onActionModeStarted` → `mode.finish()` 覆写 —— 这两处都会清除选区、并覆盖掉上面的空菜单回调。 |
| `styles.css` | 删除 `.reader-doc { -webkit-touch-callout: none }`（Android WebView 本就不支持该属性，徒增干扰）。 |

**核心思路**：把「隐藏系统工具栏」与「保留文本选区」解耦 ——
让 ActionMode **正常成立**（选区、手柄、`getSelection()` 全部存活），
只是让它的**菜单为空**，于是工具栏视觉上不存在。这与番茄小说类阅读器的做法一致。

---

## 缺陷二：冷启动（杀后台重进）先在阅读页停留 1–2 秒，再跳首页

### 原因

Android 冷启动时，**WebView 会恢复上一次提交的 URL**（Chromium 会持久化 last committed URL），
因此 `location.hash` 仍然是 `#/entry-reader/...`。

原实现 `App()` 内调用 `ensureInitialRoute()`，执行 `window.location.replace('#/')` ——
但 `location.replace` 对 hash 的更新**只异步派发 `hashchange`**；
而路由 hook 的 `useState(() => currentHash())` 在**首帧渲染**时就已经读到了旧 hash。

于是顺序变成：

```
首帧渲染（读到旧 hash）→ 渲染阅读页 ← 用户看到这里停留 1~2 秒
        ↓ hashchange 异步到达
重渲染首页 ← 才跳过来
```

### 修改位置与改动

| 文件 | 改动 |
|---|---|
| `App.tsx` | 引导函数 `ensureInitialRoute` **更名导出为 `bootstrapRoute()`**；逻辑：`applyAllPrefs()` → 有深链（`hash && hash !== '#'`）则尊重返回 → 否则 `location.replace('#/')`。 |
| `main.tsx` | **在 `createRoot(...).render()` 之前同步调用 `bootstrapRoute()`** —— 关键点：在 React 首帧渲染前把 hash 规范化好，React 首帧直接读到 `#/`，阅读页**一帧都不会渲染**。 |
| `App.tsx` | `App()` 内保留一次幂等调用（`bootstrapped` 守卫），保证任何入口行为一致。 |
| `router.tsx` | **删除** `useHashRoute` effect 里的 `if (!window.location.hash) window.location.replace('#/')` —— 它在首帧之后触发，正是多余中转的来源。 |

---

## 验证（全部在 APK 内确认）

- 构建链路全 exit 0：`tsc --noEmit` → `vite build` → `cap sync android` → `gradlew assembleDebug --no-daemon`（BUILD SUCCESSFUL）。
- Bundle：`assets/public/assets/index-mYxLcVHI.js`、`index-DU762-pZ.css`（`index.html` 引用一致）。
- **原生**：`classes4.dex` 内 `PksWebView`（2 处）、`EMPTY_SELECTION_CALLBACK`（1 处）、`startActionModeForChild`（2 处）均在。
- **冷启动逻辑**（压缩后）：`location.hash; e&&e!=="#" || window.location.replace("#/")` —— 逻辑完整（`bootstrapRoute` 标识符被压缩改名，grep=0 属假阴性）。
- **CSS**：`::selection` 主题规则在；`touch-callout` 已为 0；`getLastReadSlug` 已为 0。

## 验收方式

1. 阅读页长按 / 拖动选词 → 选区与手柄**稳定保留**，不再闪退；划词「复制/查询」卡片正常弹出。
2. 杀后台重进 App → **直接就是首页**，不再先在阅读页停留再跳转；首页「继续阅读」卡片仍可回到上次位置。
