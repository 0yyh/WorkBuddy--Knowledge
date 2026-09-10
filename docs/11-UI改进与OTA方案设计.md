# UI 改进方案与内容更新可行性设计（V7）

> 状态：分析与方案设计阶段，暂未编码。
> 依据：2026-09-10 真机截图 14 张 + 当前 `apps/web/src` 源码 + `packages/core/src` 索引逻辑。

---

## 1. 当前已实现的基础（V6 速览）

- 底部四 Tab：首页 / 搜索 / 看过 / 我的。
- 自定义中文确认弹窗，替换原生 `window.confirm`。
- 看过页按「今天 / 昨天 / 本周 / 更早」分组 + 进度条。
- 搜索页支持标题匹配 / 全文检索切换、最近搜索 chips、命中高亮。
- 词条详情页 Hero 布局、横向相关词条、sticky「开始阅读」。
- 阅读页目录浮层、拖拽关闭、「读到这里」标记。

当前 APK 约 6.62 MB，构建流水线稳定。

---

## 2. 已确认的两项 Bug：根因与修复方案

### Bug 1：词条详情页「开始阅读」按钮露出橙色小边框

**现象（截图 8、9、10）**
详情页底部的「开始阅读」大号按钮被底部裁切，只露出顶部一道橙色圆角边，像抽屉没有关严。

**根因定位**
当前样式（`styles.css` 第 4520 行）：

```css
.cover-actions { position: sticky; bottom: 10px; margin-top: 18px; }
.btn-start { width: 100%; justify-content: center; }
```

问题出在三点叠加：

1. `position: sticky; bottom: 10px` 让按钮在滚动停止时贴在容器底部，但 `.entry-cover-page` 没有给底部 TabBar + 安全区留足内边距。
2. 移动端 `.app-main` 的底部 padding 是 `calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 20px)`，但 sticky 元素以 `.page` 的 padding-box 为参照，会被 TabBar（固定 60px + safe-area）遮住下半截。
3. 按钮高度较大（padding 15px 18px），被遮住后只剩下顶部圆弧，呈现「一条橙色小边框」。

**修复方案（已确认：方案 B — 始终 sticky 在底部栏上方）**

用户确认按钮需「始终固定在底部栏上方，不随内容滚动消失」，因此采用 sticky 方案，并修正停靠位置：

```css
.cover-actions {
  position: sticky;
  bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 8px);
  margin-top: 18px;
  z-index: 5; /* 低于弹层/阅读浮层，高于卡片内容 */
}
.entry-cover-page {
  padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 88px);
}
```

要点：

1. `bottom` 必须 ≥ 底部 TabBar 高度 + 安全区，否则按钮会落在固定 TabBar 的垂直区域内被其（z-index 更高）裁切——这正是当前「只露橙色小边框」的根因。
2. `.entry-cover-page` 的底部内边距要预留「TabBar + 安全区 + 按钮高度(≈56px) + 间距」，保证滚动到最底部时按钮落在内容末尾而非压住最后一段文字。
3. 给 `.cover-actions` 加 `z-index: 5`，使其在正常内容之上、但低于阅读浮层/确认弹窗，避免覆盖层次错乱。
4. 按钮视觉上加一层极淡的顶部分隔线或轻微阴影，让「悬浮操作条」与正文区分更清晰（见 §3.6 视觉打磨）。

---

### Bug 2：首页类目标签词条数统计错误

**现象（截图 1、14）**
「马克思主义」右侧显示 **12 条**，展开后下方子类目为：

- 政治思想：3
- 政治学概念：3
- 政体与国家制度：3
- 马克思主义：3

合计 `3+3+3+3 = 12`，看起来一致；但用户反馈「实际只展示 8+3 条」。这说明某个子类目下的实际词条存在重复归属，或父类与子孙类之间共享了词条，导致展开后见到的真实不重复词条数少于父类数字。

**根因定位**
当前统计逻辑在 `apps/web/src/state/AppContext.tsx` 第 55–74 行：

```ts
function buildCategoryViews(
  nodes: TaxonomyNode[],
  counts: Map<string, number>,
): CategoryView[] {
  const walk = (node: TaxonomyNode): CategoryView => {
    const children = (node.children ?? []).map(walk);
    const total =
      (node.entrySlugs?.length ?? 0) + children.reduce((sum, c) => sum + c.count, 0);
    counts.set(node.id, total);
    return {
      id: node.id,
      title: node.title,
      path: node.path,
      level: node.level,
      count: total,
      children,
    };
  };
  return nodes.map(walk);
}
```

问题：`total` 是「直接归属词条数 + 所有子节点 count 的算术和」。

- 若同一个 slug 同时挂在「马克思主义」父节点和「马克思主义/政治思想」子节点，会被计两次。
- 若一个 slug 同时属于两个兄弟子节点，也会被计两次。

而详情页 / 浏览页的真实列表使用 `BrowsePage.tsx` 的 `collectSlugs`，它会递归收集并 **按 slug 去重**：

```ts
function collectSlugs(node: TaxonomyNode, acc: string[] = []): string[] {
  for (const s of node.entrySlugs ?? []) if (!acc.includes(s)) acc.push(s);
  for (const child of node.children ?? []) collectSlugs(child, acc);
  return acc;
}
```

因此用户看到的「实际只展示 8+3 条」就是去重后的真实数量，而首页数字是未去重的「标签计数」，两者口径不一致。

**修复方案**

把 `buildCategoryViews` 的 `count` 口径改成「该节点及所有子孙节点下的不重复 slug 数量」，与 `BrowsePage.collectSlugs` 完全一致。

实现草图：

```ts
function buildCategoryViews(
  nodes: TaxonomyNode[],
  counts: Map<string, number>,
): CategoryView[] {
  const walk = (node: TaxonomyNode): CategoryView => {
    const children = (node.children ?? []).map(walk);
    const unique = new Set<string>(node.entrySlugs ?? []);
    for (const c of children) {
      // 每个子节点已经去过重，但这里仍要再次合并去重
      const childSet = collectSlugsSet(/* 从子 TaxonomyNode 取 */);
      for (const s of childSet) unique.add(s);
    }
    const total = unique.size;
    counts.set(node.id, total);
    return {
      id: node.id,
      title: node.title,
      path: node.path,
      level: node.level,
      count: total,
      children,
    };
  };
  return nodes.map(walk);
}
```

