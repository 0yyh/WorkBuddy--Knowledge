/**
 * 设置页 / 阅读设置浮层共用的控件：Segmented 单选段、颜色色板。
 */
export interface SegOption<T extends string> {
  value: T;
  label: string;
}

interface SegProps<T extends string> {
  value: T;
  options: Array<SegOption<T>>;
  onChange: (v: T) => void;
  compact?: boolean;
}

export function Segmented<T extends string>({ value, options, onChange, compact }: SegProps<T>): JSX.Element {
  return (
    <div className={`seg${compact ? ' seg-compact' : ''}`} role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          className={`seg-item${opt.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export interface SwatchOption<T extends string> {
  value: T;
  label: string;
  color: string;
}

interface SwatchesProps<T extends string> {
  value: T;
  options: Array<SwatchOption<T>>;
  onChange: (v: T) => void;
  compact?: boolean;
}

export function ColorSwatches<T extends string>({
  value,
  options,
  onChange,
  compact,
}: SwatchesProps<T>): JSX.Element {
  return (
    <div className={`swatch-row${compact ? ' swatch-row-compact' : ''}`} role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          className={`swatch${opt.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          <span className="swatch-color" style={{ background: opt.color }} aria-hidden="true" />
          <span className="swatch-label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/** 设置分组小标题 */
export function GroupTitle({ children }: { children: string }): JSX.Element {
  return <h3 className="settings-group-title">{children}</h3>;
}
