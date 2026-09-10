# PKS 三处阻断缺陷修复与 APK 重建（2026-09-10）

> 交付物：`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`（6,965,831 B，2026-09-10 07:52）

## 根因复盘
此前交付的 APK「整体观感与上一版一致」并**不是缺代码**——OTA / 词典 / UI 代码当时已落到磁盘，是构建用了错误 vite 路径导致 `dist` 陈旧，新代码从未进包。本段在 Agent 模式直接补齐缺失项并正确重建。

## 三项修复（均已进包，unzip 提取 bundle 后 grep 验证）

### ① 局域网本机内容更新（此前完全缺失的方向性缺陷）
- 新增 `lib/contentCache.ts`（原生 IndexedDB，零依赖、失败安全）、`lib/contentUpdater.ts`（manifest + 逐文件 fetch + sha256 校验 + 缓存优先，与 `update.ts` 的 APK 自更新彻底分离）、`scripts/build-update.mjs`（生成 `release/latest/`）。
- `loader.ts` 改为缓存优先；`MePage.tsx` 已有「内容更新」入口（填 `http://<PC-IP>:8080/` → 检查/立即更新/清除缓存）。
- 端到端已验证：`build-update.mjs` 产出 642 文件 / 14.83 MB，manifest 含 sha256。

### ② UI 改进（P0-1 / P1-4 / P1-8）
- **P0-1 悬浮「开始阅读」**：删掉 styles.css 中重复且无 `z-index` 的 `.cover-actions`，主规则改为 `position:sticky; bottom:calc(var(--tabbar-h)+10px); z-index:5`；`.entry-cover-page` padding-bottom → `calc(var(--tabbar-h)+88px)`。
- **P1-4 目录点击进阅读（真缺失项）**：`router` 给 `entry-reader` 加 `ch` query → `EntryReaderPage` 初值优先 `chapterStart` → `EntryCoverPage` 目录整行可点，`navigate('/entry-reader/:slug?ch=i+1')`，并加 `.cover-chapter-clickable` 可点样式。
- **P1-8 统计卡**：`.stat-card` gap 2→4px，`.stat-num` 1.0625→1.25rem，`.stat-unit` 加 `opacity:.72` 变浅。
- 另：`AppContext.tsx` 类目去重（P0-2）此前已实现并保留。

### ③ 划词词典卡片（代码在包里但触发死锁）
- `ReaderSelectionMenu.tsx` 删除 `lastGestureAt` 死锁守卫，改为「选区非坍缩 + 锚点在正文内」即无条件弹出；补 `touchcancel`；`lib/dict.ts` 用 `import.meta.env.BASE_URL` 解析绝对 URL。此前已修，本段确认其随新包生效。

## 验证（包内 bundle 标记计数）
| 标记 | 含义 | 计数 |
|---|---|---|
| `dict-menu` | 划词词典工具条 | 5 |
| `检查更新` / `内容更新` | 局域网 OTA UI | 3 / 1 |
| `?ch=` / `cover-chapter-clickable` | 目录点击进阅读 | 2 / 1 |
| CSS `position:sticky` | 悬浮开始阅读 | 5 |

## 真机验收步骤
1. 词条详情页下滑，「开始阅读」吸在底栏上方（P0-1）。
2. 详情页章节目录整行可点，点后直接进对应章（P1-4）。
3. 首页统计数字变大、单位更浅（P1-8）。
4. 阅读页长按选词 → 弹「复制/查询」→ 点查询底部出释义卡（词典）。
5. 「我的 → 内容更新」填电脑地址（需先在 PC 跑 `node scripts/build-update.mjs` + `node scripts/serve-lan.mjs release/latest 8080`）→ 检查更新→立即更新（局域网 OTA）。