更工程化的做法：

1. 在 `packages/core` 的 `TaxonomyNode` 类型已知前提下，写一份与 `BrowsePage.collectSlugs` 同构的递归函数 `collectUniqueSlugs(node)`，返回 `Set<string>`。
2. `buildCategoryViews` 在计算 `total` 时调用该函数，保证首页、分类浏览页、类目树三个地方数字一致。
3. 把 `categoryCounts` 的口径一并统一，避免未来其它页面复用时再次错位。

**确认口径（用户已确认：按去重后的不重复词条数量统计）**

- **去重范围 = 以该类目节点为根的子树内所有 `entrySlugs` 的并集**。即 `count(node) = | ∪{ node.entrySlugs, 所有子孙.entrySlugs } |`。
- 这与 `BrowsePage.collectSlugs(node)` 的口径**完全一致**：点击该类目后看到的词条列表数量，必须等于首页显示的数字。
- **跨顶级分类（L1）的重复各自计数**：若同一词条同时挂在「哲学」和「经济学」两个顶级分支下，它在「哲学」和「经济学」里分别计 1 次；全局唯一词条总数仍由 `manifest.stats.entries` 负责（不重复）。这样保证每个标签数字都等于「点进去看到的真实条数」，且顶层计数之和可以大于全局不重复词条数（属预期）。
- 实现：在 `AppContext.tsx` 内写一份与 `collectSlugs` 同构的 `collectUniqueSlugs(node): Set<string>`，`buildCategoryViews` 递归时用它算 `count`，并同步更新 `categoryCounts` Map。

**影响面**

- `categoryViews` 中每个节点的 `count` 会变小（去重后），与真实列表一致。
- L1 分类卡片（历史 28 词条、哲学 17 词条等）数字也会同步变化。
- 需要去重算法的时间复杂度为 O(n)，84 个词条的树完全可以忽略性能。

**建议落地**：修正 `AppContext.tsx` 的 `buildCategoryViews`，并补充单测断言首页数字等于 `collectSlugs(...).length`。

---

## 3. 基于截图的 UI/UX 改进提案

### 3.1 首页（截图 1、14）

| 优化点 | 当前问题 | 具体方案 | 优先级 |
|----|----|----|----|
| 统计卡呼吸感 | 四格数字与单位间距偏紧，视觉上挤在一起 | `.stat-card` 增加 `gap: 4px`，数字字号从 `1.0625rem` 提到 `1.25rem`，单位颜色调淡 | P1 |
| 续读卡片视觉 | 箭头与文字垂直对齐略飘 | 把 `.resume-arrow` 换成右箭头图标并垂直居中；进度文字右对齐 | P2 |
| 全部分类展开态 | L2 行点击热区只有标题左侧，右侧 count 与 caret 之间容易误触 | 让 `.l2-head-main` 占满除 caret 外的全部宽度；caret 单独做 44×44 触摸区域 | P1 |
| 空分类提示 | 叶子类目提示「该分类下 x 条词条直接归属」以段落展示，打断列表 | 改成 `.l2-empty-note` 使用小号淡色标签样式，放在 L2 行下方缩进 | P2 |
| 时间线卡片 | 品牌色背景上白色文字对比度足够，但副标题行高略低 | `.timeline-card-sub` 行高提到 `1.6`，pills 增加 2px 间距 | P2 |

### 3.2 搜索页（截图 2）

| 优化点 | 当前问题 | 具体方案 | 优先级 |
|----|----|----|----|
| 结果默认不展示摘要（已确认） | 全文检索默认只展示词条标题和命中次数，避免列表过长 | 默认隐藏摘要；在结果区顶部提供「展开全部摘要 / 收起摘要」切换按钮 | P1 |
| 摘要展示规则（已确认） | 展开后摘要较长需控制长度 | 每条摘要 `clamp-2`（最多 2 行），命中关键词用 `<mark className="hl">` 高亮；无摘要则不渲染该行 | P1 |
| 关键词提示冗余 | 「关键词：北京 · 全文检索模式」占了一行 | 删除关键词提示，把模式说明移到 Segmented 按钮的副标题或 tool-tip；页面更干净 | P2 |
| 最近搜索可管理 | 只能点、不能删单个记录 | 每个 chip 右侧加 ×，支持删除单条；增加「清空最近搜索」入口 | P2 |
| 搜索结果空状态 | 空查询时仅展示最近搜索，缺少热门 / 推荐入口 | 空查询可展示「随机词条」或「最近更新」3 条，引导用户 | P3 |

### 3.3 看过页（截图 3）

| 优化点 | 当前问题 | 具体方案 | 优先级 |
|----|----|----|----|
| 进度条可见性 | 当前进度条很细且颜色浅，截图几乎不可见 | `.history-progress` 高度从 2px 加到 4px，背景用 `var(--brand-soft)`，填充用 `var(--brand)`；圆角 2px | P1 |
| 单条操作 | 只能点击进入，无法删除单条 | 增加长按 / 左滑删除单条（需要交互组件）；V7 可先上「长按出现删除」 | P3 |
| 时间精度 | 「1 分钟前」精确度足够，但同一天多条会堆叠 | 同一天内按时间倒序即可，无需额外改动 | — |

### 3.4 我的页（截图 4）

| 优化点 | 当前问题 | 具体方案 | 优先级 |
|----|----|----|----|
| 增加内容更新入口 | 后续 OTA/导入功能需要入口 | 在 me-list 增加「导入内容包」行，icon 用 ↓；点击进入导入流程 | P1 |
| 增加版本信息 | 当前关于已展示版本和构建日期，但缺少「检查更新」动作 | 在「版本」行右侧增加文字按钮「检查」；离线模式下可显示「离线包，无法在线检查」 | P2 |
| 头像视觉 | 「知」字头像与顶栏 logo 重复 | 可保留，但增加品牌渐变背景与白色文字， already 如此；可再放大 2px 增加存在感 | P3 |

### 3.5 设置页（截图 5、6、7）

| 优化点 | 当前问题 | 具体方案 | 优先级 |
|----|----|----|----|
| 动画命名混淆 | 系统级「页面动画」和阅读级「翻页动画」容易让用户以为重复 | 系统级改为「切页动画」，阅读级保持「翻页动画」，并在行末加小字说明 | P2 |
| 危险区视觉 | 当前危险区底色偏粉，截图里与上方卡片区分度一般 | 危险区左侧加 4px 竖条危险色，标题前加 ⚠ 图标 | P2 |
| 设置行 label 小圆点 | label 前的小圆点与右侧控件间距略远 | 把圆点缩小到 4px，间距保持 8px；或改用更淡的圆点 | P3 |

