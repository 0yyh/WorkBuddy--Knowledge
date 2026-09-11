# PKS 阅读页 · 规范对齐 + 浏览器交付（第 5 轮）

> 依据两份文档：`reader-ui-spec.md`（番茄风沉浸/交互复刻）、`reader-modernization-guide.md`（现代化/动效/工作流）。
> 交付方式变更：**仅浏览器 Web 验收，不再打包 APK**（用户明确要求，且 §8 强制浏览器优先）。

## 一、当前实际状况（梳理结论）

对照两份规范，阅读页此前仅做到"功能可用"，存在 5 处偏离：

| 编号 | 问题 | 原状态 | 规范 |
|------|------|--------|------|
| G1 | 沉浸式显隐 | 底部 3 等分导航栏**常驻** | ❌ 底部栏禁止常驻，点中央 toggle |
| G2 | 面板拖拽阻尼 | 仅遮罩/按钮点击关闭 | ✅ 跟手拖拽 + 阈值关闭 |
| G3 | 亮度窗口级遮罩 | `.reader-veil` z=82 < 面板 95，面板不压暗 | ✅ 遮罩须覆盖面板 |
| G4 | 设计 Token | 命名不全、未覆盖规范令牌 | ✅ 统一命名、组件只消费 var |
| G5 | 微交互 | 仅 `:active` 缩放 | ✅ 开关滑片/胶囊滑入/色点脉冲 |

已合规：无 `box-shadow`、扁平、`::selection #E8D3A2`、番茄橙、`--ease-out-expo/--ease-spring`、浮动查词卡。

## 二、本轮修改

1. **沉浸式显隐（G1）** — `styles.css`
   - `.reader-bottom-tabs`（目录/夜间/设置）由常驻改为**默认隐藏**，随 `has-overlay` 淡入（opacity + 8px 微位移），随 `chrome-dismissed` 滚动淡出。状态条保持常驻（符合"默认显示状态栏"）。
2. **亮度窗口级遮罩（G3）** — `styles.css`
   - `.reader-veil` z-index `82 → var(--z-mask)=150`，位于所有面板（95）之上，拖动亮度时面板与正文**同步变暗**；查词浮层走 Portal 且 z=155/160 高于遮罩，始终清晰。
3. **复用 BaseSheet + useSheetDrag（G2/33）** — 新增 `components/sheet/`
   - `useSheetDrag.ts`：Pointer Events 统一鼠标/触摸，阻尼跟随、scroll-vs-drag 判定、位移/速度双阈值关闭、仅 `transform` 走 GPU。
   - `BaseSheet.tsx`：遮罩 + 面板 + 拖拽条 + 标题 + 开/关生命周期（退场动画后卸载，杜绝跳变）。
   - `EntryReaderPage`（目录面板）与 `ReaderSettingsSheet`（设置面板）均改用 `BaseSheet`，手势单一维护点。
4. **设计令牌对齐（G4）** — `tokens.css`
   - 新增规范命名令牌：`--bg-paper/--text-body/--text-title/--accent-orange/--panel-bg/--overlay-dark/--gray-light/--gray-mid`、`--radius-sheet/button/capsule/dot`、`--duration-fast/base/slow`、`--ease-in-out`、`--z-reading/nav/sheet/mask/selection`（均为既有令牌的别名，不破坏现有代码）。
5. **微交互（G5）** — `styles.css`
   - 开关滑块 250ms `ease-out-expo` 滑动 + 背景渐变；胶囊选中缩放滑入；色点选中脉冲（1→1.2→1.12 spring）；按钮/色点/开关补 `:active scale(0.96/0.97/0.9)`。

## 三、验证

- `npm run typecheck`：✅ 0 错误
- `npm run build`：✅ 通过（dist 产出）
- `node scripts/tools/e2e-reader-refactor.mjs`：✅ 全绿（exit 0），含新增 **N2a**（未点中央导航隐藏）、**N2d**（点中央后导航可见）；N3（面板打开时导航仍可见且 z 高于遮罩）维持通过。
- `npm run dev`：✅ 干净启动于 `http://127.0.0.1:5173/`，无 Capacitor 报错、无白屏。

## 四、如何预览验收（浏览器，无需 APK）

```bash
cd apps/web
npm run dev            # 打开 http://localhost:5173
# 浏览器 F12 → 切换设备工具栏（Ctrl+Shift+M）→ 选 Pixel 7 / iPhone 14 / 375×812
```
改完代码 HMR 热更新即时刷新。手势（拖拽面板关闭）桌面鼠标即可调试。

✅ 此改动**全部为 React/CSS/动效**，可在 `npm run dev` 浏览器中直接预览，**无需打包、无需 APK**。
