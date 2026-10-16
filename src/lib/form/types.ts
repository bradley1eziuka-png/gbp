export type Primitive = string | number | boolean;

/** Declarative visibility / requirement condition evaluated against form data + derived context. */
export type Cond =
  | { f: string; eq?: Primitive; ne?: Primitive; in?: Primitive[]; has?: string; hasAny?: string[]; filled?: boolean }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond };

export interface Option {
  value: string;
  label: string;
  help?: string;
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'checkboxgroup'
  | 'tags'
  | 'hours'
  | 'repeater'
  | 'files'
  | 'matrix'
  | 'notice'
  | 'heading';

/** Where the information may end up. Helps clients tell internal info from public Google info. */
export type Visibility = 'public' | 'internal' | 'mixed';

export interface MatrixRow {
  id: string;
  label: string;
  showIf?: Cond;
}

export interface Field {
  id: string;
  type: FieldType;
  label: string;
  help?: string;
  placeholder?: string;
  options?: Option[];
  /** Always required when visible. */
  required?: boolean;
  /** Required only when this condition holds (and the field is visible). */
  requiredIf?: Cond;
  /** Client may tick "I don't have this yet"; it passes validation and is flagged for follow-up. */
  skippable?: boolean;
  showIf?: Cond;
  visibility?: Visibility;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Repeater / group */
  fields?: Field[];
  itemLabel?: string;
  addLabel?: string;
  maxItems?: number;
  /** Repeater: allow "paste a list" quick-add. Value is the child field id that receives each line. */
  bulkField?: string;
  /** Notice tone */
  tone?: 'info' | 'warn' | 'policy' | 'good';
  /** Files */
  category?: string;
  accept?: 'image' | 'video' | 'media';
  maxFiles?: number;
  /** Matrix */
  rows?: MatrixRow[];
  /** Default value for new repeater items / fresh fields */
  defaultValue?: unknown;
  /** Render two fields side by side on wide screens */
  half?: boolean;
  /** Text only shown to Arclo staff in the admin view, never mixed into public output */
  internalNote?: string;
}

export interface Step {
  id: string;
  title: string;
  short: string;
  phase: string;
  intro?: string;
  fields: Field[];
}

export type FormData = Record<string, unknown>;

export interface FileMeta {
  id: string;
  category: string;
  name: string;
  mime: string;
  size: number;
}

export type FlagSeverity = 'blocker' | 'attention' | 'info';
export type FlagCategory =
  | 'missing'
  | 'eligibility'
  | 'existing-listing'
  | 'access'
  | 'verification'
  | 'media'
  | 'reviews'
  | 'categories';

export interface Flag {
  id: string;
  severity: FlagSeverity;
  category: FlagCategory;
  message: string;
  stepId?: string;
}
