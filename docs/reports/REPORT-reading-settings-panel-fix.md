# 阅读器设置面板：互斥下钻 + 空白栏修复

> 交付日期：2026-09-10 ｜ 提交：`40fb715` ｜ 交付口径：浏览器优先（§8.3.6，不打包 APK）

## 需求与落地对照

| # | 用户需求 | 根因 | 修法 | 文件 |
|---|---------|------|------|------|
| 1 | 关闭「展示进度时间和电量」后，底部栏下移时目录/卡片需同步适配，消除中间空白栏 | 设置面板与子面板经 `createPortal(..., document.body)` 渲染，**不在 `.reader-root` 内**；仅 `.reader-root.reader-no-statusbar` 折叠 `--reader-statusbar-h`，Portal 内容仍悬空留白 | `.reader-no-statusbar` 选择器扩到 `body.reader-no-statusbar`；`EntryReaderPage` 新增 `useEffect` 把类同步挂到 `document.body`（随 `prefs.showProgress` 切换） | `styles.css`、`EntryReaderPage.tsx` |
| 2 | 点「间距设置」再点「更多」禁止卡片重叠，同一时间仅一张 | `ReaderSettingsSheet` 内部嵌套 `fontOpen/spacingOpen/moreOpen` 子面板，叠加渲染 | 重构为**下钻模型**：`EntryReaderPage` 拥有 `fontOpen/spacingOpen/moreOpen/settingsOpen` 四态，开放任一必关其余；回退拦截按 `font→spacing→more→settings→chapter` 优先级 | `ReaderSettingsSheet.tsx`、`EntryReaderPage.tsx` |
| 3 | 翻页移除「无动画」；放大「间距设置」使「对齐」无需下滑可见；「更多设置」新增「自动翻页」默认关闭 | — | `ANIM_OPTIONS` 5→4（删 `none`）；`.reader-more-sheet` `max-height:76%→88%`；`ReaderPrefs.autoLoad` 默认 `true→false`（新增开关控制章节末滑到底自动跳下一章）；`MORE_TOGGLE_KEYS` 增 `autoLoad` | `ReaderSettingsSheet.tsx`、`preferences.ts`、`styles.css` |
| 4 | 交互互斥：拉出「间距设置/更多」时背后「阅读设置」应下拉消失 | 主面板与子面板同级存在、未互斥 | `openSpacing`/`openMore` 会先关 `settingsOpen`；保证同时仅一张卡片 | `EntryReaderPage.tsx` |

## 关键实现点

- **Portal 同步**：面板/子面板挂在 `document.body`，所以折叠信息栏的 `reader-no-statusbar` 类必须同时作用于 `body`，否则目录/卡片不上移、露出空白条。
- **下钻互斥**：`EntryReaderPage` 统一持有四态；任一 `open*` 回调关闭其余三个，`close*` 仅关自身并恢复 `settingsOpen`，从根本杜绝叠加。
- **自动翻页**：复用既有 `prefs.autoLoad`（已被 `EntryReaderPage` 滚动 effect 消费），仅把默认值改为 `false` → 章节末不再自动跳章，交给用户手动。
- **类型修正**：子面板 `bg` 参数类型为 `BgColorPref` 枚举，父级条件渲染传 `prefs.bgColor`（枚举）而非 `bgClassOf()` 的 string，否则 TS 报错（原 797/808/816）。

## 验证（全绿）

- `npm run typecheck`（core+cli+web）：EXIT 0
- `CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run build`：成功（CSS 79.49 kB / JS 528.90 kB）
- `node scripts/tools/e2e-reader-refactor.mjs`：`ok:true`（含新增 L1 `body` 含类 / L2 `.reader-bottom-tabs` `bottom<=1`；更新 M/P 断言）
- `node scripts/tools/e2e-search-worker.mjs`：`ok:true`（10/10）

## 浏览器预览（§8.3.6，无需打包）

```
cd apps/web
CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run dev
# 打开 http://localhost:5173 ，F12 → 设备工具栏 → Pixel 7 / iPhone 14
```
验证点：① 关闭「展示进度时间和电量」后底栏与目录/卡片同步下沉、无白条；② 设置→间距设置→更多 仅一张卡片；③ 翻页 4 胶囊（无「无动画」）、间距卡「对齐」可见、更多含「自动翻页」且默认关。