### 3.6 词条详情页（截图 8、9、10）

| 优化点 | 当前问题 | 具体方案 | 优先级 |
|----|----|----|----|
| 开始阅读按钮（Bug 1） | 露出橙色小边框 | 见第 2 节，改为文档流按钮 + 底部安全内边距 | P0 |
| 元信息卡 | 4 格元信息在窄屏换行拥挤 | 当宽度 < 360px 时改为 2×2 网格，保证每格标签不折行 | P2 |
| 章节目录可点击 | 当前目录只展示，不能跳转 | 给 `.cover-chapter-row` 加 `cursor: pointer` 和 hover 背景，点击跳转到阅读器对应章节 | P1 |
| 相关词条空状态 | 若相关词条为空，整块消失，用户不知道有此功能 | 空时显示一行淡色提示「暂无相关词条」或推荐 3 条同分类词条 | P3 |
| 类目路径 | 类目以 chip 展示，路径完整但较长 | 保持不变，但窄屏时允许 chip 内文本截断 | P3 |

### 3.7 阅读页目录与设置浮层（截图 11、12、13）

| 优化点 | 当前问题 | 具体方案 | 优先级 |
|----|----|----|----|
| 目录搜索 | 当前目录顶部有搜索框，但截图中未显示过滤结果样式 | 目录搜索应支持按标题过滤，无结果时显示「未找到章节」；可尝试拼音首字母匹配（P3） | P1 |
| 亮度滑块（番茄小说风格） | 当前为细灰轨 + 白圆 thumb，无图标、无实时预览 | 轨道左暗灰右暖黄渐变；两端加 ☾ / ☀ 图标；thumb 放大到 22px 并带阴影；拖动时实时改变 `.reader-veil` 不透明度；点击轨道任意位置跳转 | P2 |
| 字号步进器 | A-/A+ 与中间数字「3」组合不直观 | 改为三段式 pill：小 / 默认 / 大 / 特大，与全局字号保持一致 | P2 |
| 更多设置开关 | 自定义 toggle 在深色背景下对比度不足 | 增加切换动画；active 状态 thumb 用白色，轨道用品牌色 | P2 |
| 单手模式提示 | 当前仅说明「点击左右两侧翻下一页」 | 增加示意图或首次开启时 toast 提示 | P3 |

### 3.8 全局细节

| 优化点 | 具体方案 | 优先级 |
|----|----|----|
| 页面切换动画节奏 | 当前 `slide-in` 0.24s 偏快，可适当延长到 0.28s 并加 `cubic-bezier(0.22, 0.61, 0.36, 1)` | P2 |
| Toast 位置 | 当前 toast 在底栏上方，但部分页面可能被遮挡 | toast 与底栏间距改为 `calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 12px)` | P2 |
| 深色模式 TabBar | active 项颜色 `#f5b281` 在深底上偏暗 | 改为更亮的 `#ffcc99` 或 `#ffe0c2` | P2 |
| 空状态插画 | 各页面空状态都是纯文字，可统一使用一个简洁插画占位符 | P3 |

---

## 4. App 内内容更新方案（无需重装 APK）

### 4.1 目标

后续新增/修改词条后，用户只需在 App 内导入新的内容包，即可更新索引与正文，无需重新下载安装 APK。

### 4.2 约束

- 离线优先：默认不依赖公网。
- 内容资产当前被打包进 `public/content`，随 APK 发布，是只读的。
- 已声明 `INTERNET` 权限（`AndroidManifest.xml` 第 41 行），但核心体验应保持离线。
- 尽量不引入新的重量级依赖；Capacitor 官方插件可接受。

### 4.3 推荐方案（已确认层级）：应用内一键更新为主，本地导入与局域网同步为辅

用户明确：本地导入内容包与重新安装 APK「同样繁琐」，要求一个**更轻量**的方式。结论是——**最省事的方式是让 App 自己联网拉取更新，用户在 App 内点一下即可完成**。当前 `AndroidManifest.xml` 已声明 `INTERNET` 权限（第 41 行），因此网络下载无障碍，但默认更新服务器地址留空、不做任何静默上报，离线优先原则不受影响。

#### 方案 A（主方案 · 最轻量）：应用内「检查更新 / 一键下载」

**流程**

1. 在「我的 → 关于」展示当前 `built_at` 与版本；提供「检查更新」按钮。
2. 点击后，App 向一个**用户可配置的 URL**（默认空）`GET` 远程 `manifest.json`。
3. 比较远程 `built_at` / `version` 与本地；若更新则弹层展示「新增 X 词条 / 修改 Y / 删除 Z」与体积。
4. 用户点「下载更新」→ App 下载一个**增量/全量 zip**（或按 `manifest` 列出的文件逐一下载）到 App 私有数据目录。
5. 校验（大小 / 可选 sha）通过 → 解压 → 替换 → `StationProvider.reload()`。
6. 完成后 toast「内容已更新，共 xx 词条」，关于页展示新 `built_at`。

**为什么比两者都轻**

- 用户零文件操作、零 PC、零安装器：打开 App → 点一下 → 等进度 → 完成。
- 比本地导入少了「生成/传文件/选文件」三步；比重装 APK 少了「卸载/安装/重签名」整条链路。

**技术要点**

- 下载用原生 `fetch`（需远程主机开启 CORS），或 `@capacitor/community/http`（CapacitorHttp，绕过 CORS）。**默认推荐 fetch + CORS 友好静态托管**（GitHub Pages / Cloudflare Pages / 任意对象存储），避免再引一个插件。
- 持久化写入用 `@capacitor/filesystem`（`Directory.Data`，App 私有、持久、不备份）。
- 加载层在 `loader.ts` 增加 `getContentRoot()`：运行期若私有目录存在 `content/`，则用之，否则回退 assets。
- URL 配置项存 `localStorage`（如 `pks_updateUrl`），默认空字符串；为空时「检查更新」提示「未配置更新源」。

#### 方案 B（离线备用）：本地文件导入

