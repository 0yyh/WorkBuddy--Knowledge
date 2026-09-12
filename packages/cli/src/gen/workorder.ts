/**
 * work-order 解析（T03）。支持 YAML 或 JSON，顶层 `{ items: [...] }`。
 *
 * 不引入任何新依赖：YAML 解析复用 @pks/core 导出的 `yamlLoad`（js-yaml）。
 * `validateWorkOrderCategories` 在 run 启动前用 taxonomy 的 validPaths 校验类目合法性，
 * 避免生成完毕才被 lint(L002) 打回。
 */
import { yamlLoad } from '@pks/core';

export interface WorkOrderSource {
  title: string;
  url: string;
  license?: string;
}

export interface WorkOrderItem {
  slug: string;
  title: string;
  categories: string[];
  timeline?: string[];
  see_also?: string[];
  /** 章节标题列表（章节骨架），用于构造 prompt 的 outline */
  outline: string[];
  sources?: WorkOrderSource[];
  /** 素材 / 参考，直接塞进 prompt */
  material?: string;
  /** 生成提示，直接塞进 prompt */
  provider_hint?: string;
}

export interface WorkOrder {
  items: WorkOrderItem[];
}

function asStringArray(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) return undefined;
  return v.map((x) => String(x));
}

export function parseWorkOrder(text: string): WorkOrder {
  const trimmed = text.trim();
  let data: unknown;
  if (trimmed.startsWith('{')) {
    data = JSON.parse(trimmed);
  } else {
    data = yamlLoad(trimmed);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('work-order 解析失败：根节点非对象');
  }
  const rawItems = (data as { items?: unknown }).items;
  if (!Array.isArray(rawItems)) {
    throw new Error('work-order 解析失败：缺少 items 数组');
  }
  const items: WorkOrderItem[] = rawItems.map((raw, i) => {
    const it = raw as Record<string, unknown>;
    if (!it.slug) throw new Error(`work-order items[${i}] 缺少 slug`);
    if (!it.title) throw new Error(`work-order items[${i}] (${it.slug}) 缺少 title`);
    const categories = asStringArray(it.categories);
    if (!categories || categories.length === 0) {
      throw new Error(`work-order items[${i}] (${it.slug}) 缺少 categories`);
    }
    const outline = asStringArray(it.outline);
    if (!outline || outline.length === 0) {
      throw new Error(`work-order items[${i}] (${it.slug}) 缺少 outline`);
    }
    const sources: WorkOrderSource[] | undefined = Array.isArray(it.sources)
      ? it.sources.map((s) => {
          const sm = s as Record<string, unknown>;
          return {
            title: String(sm.title ?? ''),
            url: sm.url != null ? String(sm.url) : '',
            license: sm.license != null ? String(sm.license) : undefined,
          };
        })
      : undefined;
    return {
      slug: String(it.slug),
      title: String(it.title),
      categories,
      timeline: asStringArray(it.timeline),
      see_also: asStringArray(it.see_also),
      outline,
      sources,
      material: it.material != null ? String(it.material) : undefined,
      provider_hint: it.provider_hint != null ? String(it.provider_hint) : undefined,
    };
  });
  return { items };
}

/**
 * 校验 work-order 中每个 item 的 categories 是否都存在于 taxonomy 的 validPaths。
 * 返回错误文案数组（空数组表示全部合法）。
 */
export function validateWorkOrderCategories(items: WorkOrderItem[], validPaths: Set<string>): string[] {
  const errors: string[] = [];
  for (const it of items) {
    for (const c of it.categories) {
      if (!validPaths.has(c)) {
        errors.push(`work-order 条目 ${it.slug} 的 categories 含非法路径：${c}（taxonomy 中不存在）`);
      }
    }
  }
  return errors;
}
