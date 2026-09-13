/**
 * 阅读器魔法数字集中表（P2-10）。
 *
 * 原散落在 EntryReaderPage.tsx / useReaderScroll.ts 的字面量在此统一导出，
 * 仅「搬迁」不改值；引用处改 import 这些常量（RELOCATE only）。
 * 与 styles/tokens.css 的 --reader-* 令牌同源（STATUSBAR_H 对应 --reader-statusbar-h）。
 */

/** 左右滑切章 / 点按翻页的最小水平位移（px） */
export const SWIPE_X = 60;

/**
 * 状态栏高度（px），对应 CSS 令牌 --reader-statusbar-h（30px）。
 * TS 侧当前不直接引用（布局由 CSS 承担），导出供统一调参，避免将来 JS 侧
 * 需要按状态栏高度计算时出现魔法数字。
 */
export const STATUSBAR_H = 30;

/** 滚隐后自动恢复（重新淡入信息栏）的空闲延时（ms）。原字面量 1800（"1.8s"）。 */
export const CHROME_REVEAL_DELAY_MS = 1800;

/** 章末自动加载下一章的去抖延时（ms）。原字面量 400（防惯性误触）。 */
export const AUTO_NEXT_DEBOUNCE_MS = 400;

/** 底部信息条「当前时间」刷新间隔（ms）。原字面量 1000（1s）。 */
export const CLOCK_INTERVAL_MS = 1000;

/** 横滑判定：水平位移须超过此比例 × 垂直位移，才算「横滑切章」而非误触滚动。原字面量 1.2。 */
export const SWIPE_Y_RATIO = 1.2;

/** 点按中央唤出/翻页：左区占比阈值（< 此比例视为「上一章」）。原字面量 0.26。 */
export const TAP_LEFT_RATIO = 0.26;

/** 点按中央唤出/翻页：右区占比阈值（> 此比例视为「下一章」）。原字面量 0.74。 */
export const TAP_RIGHT_RATIO = 0.74;

/** 判定「已滚到章末」的距底像素阈值（px），用于触发自动加载。原字面量 4。 */
export const SCROLL_BOTTOM_THRESHOLD_PX = 4;

/** 点击小节后滚动到标题时的上偏移（px），避免标题贴顶。原字面量 12。 */
export const HEADING_SCROLL_OFFSET = 12;