保留作为**无网 / 隐私敏感**场景的兜底。用户把 `.pks` 放到手机后，**用 Web 标准 `<input type="file" accept=".pks,.zip">` 唤起系统文件选择器**（Android WebView 原生支持），无需再引 `@capacitor/file-picker` 插件。选中后 `await file.arrayBuffer()` → JS 解压（浏览器 `DecompressionStream`）→ `@capacitor/filesystem` 写入。其余校验/回滚与方案 A 共用。

#### 方案 C（可选）：局域网同步

适合作者用 PC 频繁改稿：`npx serve content/`，App 同一 WiFi 下手动输入 IP 或扫码拉取。实现复杂度最高，作为**后续可选增强**，不在 MVP 范围。

### 4.4 更新包格式建议

```
update-2026-09-10.pks  (zip)
  ├── content/
  │   ├── index/
  │   │   ├── manifest.json        # 含 built_at / version / 文件清单(可选)
  │   │   ├── taxonomy.json
  │   │   ├── search/
  │   │   ├── entries/
  │   │   └── tracks.json
  │   └── entries/
  │       └── {slug}/...
  └── sha256.txt                 # 可选：整包校验
```

> 版本比较以 `manifest.built_at`（ISO 时间戳）为主键，`version` 仅展示用。

### 4.5 最小可行实现路径（MVP）

1. **新增 `@capacitor/filesystem`** 并完成 `cap sync android`（用户已确认接受）。
2. **双层加载**：`loader.ts` 增加 `getContentRoot()`，私有目录优先、assets 兜底。
3. **新增 `contentUpdater.ts`**：
   - `checkUpdate(url)` → 拉远程 manifest、比较版本。
   - `downloadAndApply(url | File)` → 下载/解压/校验/替换，返回进度回调。
   - `rollback()` → 失败恢复 `content.bak/`。
4. **UI 入口**：「我的 → 关于」增加「检查更新」+ 更新源 URL 设置；导入流程复用同一套下载/解压/校验逻辑。
5. **反馈**：进度弹层（校验 → 下载 → 解压 → 重建索引 → 完成）+ 完成 toast。
6. **回滚**：替换前备份私有 `content/` 到 `content.bak/`。

### 4.6 与当前红线的关系

- **唯一新增插件**：`@capacitor/filesystem`（持久化写入）。文件**选择**用原生 `<input type="file">`，不再额外引入插件。
- 下载默认用标准 `fetch`，**不新增 HTTP 插件**；仅在远程无 CORS 时再考虑 `@capacitor/community/http`。
- 不引入前端框架 / UI 库，不违反「纯 CSS、无 Tailwind、无 React Router」约束。
- `INTERNET` 权限已存在，方案 A 不需新增 Android 权限。
- 工程红线（禁止 pnpm、`npm install` 会破坏 `@pks/core` junction）仍适用：新增插件后用 `npm install`，并手动重建 `apps/web/node_modules/@pks/core` 的 junction。

### 4.7 一键更新技术实现细节（开发前需准备的基础设施）

#### 请求方式

- **方法**：`GET`。
- **地址**：用户在「我的 → 关于 → 更新源 URL」中配置的字符串，默认空。
- **路径**：App 自动拼接 `/manifest.json`，即 `{url}/manifest.json`。
  - 示例：`https://pks.example.com/release/2026-09-10/manifest.json`。
- **参数**：无查询参数；若后续需要鉴权，可在 URL 中内嵌 token，或改为请求头（需要 CORS 暴露 `Authorization`）。
- **鉴权（MVP 阶段）**：建议**不鉴权**，内容包本身公开可读即可；如需保护，使用 URL 路径中的随机 token 或 Cloudflare Access。
- **CORS**：远程服务器必须返回 `Access-Control-Allow-Origin: *`（或 App 所在 origin），否则标准 `fetch` 会被浏览器拦截。若无法改服务器，再引入 `@capacitor/community/http` 绕过 CORS。

#### URL 返回的数据格式

`manifest.json` 与 App 本地 `content/index/manifest.json` 字段兼容，并增加更新元信息：

```json
{
  "version": "0.2.0",
  "built_at": "2026-09-10T12:00:00.000Z",
  "content_url": "https://pks.example.com/release/2026-09-10/content.zip",
  "package_size": 3145728,
  "package_sha256": "a1b2c3...",
  "diff": {
    "entries": 6,
    "modified": 2,
    "removed": 0
  }
}
```

字段说明：

- `version`：内容版本号，仅展示用。
- `built_at`：构建时间 ISO 字符串，**主键**：与本地 `manifest.built_at` 比较，新则提示更新。
- `content_url`：zip 包直链，App 用 `fetch` 下载。
- `package_size`：字节数，用于展示体积与校验下载完整性。
- `package_sha256`：整包校验值；MVP 可选，提供则校验，失败回滚。
- `diff`：用户友好的变更统计，弹层展示。

#### 更新触发条件

- **手动触发（默认）**：用户进入「我的 → 关于」点击「检查更新」。
- **启动时检查（可配置，默认关闭）**：`localStorage` 项 `pks_autoCheckUpdate` 为 `true` 时，App 启动后 2 秒静默拉 manifest；仅当有新版本时才弹层打扰用户。
- **定时检查**：暂不建议；离线优先 App 不应在后台唤醒网络。如需做，建议用户手动触发。

#### 下载与安装流程

1. 校验 URL 非空 → `fetch(url)` → 解析 JSON。
2. 比较 `built_at` > 本地 `built_at`。
3. 弹层展示版本、体积、变更统计 → 用户确认。
4. `fetch(content_url)` → 下载 `content.zip` 到内存或临时文件（`Directory.Cache`）。
5. 校验 `package_size` / `sha256`（若提供）。
6. 备份本地私有 `content/` → `content.bak/`。
7. JS 解压 zip（`DecompressionStream`）→ 按目录结构写入 `Directory.Data/content/`。
8. 校验解压后的 `manifest.json` 可读。
9. `StationProvider.reload()` → 重新加载索引与正文。
10. 失败：删除 `content/`，还原 `content.bak/` → 弹出失败提示。

#### 开发前需准备的基础设施

