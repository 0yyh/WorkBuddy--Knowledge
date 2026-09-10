/**
 * 通用确认弹窗（替代原生 window.confirm）。
 *  - 通过 portal 渲染到 body，带遮罩 + 底部上滑 + 背景模糊。
 *  - 文案全中文：「取消 / 确认」。
 *  - danger=true 时确认按钮为红色（用于清空历史等危险操作）。
 *  - 受控组件：visible 由父级控制；onConfirm / onCancel 回调。
 *  - 纯 CSS、零依赖，离线可用。
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  // 打开时锁定底层滚动（阅读页浮层已锁，这里避免页面层滚动穿透）
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <div className="confirm-layer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="confirm-mask" onClick={onCancel} />
      <div className={`confirm-sheet${danger ? ' is-danger' : ''}`}>
        <div className="confirm-sheet-handle" aria-hidden="true" />
        <h3 className="confirm-title">{title}</h3>
        {message ? <p className="confirm-message">{message}</p> : null}
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost confirm-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'} confirm-ok`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
