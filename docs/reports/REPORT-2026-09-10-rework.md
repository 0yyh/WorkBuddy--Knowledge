# 阅读页两处缺陷返工报告（2026-09-10）

针对验收后仍未修好的两处缺陷，重新定位根因并修复，已重建 `app-debug.apk` 并验证进包。

---

## ① 系统自带复制未彻底屏蔽（内容重叠 / 重复渲染）

### 根因
上一版只做了两层：
- `MainActivity` 用**反射**调用 `setCustomSelectionActionModeCallback(noop)`（`onCreateActionMode` 返回 `false`），意图抑制系统选择操作栏；
- CSS `.reader-doc { -webkit-touch-callout: none }`。

但用户反馈真机长按仍弹出系统「复制 / 分享」浮动条，并压在阅读内容上造成重叠。问题出在：反射能否命中符号依赖运行环境，一旦个别 ROM/版本绕过该回调，系统浮动工具条照常弹出，与划词卡片重叠。

> 注意：绝不能 `user-select:none` 正文——否则 `window.getSelection()` 不形成，划词词典直接失效。

### 修复（双层保险）
1. 保留原有反射回调（常态下即生效，选区与划词词典不受影响）。
2. **新增 `MainActivity.onActionModeStarted` Activity 重写**（不依赖反射能否找到符号）：
   - 若 `mode.getType() == ActionMode.TYPE_FLOATING`（文本选择浮动工具条即此类型），立即 `mode.finish()`。
   - 本 App 自身无任何原生浮动操作栏（划词卡片是 DOM），结束无副作用。
   - 常态下选择操作栏已被回调抑制、`onActionModeStarted` 不会被调用，**不影响划词词典**（选区仍可用）。
   - 这层是「反射没生效」的兜底，更稳。

### 验证
- `gradlew assembleDebug` → BUILD SUCCESSFUL。
- 编译后 `MainActivity.class` 含 `onActionModeStarted`（已 grep 确认）。
- `TYPE_FLOATING` 是 `int` 常量，被 javac 内联为 `1`，故 class 中搜不到该字符串属正常。

---

## ② 类目计数父子对不上（金融显示 6，子项仅 2+1）

### 根因复核
主轴「主键分区」模型本身**数学正确**。用 Python 复算全树：`count(node) = own(本节点主键归属词条) + Σ children.count`，每个混合节点 `count == own + Σ children`（diff 全 0）。

用户看到的「6 vs 2+1」是因为：**混合节点（既有本类直接词条、又有子分类）的「本类词条」从未在首页折叠树里显式列出**。父级计数包含了它们，但树里只显示了子分类 → 视觉上对不上。

以「金融」为例：
- 直接归属「金融」的词条：`exchange-rate / inflation / interest-rate`（3 条；`labour-theory-of-value`、`surplus-value` 因同时挂在「马克思主义政治经济学」L3 下，按「层级最深者」归属到政治理论，不计入金融，避免跨 L1 重复）。
- 子分类：货币与银行(2) + 资本市场与资产(1)。
- 故 `金融 count = 3 + 2 + 1 = 6`，但树里只看到 `2+1`，缺了那 3 条「本类词条」。

### 修复
1. `AppContext.tsx`：新增 `nodeOwnSlugs`（仅本节点主键归属、不含后代的词条）并入 `StationState`，与现有 `nodeSlugs`（own+后代，供 BrowsePage）同源。
2. `Home.tsx` 的 `CollapsibleCategoryTree`：展开**混合节点**时，先渲染一组「**本类直接词条（N）**」词条链接（指向 `/entry-reader/<slug>`，可直接阅读），再渲染子分类。于是可见项之和 `= own(N) + Σ 子分类 = 父级 count`，**肉眼可对账**。
3. 配套 CSS：`.l3-own-list`（左缘蓝条+缩进）、`.l3-own-head`、`.l3-own-row`（词名前加圆点），复用 `.l3-list` 的入场动画。

### 受影响的混合节点（共 4 个，全部已修）
| 父级 | 本类直接词条 | 子分类 | 合计=父级 |
|---|---|---|---|
| 金融 | 3 | 货币与银行(2) + 资本市场与资产(1) | 6 ✓ |
| 世界史 | 4 | 古代文明(2)+中世纪(3)+近代史(2)+现当代史(3) | 14 ✓ |
| 中国史 | 2 | 先秦至秦汉(1)+魏晋至隋唐(1)+宋元明清(4)+近现代史(2) | 10 ✓ |
| 人类认知与心理 | 3 | 认知过程(1)+心理学分支(2) | 6 ✓ |

纯中间节点（own=0）与叶子节点（无子分类）天然自洽，无需改动。

---

## 构建与验证
- 链路（全部 exit 0 / BUILD SUCCESSFUL）：
  `npm run typecheck` → `npm run copy:content` → `CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run build`（dist 新哈希 `index-BmfKRD7A.css` / `index-DfYCA6O9.js`）→ `npm run android:sync` → `JAVA_HOME=D:/JDK/jdk-19.0.1 ANDROID_HOME="D:/Android SDK" ./gradlew assembleDebug --no-daemon`
- APK 进包验证：CSS 含 `l3-own-list`；JS 含「本类直接词条」；`MainActivity.class` 含 `onActionModeStarted`。
- **产物**：`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`

### 给用户验收
1. 阅读页长按选词 → 不再弹系统复制/分享条，仅出现划词卡片（复制/查询），无内容重叠。
2. 首页展开「金融」→ 可见「本类直接词条(3)」+ 货币与银行(2) + 资本市场与资产(1)，合计 6 与标题一致；其余混合类目同理可对账。