| 项目 | 要求 | 说明 |
|----|----|----|
| 服务器 | 任意静态托管 | GitHub Pages / Cloudflare Pages / Vercel / 对象存储（OSS/S3）均可 |
| 域名 | 可选 | 使用免费 Pages 子域名即可；建议配置 HTTPS |
| HTTPS | **建议必须** | Android 9+ 默认禁止明文 HTTP；若用 HTTP 需 `android:usesCleartextTraffic="true"` |
| 接口 | 仅静态文件 | 不需要后端 API；只需能 `GET manifest.json` 与 `content.zip`，并开启 CORS |
| 构建脚本 | CLI 生成发布包 | 在 `packages/cli` 增加 `publish` 命令：把 `content/` 打包成 `content.zip` + 生成带 `package_sha256` 的 `manifest.json`，上传到指定目录 |

#### 极简示例目录结构

```
https://pks.example.com/release/
  ├── latest/
  │   ├── manifest.json      # 永远指向最新版本
  │   └── content.zip
  └── 2026-09-10/
      ├── manifest.json
      └── content.zip
```

App 默认可配置 `https://pks.example.com/release/latest/` 作为更新源。

### 4.8 亮度条 UI 优化（番茄小说风格）

根据截图，当前亮度条为原生 `<input type="range">` 样式：细灰轨 + 白圆 thumb，无实时反馈、无图标。目标对齐番茄小说：

- **轨道**：从左到右由暗灰 → 暖黄渐变，暗示「暗 → 亮」。
- **两侧图标**：左侧月亮/亮度低 `☾`，右侧太阳/亮度高 `☀`（可用 Unicode 或 SVG）。
- **滑块 thumb**：白色大圆（22px），带柔和阴影，垂直居中；拖动时放大 1.1 倍并增加阴影，提供按压反馈。
- **实时预览**：拖动时立即改变 `.reader-veil` 的 `opacity`，用户无需松开即可看到亮度变化。
- **点击轨道跳转**：点击轨道任意位置，thumb 与 veil 立即跳转到对应亮度。
  - 该优化纳入 P2「阅读页亮度滑块、字号步进器」。

### 4.9 局域网本机部署更新方案（详细可行性 + 环境准备）

> 定位：与 §4.7 远程 HTTPS 发布通道**共用同一套 `contentUpdater` 代码**；只是把「更新源 URL」从 `https://...` 换成 PC 局域网地址 `http://<PC-IP>:<port>/`。对 App 而言仍然是 `GET {url}/manifest.json` + `GET {url}/content.zip`，逻辑零改动。因此局域网本机部署**不是新机制，而是同一机制在「URL 不同、传输层为明文 HTTP」下的运行实例**。

#### 4.9.1 作者端环境准备

**已具备（项目现有）**
- Node.js：`C:/Users/Yu/.workbuddy/binaries/node/versions/22.22.2-2/node.exe`（npm 已可用）。
- 项目构建流水线：`npm run copy:content` → `vite build` → `cap sync android` → `gradlew assembleDebug`。
- `INTERNET` 权限已存在（`AndroidManifest.xml` 第 41 行）。

**需要新增/确认**
1. **一个带 CORS 头的静态服务器**。方案三选一，按推荐度排序：
   - **方案 A（推荐，零安装）**：把一条 Node 脚本放进 `scripts/serve-lan.mjs`，不依赖任何 npm 包，直接 `node scripts/serve-lan.mjs ./release-dir` 启动。该脚本显式返回 `Access-Control-Allow-Origin: *`。
   - **方案 B（次选）**：`npx serve ./release-dir`，`serve` 自动带 CORS 头，但首次会下载到 npm cache；符合「不 `npm install -g`」红线。
   - **方案 C（不推荐）**：裸 `python -m http.server 8080`。**默认不带 CORS 头**，WebView `fetch` 会被拦截；如用 Python，必须额外写 handler 注入头。
2. **内容发布目录结构**：每次内容更新后，CLI `publish` 命令在本地生成：
   ```
   ./release/2026-09-10/
     ├── manifest.json      # 含 built_at / content_url / package_size / package_sha256 / diff
     └── content.zip
   ```
   或只保留一个 `release/latest/` 目录（适合调试）。
3. **Android 明文 HTTP 许可**：因为局域网地址通常是 `http://192.168.x.x`，Android 9+ 默认禁止 cleartext，必须改 `AndroidManifest.xml`。

#### 4.9.2 PC 端操作步骤（首次部署）

1. **生成本地更新包**
   ```bash
   # 在项目根目录
   npm run copy:content
   npm run build
   # 下面这条 publish 命令需要在 packages/cli 实现；当前还未实现，属于后续编码内容
   node packages/cli/dist/cli.js publish --out ./release/latest
   ```
   输出 `./release/latest/manifest.json` + `./release/latest/content.zip`。

2. **启动本地 HTTP 服务**
   ```bash
   # 方案 A：零依赖脚本（建议后续代码阶段实现）
   node scripts/serve-lan.mjs ./release/latest
   # 控制台打印：Serving http://0.0.0.0:8080
   ```
   或方案 B：
   ```bash
   npx serve ./release/latest -l 8080
   ```

3. **查看 PC 局域网 IP**
   - Windows：`ipconfig | findstr "IPv4"` → 例如 `192.168.31.42`。
   - macOS/Linux：`ifconfig | grep "inet "` 或 `ip addr`。
   - 建议把 PC 在路由器上设为静态 DHCP 租约 / 固定 IP，避免每次重新输入。

4. **手机浏览器验证**
   - 手机连同一 WiFi，浏览器访问 `http://192.168.31.42:8080/manifest.json`。
   - 若能看到 JSON，说明网络、防火墙、CORS 均 OK；若连接失败，先排查防火墙 / AP 隔离。

#### 4.9.3 Android 端配置

1. **开启明文 HTTP（必须）**
   修改 `apps/web/android/app/src/main/AndroidManifest.xml` 的 `<application>`：
   ```xml
   <application
       android:allowBackup="true"
       android:icon="@mipmap/ic_launcher"
       android:label="@string/app_name"
       android:roundIcon="@mipmap/ic_launcher_round"
       android:supportsRtl="true"
       android:theme="@style/AppTheme"
       android:usesCleartextTraffic="true">
       ...
   </application>
   ```
   改后必须重新 `gradlew assembleDebug` 打新 APK。

2. **（可选）更精细的 network-security-config**
   如果担心 `usesCleartextTraffic="true"` 范围太宽，可以改用 `res/xml/network_security_config.xml` 只放行 `192.168.0.0/16`、`10.0.0.0/8`、`172.16.0.0/12` 三个私网段。但首次验证时建议用简单粗暴的全局开关，降低排查面。

