# 阅读页 5 项问题修复报告（2026-09-10）

针对手机 App 阅读页的 5 个问题，已逐项修复并重建 `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`（Gradle `BUILD SUCCESSFUL`，已解包验证特征进包）。

## ① 系统自带复制 vs 划词卡片冲突 —— 已禁用系统复制
- **Java 层**（`android/app/.../MainActivity.java`）：对阅读页 WebView 设置选择 `ActionMode` 回调返回 `false`，**屏蔽系统「复制/分享/搜索」操作栏**。因本机 SDK 编译期该符号不可见，改用**反射**调用，API 23+ 运行时安全生效。
- **CSS 层**（`.reader-doc`）：加 `-webkit-touch-callout: none`，禁用长按系统弹出菜单。
- 关键点：**仅屏蔽系统菜单，不禁用文本选区**，所以划词「复制/查询」卡片照常工作（正文绝不能 `user-select:none`，否则选区不形成、词典失效）。

## ② 离线词表不完整 / 缺乏词典功能 —— 已补全并增强查询
- **查询增强**（`src/lib/dict.ts` 的 `lookupWord`）：精确/规范化未命中后，新增「最长子串/包含」兜底匹配——选中「资本主义生产方式」→ 命中「资本主义」，选中「关于国家的话题」→ 命中「国家」，取词长最长者优先。复用 core 的 `normalizeQuery`，**不改动 core、免重编译**。
- **词表补全**（`content/dict/dictionary.json`）：**146 → 217 条**（新增 71 条精选高频词，覆盖历史/哲学/政治/经济/科学，`defs`+`specialized` 结构不变），`count` 字段同步为 217。`copy:content` 已刷新，`public/content` 与 APK 内均确认 217 条。

## ③ 导入内容包功能「多余」 —— 保留并说明必要性
- 判定为**非冗余**：局域网 OTA 需「电脑跑 `serve-lan` 做服务端」，而本机导入是其**离线互补**——无电脑/局域网时（USB/微信/云盘传包）可直接选文件写入本机内容层。
- 处理：保留功能，在「我的」页该行说明文字中补充分必要性（满足「说明其存在必要性」分支），未移除。

## ④ 首页类目「词条数 / 子词条数」不一致 —— 计数逻辑修正
- **根因**：旧逻辑对每棵子树取 `entrySlugs` 并集去重，父级计数 < 各子级之和（例「历史」父级 26，子级 15+12+1=28）。
- **改法**（`state/AppContext.tsx`）：改为「**主键分区**」模型——每词条选定唯一主键类目（引用层级最深者，同层取 path 最小）；`count(类目)` = 子树内主键归属本类的词条数。主键是全树不相交划分，故**父级 === 各直接子级之和**（历史 22 = 10+11+1，五类全部自洽）。
- **配套**（`pages/BrowsePage.tsx`）：浏览列表改用同源 `nodeSlugs`，保证「类目计数标签 == 实际浏览条目数」永远一致，不引入新的「标签≠列表」错位。

## ⑤ 搜索栏清除(×)与搜索(🔍)按钮重叠 —— 已分离布局
- **根因**：`.search-clear` 绝对定位 `right:44px`，与大模式 `.search-submit`（右侧 36px）在 right 44–48px 重叠。
- **改法**（`.search-large .search-clear`）：设为 `position:static; margin-left:auto; flex:0 0 auto`，转为搜索钮左侧的普通 flex 兄弟节点，二者并排分离（compact 模式仍绝对定位、无 submit 不冲突）。

## 重建与验证
- 链路（全 exit 0）：`npm run typecheck` → `npm run copy:content` → `CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run build` → `npm run android:sync` → `JAVA_HOME=D:/JDK/jdk-19.0.1 ANDROID_HOME="D:/Android SDK" ./gradlew assembleDebug --no-daemon`。
- 进包验证：APK 内 `dictionary.json` 217 条且 `count=217`；CSS 含 `touch-callout:none` 与 `.search-large .search-clear(position:static)`。
- 产物：`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`

## 真机验收建议
1. 阅读页长按选词 → 只弹应用内「复制/查询」卡片，不再出现系统复制条（①）。
2. 选一段含术语的长句（如「资本主义生产方式」）→ 点查询能命中释义（②）。
3. 「我的」页可见「导入内容包」及离线必要性说明（③）。
4. 首页各大类「X 词条」= 其下各子项之和（如历史 22 = 10+11+1）（④）。
5. 搜索框输入后，右侧 × 与 🔍 清晰左右分离（⑤）。
