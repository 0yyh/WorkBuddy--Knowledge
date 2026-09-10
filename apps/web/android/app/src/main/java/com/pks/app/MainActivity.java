package com.pks.app;

import android.os.Build;
import android.view.ActionMode;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * 主 Activity：拦截 Android 物理返回键 / 全面屏手势返回 + 状态栏常驻控制。
 *
 * 背景：
 * 1) 返回键：Android WebView 对「纯 hash 历史项」的物理返回行为与浏览器不一致，阅读页
 *    （#/entry-reader/...）在真机上按返回键会直接穿透到栈底退出 App（退到桌面），而不是
 *    返回上一级（封面页）。Capacitor 的返回键处理本应走 @capacitor/app 插件，但本项目未
 *    安装该插件（离线环境），Bridge 源码中也没有任何 onBackPressed 拦截，故默认=直接 finish。
 *    → 三层方案见 onBackPressed。
 * 2) 状态栏常驻：默认非 edge-to-edge（fit system windows=true），App 内容在系统栏下方，
 *    状态栏正常显示、顶部 header / 底部 TabBar 不被遮挡。进入阅读页沉浸时由
 *    setStatusBarPermanent(false) 动态切到 edge-to-edge + 隐藏状态栏，让 WebView 通顶；
 *    离开阅读页时恢复。这样"状态栏隐藏只对阅读页生效，其他页面始终显示"。
 *
 * note: evaluateJavascript 是异步的，须在 UI 线程回调里判断是否调用 super.onBackPressed。
 */
public class MainActivity extends BridgeActivity {

    private boolean statusBarPermanent = false;

    /**
     * 用我们的子类化 WebView（PksWebView，安装「空菜单」选择回调以隐藏系统浮动选择栏、
     * 同时保留文本选区）替换 Capacitor 默认布局里的 CapacitorWebView。
     * Bridge.Builder.create() 通过 activity.findViewById(R.id.webview) 取 WebView，
     * 因此只要这里先 setContentView 我们的布局，bridge 就会拿到 PksWebView 实例，
     * 且仍满足 `instanceof CapacitorWebView`，Bridge 的 setBridge / edgeToEdge 逻辑照常生效。
     */
    @Override
    protected void load() {
        setContentView(R.layout.pks_webview_layout);
        super.load();
    }

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 默认非沉浸：保持"fit system windows"，状态栏正常显示、内容不被系统栏遮挡。
        WebView wv = (bridge != null) ? bridge.getWebView() : null;
        if (wv != null) {
            wv.addJavascriptInterface(new PksJsBridge(this), "PKS");
            // 离屏预栅格化：提升长按选区/滚动时的合成流畅度（动画平滑工作的一部分）。
            // API 23+ 才有，按版本守护。
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    wv.getSettings().setOffscreenPreRaster(true);
                } catch (Exception ignored) {
                    // 个别 WebView 实现无此方法：忽略，不影响主流程
                }
            }
            // 屏蔽系统「复制/分享/搜索」浮动选择栏：由 PksWebView 覆写 startActionMode，
            // 对 TYPE_FLOATING 传入「空菜单」Callback 完成（见 PksWebView.SUPPRESS_FLOATING）。
            // 要点：让 ActionMode 正常成立（保留文本选区与手柄），但菜单项为空（工具栏不可见）。
            // 这样划词词典依赖的 window.getSelection() 始终可用。
            // 说明：WebView 上没有 setCustomSelectionActionModeCallback（那是 TextView 的 API），
            // 故不再使用该方法；也不再在 onActionModeStarted 里 finish()——那会清除选区。
        }
    }

    /**
     * 兜底：万一个别 ROM 绕过 PksWebView 里 startActionMode 的替换，这里再把浮动操作栏的
     * 菜单项清空，使其无按钮可显示；注意绝不调用 finish()（finish 会清除 WebView 的文本选区，
     * 造成「选词条一闪即消失、无法完成选词」）。
     */
    @Override
    public void onActionModeStarted(ActionMode mode) {
        if (mode != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                if (mode.getType() == ActionMode.TYPE_FLOATING) {
                    mode.getMenu().clear();
                }
            } catch (Exception ignored) {
                // 极老版本无 getType：保守不干预
            }
        }
        super.onActionModeStarted(mode);
    }

    @Override
    public void onBackPressed() {
        WebView wv = (bridge != null) ? bridge.getWebView() : null;
        if (wv == null) {
            super.onBackPressed();
            return;
        }
        // 返回逻辑完全交给 Web 层 window.__pksHandleBack()（lib/backHandler.ts）裁决：
        //   - 返回 true  = Web 层已处理（阅读页→封面、封面/内页 history.back() 逐级回退、
        //                  首页首次按返回弹"再按一次退出知识"），原生什么都不用做；
        //   - 返回 false = 已在首页且用户再次按返回确认退出 → 原生才真退出。
        // 不能再用 WebView.canGoBack()/goBack() 抢先：那是浏览器整段 hash 历史，首页往往
        // 并不是栈底（用户浏览过其它 tab），会绕过上面所有 JS 逻辑，导致"回首页 + 双击退出"
        // 失效。统一走 JS，返回动作由 JS 用 history.back()/replaceRoute 完成（hashchange 派发，
        // 路由会重渲染），native 只负责"JS 说退出时"真的 finish。
        final String js =
                "(function(){ try { " +
                "  if (typeof window.__pksHandleBack === 'function') { " +
                "    return String(window.__pksHandleBack()); " +
                "  } " +
                "} catch(e) {} " +
                "return 'unhandled'; " +
                "})()";
        try {
            wv.evaluateJavascript(js, value -> {
                boolean handled = value != null
                        && value.trim().length() > 0
                        && !"null".equals(value)
                        && value.contains("true");
                runOnUiThread(() -> {
                    if (!handled) {
                        MainActivity.super.onBackPressed();
                    }
                });
            });
        } catch (Exception e) {
            super.onBackPressed();
        }
    }

    /**
     * 沉浸切换：状态栏常驻。
     *   on=false（进入阅读页沉浸）→ 切 edge-to-edge + hide 状态栏 → WebView 通顶全屏
     *   on=true （显示 / 离开阅读页）→ show 状态栏 + 恢复 fit system windows → 回到普通布局
     * 这样"状态栏隐藏只对阅读页生效，其他页面始终显示且不被遮挡"。
     */
    void setStatusBarPermanent(boolean on) {
        this.statusBarPermanent = on;
        runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (on) {
                    getWindow().setDecorFitsSystemWindows(true);
                    WindowInsetsController c = getWindow().getInsetsController();
                    if (c != null) {
                        c.show(WindowInsets.Type.statusBars());
                        c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_DEFAULT);
                    }
                } else {
                    getWindow().setDecorFitsSystemWindows(false);
                    WindowInsetsController c = getWindow().getInsetsController();
                    if (c != null) {
                        c.hide(WindowInsets.Type.statusBars());
                        c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    }
                }
            } else {
                View decor = getWindow().getDecorView();
                if (on) {
                    decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
                } else {
                    decor.setSystemUiVisibility(
                            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                }
            }
        });
    }

    /** JS Interface：暴露给 WebView 的最小桥 */
    public static class PksJsBridge {
        private final MainActivity activity;
        PksJsBridge(MainActivity activity) {
            this.activity = activity;
        }
        @JavascriptInterface
        public void setStatusBarPermanent(boolean on) {
            activity.setStatusBarPermanent(on);
        }
    }
}
