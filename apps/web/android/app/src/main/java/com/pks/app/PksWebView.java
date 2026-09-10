package com.pks.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.util.AttributeSet;
import android.util.Log;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import com.getcapacitor.CapacitorWebView;

/**
 * 屏蔽 WebView 文本「浮动选择操作栏」（复制/分享/全选/网页搜索），同时保留文本选区。
 *
 * 背景：WebView **没有** setCustomSelectionActionModeCallback（那是 TextView 的 API），
 * 因此唯一可靠的钩子是覆写 startActionMode / startActionModeForChild。
 * 注意：在这些方法里 return null 虽能去掉工具栏，但会**连带清除选区**（用户无法选词），故不可取。
 *
 * 本类做法：TYPE_FLOATING 时改为传入一个「清空菜单」的 Callback ——
 *   onCreateActionMode 里 menu.clear() 并 return true：
 *     - return true  → ActionMode 成立，WebView 保留选区与选区手柄；
 *     - menu 为空    → 浮动工具栏没有任何按钮可绘制，视觉上不出现。
 * 这样 window.getSelection() 始终可用，阅读页划词词典照常工作。
 */
public class PksWebView extends CapacitorWebView {

    /** 抑制回调：让 ActionMode 成立但菜单为空。 */
    private static final ActionMode.Callback SUPPRESS_FLOATING = new ActionMode.Callback() {
        @Override
        public boolean onCreateActionMode(ActionMode mode, Menu menu) {
            menu.clear();
            return true; // true = 保留 ActionMode（从而保留选区），但菜单为空
        }

        @Override
        public boolean onPrepareActionMode(ActionMode mode, Menu menu) {
            menu.clear();
            return true;
        }

        @Override
        public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
            return false;
        }

        @Override
        public void onDestroyActionMode(ActionMode mode) {
            // 不干预：选区由 WebView 管理
        }
    };

    public PksWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @SuppressLint("NewApi")
    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
        Log.i("PKS", "PksWebView.startActionMode type=" + type);
        if (type == ActionMode.TYPE_FLOATING) {
            return super.startActionMode(SUPPRESS_FLOATING, type);
        }
        return super.startActionMode(callback, type);
    }

    @SuppressLint("NewApi")
    @Override
    public ActionMode startActionModeForChild(View child, ActionMode.Callback callback, int type) {
        Log.i("PKS", "PksWebView.startActionModeForChild type=" + type);
        if (type == ActionMode.TYPE_FLOATING) {
            return super.startActionModeForChild(child, SUPPRESS_FLOATING, type);
        }
        return super.startActionModeForChild(child, callback, type);
    }
}