3. **App 内填入更新源 URL**
   在「我的 → 关于 → 更新源 URL」输入：
   ```
   http://192.168.31.42:8080/
   ```
   注意末尾斜杠；App 会再拼 `/manifest.json`。

#### 4.9.4 后续更新流程（局域网内）

1. PC 端改稿 → 重新执行 `publish --out ./release/latest` 覆盖 manifest + content.zip。
2. 手机端打开 App → 「我的 → 关于 → 检查更新」→ `fetch http://192.168.31.42:8080/manifest.json`。
3. 比较 `built_at`，新则弹层确认 → 下载 `content.zip` → 校验 sha256/size → 备份 `content/` → 解压 → `StationProvider.reload()`。
4. 失败：删除新 `content/`，恢复 `content.bak/`。

> 整个流程与远程 HTTPS 完全一致；区别只是 URL 和 Android 需要额外允许明文 HTTP。

#### 4.9.5 必须提前准备的环境、配置与注意事项清单

| 项目 | 状态 | 操作 |
|----|----|----|
| 同一路由器/WiFi | 必须 | 手机与 PC 连同一局域网；手机浏览器先访问 manifest.json 验证 |
| 静态服务器 + CORS | 必须 | 用 `scripts/serve-lan.mjs` 或 `npx serve`；禁止裸 `python -m http.server` |
| Windows 防火墙放行 | 必须 | 首次运行 Node 服务时弹窗点「允许」；或在防火墙高级设置里加 8080 入站规则 |
| Android `usesCleartextTraffic` | 必须 | 改 `AndroidManifest.xml` 并重新打包 |
| 固定 PC IP / DHCP 静态租约 | 强烈建议 | 否则每次 PC 重连 WiFi IP 可能变化，需手动改 App 里的 URL |
| 更新包生成脚本 `publish` | 编码阶段实现 | 在 `packages/cli` 增加命令：生成 `manifest.json` + `content.zip` |
| sha256/size 校验 | 建议 | 局域网无 TLS，靠 sha256 防篡改；`manifest.json` 里写死校验值 |
| AP 隔离排查 | 注意 | 若手机浏览器访问 PC IP 失败，检查路由器是否开启「AP 隔离/客户端隔离」 |
| 公共 WiFi 限制 | 注意 | 公共/校园 WiFi 通常禁止客户端互访，此方案只适用于家庭/个人局域网 |
| 内容版本主键 | 沿用 | 仍用 `manifest.built_at`（ISO 时间）比较；新则更新 |

#### 4.9.6 潜在限制与失败场景

- **网络环境**：仅限同一局域网；跨网/公网不可用；公共 WiFi 隔离可能连不通。
- **设备兼容**：`DecompressionStream` 需 Android 10+ WebView（一般 OK）；旧机型需 polyfill。
- **安全性**：局域网明文 HTTP 无 TLS，内容可被同网嗅探/篡改；sha256 能防篡改但不加密，不适宜公共/不可信网络。
- **依赖人工**：PC 必须开机且服务在运行；无法「用户自助随时更新」。
- **无治理**：无鉴权、无并发、无日志，仅适合个人单机调试/自用。

#### 4.9.7 与远程方案对比

| 维度 | 局域网本机部署 | 远程 HTTPS 静态托管 |
|----|----|----|
| 基础设施 | 0 成本，PC 做服务器 | GitHub/Cloudflare Pages / OSS，可能需要域名 |
| 网络要求 | 同局域网 + PC 在线 | 任意网络（有网即可） |
| Android 配置 | 必须 `usesCleartextTraffic="true"` | 无需 cleartext，HTTPS 天然受信 |
| CORS | 需服务器显式返回头 | 托管商默认或手动配置 |
| 安全性 | 明文，仅限可信私网 | TLS，适合分发 |
| 更新触发 | 作者手动起服务 + 用户手动点检查 | 作者上传后用户随时一键检查 |
| 适用阶段 | **作者调试/家庭内快速迭代** | **正式发布/长期分发** |
| App 代码改动 | 无，仅 URL 不同 | 无 |

#### 4.9.8 结论

**完全可行**。局域网本机部署不需要写任何新 App 代码，只需要：
1. 一个带 CORS 的本地静态服务器；
2. AndroidManifest 开启明文 HTTP；
3. App 里把更新源 URL 改成 PC 局域网 IP。

它的最佳定位是**作者个人调试与家庭内快速迭代通道**：写稿→打包→起服务→手机秒更新，无需上传公网。对正式用户分发，仍建议用远程 HTTPS 静态托管（GitHub Pages / Cloudflare Pages / OSS）。

---

## 5. 下一步建议

按优先级排序，建议按以下顺序落地：

1. **P0 - Bug 修复**
   - 修复「开始阅读」按钮裁切（已确认为方案 B：始终 sticky 在底栏上方，修正 `bottom` 与详情页底部内边距）。
   - 修复类目统计口径（子树去重计数，与浏览列表一致）。
2. **P1 - 体验补全**
   - 搜索页结果默认不展示摘要，提供「展开全部摘要」切换；展开后 `clamp-2` 高亮。
   - 看过页进度条可见性增强。
   - 详情页章节目录可点击跳转。
   - 我的页「关于」增加「检查更新」+ 更新源 URL 设置。
   - 阅读页离线词典：复制 + 查询（见 §8）。
3. **P2 - 视觉打磨**
   - 设置页动画命名、危险区视觉。
   - 阅读页亮度滑块（番茄小说风格：渐变轨道 + 图标 + 实时预览）、字号步进器。
   - 深色模式 TabBar active 色。
4. **P3 - 内容更新能力**
   - 接入 `@capacitor/filesystem`，实现双层加载（私有目录优先、assets 兜底）。
   - 实现应用内「检查更新 / 一键下载」（主）+ 本地文件导入兜底（`<input type="file">`）。
   - 可选实现局域网同步。

---

## 6. 已确认设计决策（2026-09-10）

