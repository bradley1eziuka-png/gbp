import type { Cond, Field, FormData, Step } from './types';

/** Derived values usable in conditions as `$name`. */
export function buildContext(data: FormData): Record<string, unknown> {
  const mode = data.serviceMode as string | undefined;
  const ctx: Record<string, unknown> = { ...data };
  ctx.$visits = mode === 'visit' || mode === 'both';
  ctx.$travels = mode === 'travel' || mode === 'both';
  return ctx;
}

const isFilled = (v: unknown): boolean => {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
};

export function evalCond(cond: Cond | undefined, ctx: Record<string, unknown>): boolean {
  if (!cond) return true;
  if ('all' in cond) return cond.all.every((c) => evalCond(c, ctx));
  if ('any' in cond) return cond.any.some((c) => evalCond(c, ctx));
  if ('not' in cond) return !evalCond(cond.not, ctx);
  const v = ctx[cond.f];
  if (cond.eq !== undefined && v !== cond.eq) return false;
  if (cond.ne !== undefined && v === cond.ne) return false;
  if (cond.in !== undefined && !cond.in.includes(v as never)) return false;
  if (cond.has !== undefined && !(Array.isArray(v) && v.includes(cond.has))) return false;
  if (cond.hasAny !== undefined && !(Array.isArray(v) && cond.hasAny.some((x) => v.includes(x)))) return false;
  if (cond.filled !== undefined && isFilled(v) !== cond.filled) return false;
  return true;
}

/**
 * Visible fields of a step. For repeater items the caller passes the item merged over the parent context.
 */
export function visibleFields(fields: Field[], ctx: Record<string, unknown>): Field[] {
  return fields.filter((f) => evalCond(f.showIf, ctx));
}

export function isRequired(field: Field, ctx: Record<string, unknown>): boolean {
  if (field.required) return true;
  if (field.requiredIf) return evalCond(field.requiredIf, ctx);
  return false;
}

/** Steps in which at least one field is visible (non-notice). */
export function visibleSteps(steps: Step[], data: FormData): Step[] {
  const ctx = buildContext(data);
  return steps.filter((s) => visibleFields(s.fields, ctx).some((f) => f.type !== 'notice' && f.type !== 'heading'));
}

export const skippedMap = (data: FormData): Record<string, boolean> =>
  (data._skipped as Record<string, boolean> | undefined) ?? {};
