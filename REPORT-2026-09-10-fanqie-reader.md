# 阅读页修复与「番茄小说」风格重做 · 交付报告

日期：2026-09-10
产物：`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`（7,200,185 B，BUILD SUCCESSFUL）

---

## 一、核心结论：前两轮修复为什么全部无效（真根因）

用户截图里始终弹出的是 **Android 系统自带的划词工具栏**（复制 / 分享 / 全选 / 网页搜索）。

**决定性发现**：`android.webkit.WebView` **根本没有** `setCustomSelectionActionModeCallback` 这个方法 —— 它是 **`android.widget.TextView`** 的 API。

验证方式（可复现）：

```
"D:/JDK/jdk-19.0.1/bin/javap.exe" -classpath "D:/Android SDK/platforms/android-35/android.jar" android.webkit.WebView
```

输出中**没有任何** `*Selection*` / `*ActionMode*` 成员（android-34 同样）。

**由此推出的连锁结论**：

| 现象 | 解释 |
|---|---|
| 之前用**反射**调用该方法总是「无效」 | 反射抛 `NoSuchMethodException`，被 `catch (Exception ignored)` 吞掉 → 回调**从未安装** |
| 曾经**直接调用**它编译报「找不到符号」 | 方法在 WebView 上就不存在 |
| 系统工具栏一直出现 | 因为它从未被抑制 |

教训：**反射调用一个不存在的方法会静默失败**，比编译期报错危险得多。

---

## 二、修复一：彻底屏蔽系统划词工具栏（原生）

WebView 上唯一可用的钩子是覆写 `startActionMode`。关键约束与做法：

- ❌ **不能 `return null`** —— WebView 拿到 null 会认为「无人处理此次选择」，**连带清除选区与手柄**（正是之前「选词条一闪即消失、完全没法选字」的原因）。
- ❌ **不能 `mode.finish()`** —— 同样会清除选区。
- ✅ **正确做法**：让 ActionMode **正常成立**（保留选区与手柄），只把它的**菜单清空**（无按钮可画 → 工具栏视觉上不出现）。

| 文件 | 改动 |
|---|---|
| `apps/web/android/app/src/main/java/com/pks/app/PksWebView.java` | 重写：删除对不存在的 `setCustomSelectionActionModeCallback` 的反射死代码；覆写 `startActionMode(Callback,int)` 与 `startActionModeForChild(View,Callback,int)`，`TYPE_FLOATING` 时传入 `SUPPRESS_FLOATING` 回调（`onCreateActionMode`：`menu.clear()` + `return true`；`onPrepareActionMode`：`menu.clear()`）。 |
| `.../MainActivity.java` | 删除反射死代码；新增 `onActionModeStarted` 兜底（`TYPE_FLOATING` 时 `mode.getMenu().clear()`，**绝不 finish()**）。 |

> 注：`startActionModeForChild` 声明在 **`ViewGroup`**（非 `View`），WebView 继承自它，覆写合法。

---

## 三、修复二：阅读页按「番茄小说」风格重做（Web）

参照用户提供的番茄小说截图（深色划词条 + 深色释义卡）重做，只改 2 个文件：

| 文件 | 改动 |
|---|---|
| `apps/web/src/styles.css` | 划词条 / 释义卡 / 正文排版 / 顶底栏 |
| `apps/web/src/components/ReaderSelectionMenu.tsx` | 释义卡 DOM 层级重排 |

**1) 划词浮动工具条 `.dict-menu`**
深色胶囊 `rgba(46,46,48,0.96)`、圆角 14px、内边距 7px、项间距 6px，**移除 `backdrop-filter`**（WebView 上卡顿，改实色）；每项「图标 23px（浅色）在上 + 文字 11px（`#D8D8D8`）在下」，min 60×54px，按下态 `rgba(255,255,255,.14)`。功能仍为「复制 / 查询」。

**2) 释义卡 `.dict-card`**
固定深色面 `#2e2e30`、顶部圆角 18px（不吃阅读底色）；就地覆盖 `--t-*` 为深色系。信息层级自上而下：

```
拼音  13px  #9AA0A6
词头  22px/700  #F5F5F5
释义  15px  #DCDCDC  行高 1.6，序号用暖橙 #E8913A
来源  12px  #8A8A8E  右下角，形如「来自 XXX ›」
```

并提升特异度为 **`.dict-card-layer .dict-card`**，防止日后被同特异度的 `.reader-sheet-bg-*` 浅色底覆盖。

**3) 正文排版**：基准字号 16 → **17px**，行高 ≈1.9，段间距 1.15em（保持 4 档行距设置可用）；`.reader-doc .prose h2` **去掉下边框**，改更大字号/更粗字重 + 上下留白。

**4) 顶栏 / 底栏**：改用新主题 token **`--reader-chrome-bg`**（各 `.reading-bg-*` 注入贴合阅读底色的半透明值、无硬边框），按钮保持无边框；交互（返回/目录/上下一章/进度条/夜间/设置）**零改动**。

---

## 四、独立验证（QA，全 PASS）

| 项 | 结果 |
|---|---|
| `javap` 复核 WebView 无该方法（TextView 有） | PASS |
| 源码无 `return null` / `finish()` / 该死方法调用（仅注释提及） | PASS |
| `onActionModeStarted` 仅 `menu.clear()` | PASS |
| `gradlew assembleDebug` | BUILD SUCCESSFUL（QA 另用 `--rerun-tasks` 强制真编译，排除 UP-TO-DATE 假绿） |
| `tsc --noEmit` | exit 0 |
| APK 内 `classes4.dex` 含 `PksWebView` | PASS |
| CSS 大括号配平 818/818，无截断 | PASS |
| `.dict-menu` 无 backdrop-filter、`.dict-card` 深色、`::selection` 主题规则完好 | PASS |

**APK 进包实测**：`index-D3E2Q47Z.css` / `index-D1PjD_X2.js`；`#2e2e30` ✓、`.dict-card-layer .dict-card` ✓、`reader-chrome-bg` ×7 ✓、`::selection` ×5 ✓；`classes4.dex` 内 `PksWebView`=2、`startActionModeForChild`=2、`setCustomSelectionActionModeCallback`=**0**。

> 说明：`classes.dex` 中出现的 `setCustomSelectionActionModeCallback` 字符串来自第三方库（AndroidX/Material）的方法名字符串池（紧邻 `setCustomContentView` / `setCustomHeadsUpContentView` / `setCustomSizePreset`），与本次改动无关。

---

## 五、验收方式

1. **阅读页长按 / 拖动选词** → 系统「复制/分享/全选/网页搜索」工具栏**不再出现**；选区与手柄**稳定保留**；App 自带的深色「复制 / 查询」条正常弹出；点「查询」弹出番茄风深色释义卡（拼音 → 词头 → 释义 → 来源）。
2. **正文观感** → 字号略增、行距更舒展、分节标题无下划线；顶/底栏与阅读底色融为一体、无生硬边框。

## 六、遗留说明（非阻断）

- 仅覆写了 typed 版 `startActionMode(Callback,int)`；不带 type 的旧式重载未覆写（现代选择路径走 typed，且 `MainActivity` 有兜底），风险极低，仅记录。
- 划词条的项数仍为「复制 / 查询」两项（番茄截图里另有划线/分享/写笔记等，属其自有生态功能，本次不虚增无实现入口）。