| # | 决策点 | 结论 |
|----|----|----|
| 1 | 「开始阅读」按钮 | **始终 sticky 固定在底部栏上方**（方案 B），停靠 `bottom ≥ tabbar+safe-area+8px`，并给详情页底部预留按钮高度内边距 |
| 2 | 类目计数 | **按去重后的不重复词条数**统计；口径 = 该节点子树内所有 entrySlugs 的并集大小，与 `BrowsePage.collectSlugs` 完全一致；跨 L1 各自计数、全局去重由 `manifest.stats.entries` 负责 |
| 3 | `@capacitor/filesystem` | **接受新增**，用于更新包的持久化写入；文件选择改用原生 `<input type="file">`，不再额外引插件 |
| 4 | 内容更新方式 | 比本地导入/重装 APK 更轻量 = **应用内一键「检查更新 / 下载更新」**（HTTP 拉取，URL 可配置、默认空）；本地文件导入降为无网兜底；局域网同步为后续可选增强 |
| 5 | 搜索摘要 | 默认**不展示**摘要；提供「展开全部摘要 / 收起摘要」切换；展开后每条摘要 `clamp-2`（≤2 行）并高亮命中词 |
| 6 | 阅读页词典 | **仅保留词典**，去掉生词本与划词标注；功能仅限**复制 + 查询**；UI 对齐番茄小说截图的浮动工具条风格 |
| 7 | 局域网更新 | **完全可行**，定位为作者调试/家庭快速迭代通道；需准备 CORS 静态服务 + `usesCleartextTraffic="true"` + 固定 PC IP |

**尚未覆盖、留待实现时处理的细节**

- 增量 vs 全量 zip 的取舍（首版建议全量，简单可靠）。
- 更新包是否需要签名校验（MVP 先用 sha256 可选校验，不强签名）。
- 作者侧发布脚本：在 `packages/cli` 增加 `publish` 命令，自动生成带 `package_sha256` 的 `manifest.json` 与 `content.zip`。
- 词典数据源：PRD R-20 计划的三套词库，还是先用一个最小 Demo 词表验证链路？
- 词典查询面板：底部半屏卡片 vs 跟随选区的小卡片？

---

## 7. 阅读页缺陷分析：点击屏幕有时无法唤起底部栏

**现象**：部分情况下点击正文区域，底部操作栏（目录 / 夜间 / 设置）不出现。

**已读代码定位**（`apps/web/src/pages/EntryReaderPage.tsx` 全文 805 行 + `styles.css`）：

- 点击处理 `onSurfaceClick`（约 449–480 行）逻辑：
  1. `e.target.closest('a, button, input, textarea, select, label, [data-control]')` 命中 → 直接 `return`，不切换浮层。
  2. `settingsOpen` / `chapterOpen` / `overlay` 已开 → 各自收起 / 切换。
  3. 读 `rootRef` 的 `getBoundingClientRect()`；若 `rect.width === 0` → `setOverlay(true)` 返回。
  4. 计算点击横向比例 `ratio`：`< 0.26` 上一页、`> 0.74` 下一页、**只有中间 0.26–0.74 区才 `setOverlay(true)` 唤起浮层**。
- 浮层显隐：`.reader-bottom` / `.reader-top` 默认 `opacity:0; pointer-events:none`，仅 `.reader-root.has-overlay` 时可见；滚动时加 `.chrome-dismissed` 隐藏 chrome，停滚约 1.8s 后自动显隐（仅当 overlay 关闭时）。
- 手势：`onTouchStart/End` 处理滑动翻页（`|dx| > 60` 视为翻页）。

**可能的触发原因（按可能性排序）**

1. **点到正文内的交互元素**：`.prose` 中的脚注引用、内部锚点、目录链接、图片说明、甚至「读到这里」标记等是 `a/button`，被 `closest()` 命中 → 函数提前返回，浮层不切换。用户「点文字没反应」多半是点到了内联链接。
2. **点在左右 26% / 74% 边缘区**：该区域被解读为「翻页」而非「切换浮层」，只有中间区才能唤起底部栏。用户若习惯点屏幕两侧，会感觉「点了没反应」（实际是翻了页）。
3. **`chrome-dismissed` 与 `has-overlay` 的 CSS 优先级冲突**：滚动后 chrome 被 `chrome-dismissed` 隐藏；若随后点击把 `overlay` 置 true（加 `has-overlay`），但 CSS 中 `.chrome-dismissed .reader-bottom { opacity:0 }` 的优先级 / 顺序压过 `.has-overlay .reader-bottom { opacity:1 }`，则浮层状态已开、栏却仍隐藏——表现为「点了但栏不出现」。
4. **手势被吞为滑动**：轻微移动的「点按」被 `touch` 处理判定为滑动（dx 接近阈值）或浏览器判定为小滚动，导致 `click` 事件未派发，`onSurfaceClick` 根本不触发。
5. **`rect.width === 0` 边界**：转场 / 重排瞬间 `getBoundingClientRect` 读宽为 0，走 `setOverlay(true)` 分支——该分支其实会显示栏，不是 blocker，但说明点击时机在尺寸未就绪时逻辑分叉。

**排查方向**

- **埋点定位**：在 `onSurfaceClick` 临时 `console.log`：命中 `closest` 的标签、`ratio`、当前 `overlay/settingsOpen/chapterOpen`、以及 `rootRef` 是否带 `chrome-dismissed`。用 WebView 远程调试或 `adb logcat` 抓日志，复现时点几下看日志。
- **CSS 优先级核查**：在 `styles.css` 中检索 `.reader-bottom`、`.reader-top`、`.has-overlay`、`.chrome-dismissed` 四条规则的定义顺序与选择器权重，确认 `has-overlay` 显式覆盖 `chrome-dismissed`（或：一旦 `overlay` 打开就移除 `chrome-dismissed`）。
- **桌面复现**：Chrome DevTools 设备模拟 + 触摸，验证点内联链接 / 锚点是否吞掉切换；分别点中间与边缘区确认边缘翻页行为。
- **滚动后窗口**：停滚后 1.8s 内点击，确认是否处于 `chrome-dismissed` 未恢复窗口。
- **对照实验**：临时把「非链接 / 按钮的任意点击」都改为切换浮层（去掉边缘翻页分支），若缺陷消失即坐实「分区 / 元素过滤」理论。

**后续修复建议（编码阶段，本阶段不实现）**

- 唤起浮层时同步移除 `chrome-dismissed`，保证 chrome 必现。
- 提高 CSS 优先级：`.reader-root.has-overlay .reader-bottom / .reader-top { opacity:1; pointer-events:auto }` 置于 `.chrome-dismissed` 规则之后或加权。
- chrome 隐藏状态下用户点击优先「唤起」而非「翻页」，减少「点了没反应」的困惑（或在边缘加轻提示）。
- 内联链接点击走链接逻辑，但可在链接上长按触发词典（见 §8），与浮层切换解耦。

---

## 8. 阅读页新增功能：离线词典（复制 + 查询，番茄小说风格）

> 已确认：仅保留**词典**，去掉生词本与划词标注/笔记；词典功能仅限**复制**与**查询**两项；UI 对齐截图中的番茄小说浮动工具条风格。

### 8.1 功能范围

- 在阅读页**长按 / 双击选中文字**后，弹出番茄小说风格的浮动工具条，**仅显示两个按钮：「复制」「查询」**。
- 点击「复制」→ 将选中的词/句复制到系统剪贴板。
- 点击「查询」→ 打开词典释义面板；命中则展示释义，未命中提示「未收录」。
- 所有数据内置，**零网络**。

### 8.2 界面设计（番茄小说风格）

#### 选中后的浮动工具条

参考截图：深色半透明磨砂底、图标在上文字在下、带指向选区的小三角。

| 元素 | 设计 |
|----|----|
| 背景 | `rgba(0, 0, 0, 0.88)`，backdrop-filter blur(10px)，圆角 10px |
| 小三角 | 工具条底部（或顶部）居中一个 8px 等腰三角形，与工具条同色 |
| 按钮数量 | 仅 2 个：复制、查询 |
| 按钮布局 | 横向等分，图标在上、文字在下，每个热区 ≥ 44×44 |
| 图标 | 复制用「两张重叠纸」SVG；查询用「放大镜/字典」SVG |
| 文字 | 白色 90% 不透明度，字号 12px |
| 按压态 | 背景亮度降到 70%，图标/文字短暂变品牌色 |
| 位置 | 默认显示在选区上方；若选区靠近屏幕顶部则翻转到底部 |
| 消失条件 | 点击工具条外部、滚动、选区消失、点击任一按钮后 |
| 事件隔离 | 工具条本身阻止 `click` 冒泡到 `.reader-surface`，避免误翻页或误唤起阅读浮层 |

#### 查询结果面板

- **触发**：点「查询」后，**从底部滑出半屏卡片**（与目录浮层同层同风格）。
- **内容结构**：
  - 顶部：拖动手柄（短横条）+ 关闭按钮。
  - 词头：大字展示被查询的词/短句。
  - 拼音/音标：中文显示拼音，英文显示音标（可选，依赖词库）。
  - 词性：n./v./adj. 等小标签。
  - 释义列表：编号展示，最多 3–4 条，超出可滚动。
  - 底部：「未收录」提示或「关闭」。
- **样式**：跟随当前主题（日间白底黑字 / 夜间深灰底浅字），顶部大圆角 16px，内容与屏幕边缘留 16px 安全边距。
- **未命中**：显示「未收录该词」+ 一行小字「换个词试试」。
- **关闭**：点遮罩、点关闭、下滑底部卡片。

### 8.3 实现要点

#### 文本选择与工具条

- 监听 `selectionchange` 与 `mouseup`/`touchend`：当用户在 `.prose` 内选中任意文本，且选区非空时弹出工具条。
- 用 `window.getSelection()` 取选区文本；用 `Range.getBoundingClientRect()` 计算选区坐标，工具条据此定位。
- 工具条渲染在阅读器最外层 portal 内（与目录/设置浮层同级），避免被 `.reader-surface` 事件区域裁剪。
- 工具条点击阻止冒泡；点击外部空白处隐藏工具条，同时不触发阅读器浮层切换。

#### 复制功能

- **首选**：Web 标准 `navigator.clipboard.writeText(text)`。Android WebView 在已声明 `INTERNET` 权限下通常可工作。
- **降级**：若真机失败，再引入 `@capacitor/clipboard`（Capacitor 官方插件，很轻，无 UI 侵入）。
- 复制成功后显示 mini toast「已复制」。

#### 查询功能

- **词典数据源**：
  - PRD R-20 计划内置三套词库：① 生僻字/汉字 ② 成语 ③ 英文（CC-CEDICT 子集）。
  - 实现层面先把词典文件放在 `public/content/dict/`（或打包进 content.zip），按词头首字母/笔画分片、索引，加载时按需取。
  - 若当前暂无完整词库，MVP 可先内置一个最小 Demo 词表（如 100 条常用词）验证 UI 与查询链路，后续通过内容更新机制替换为完整词库。
- **查询逻辑**：
  - 精确匹配选中的完整文本。
  - 精确未命中时，按「去掉前后空格/标点」再匹配一次。
  - 仍无结果则返回「未收录」。
- **索引结构建议**：
  ```json
  {
    "entries": {
      "剩余价值": { "py": "shèng yú jià zhí", "pos": "n.", "defs": [...] },
      "dialectic": { "ipa": "/ˌdaɪəˈlektɪk/", "pos": "n./adj.", "defs": [...] }
    },
    "index": { "a": [0, 12], "b": [12, 30], ... }
  }
  ```
  或直接用分片后的 JSON 文件 + 内存 Map。
- 查询面板使用同一个 React 组件，接收 `{ word, definition | null }`，从底部弹出。

### 8.4 与当前架构的关系

- 不违反「纯 CSS、无 Tailwind、无 React Router」红线。
- 仅可能新增 `@capacitor/clipboard` 作为复制降级；网络权限已存在。
- 词典数据可随 content 更新包下发，无需单独更新通道。
- 选中手势与 §7 的「点击唤起底部栏」存在事件竞争，需在工具条上隔离事件冒泡，避免点「查询」时同时翻页或切换阅读浮层。

### 8.5 优先级与待确认细节

- **优先级：P1**（已确认，UI 目标清晰）。
- **待确认细节（编码前可定）**：
  1. 词典数据是否已具备，还是需要我先做一个最小 Demo 词表？
  2. 查询结果面板：底部半屏卡片（推荐，与目录浮层一致）还是跟随选区的小卡片？
  3. 图标风格：纯 SVG 线条图标，还是番茄小说那种面性图标？

---

*文档生成时间：2026-09-10 · 最后更新：2026-09-10（扩展 §4.9 局域网部署手册 / 简化 §8 为词典复制+查询+番茄小说风格）*
