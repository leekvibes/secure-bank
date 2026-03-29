export type DocumentVariableType =
  | "text"
  | "multiline"
  | "address"
  | "date_text"
  | "currency_usd"
  | "email"
  | "phone"
  | "number";

export interface DocumentVariableDef {
  key: string;
  label: string;
  type: DocumentVariableType;
  required: boolean;
  editable: boolean;
  maxLength?: number;
}

export interface DocumentClauseDef {
  id: string;
  label: string;
  required?: boolean;
  defaultEnabled?: boolean;
}

export interface DocumentBlockDef {
  id?: string;
  kind: "heading" | "paragraph" | "spacer";
  text?: string;
  size?: number;
  clauseId?: string;
  editable?: boolean;
}

export interface DocumentTemplateSchema {
  title: string;
  locale?: string;
  versionLabel?: string;
  roles: string[];
  variables: DocumentVariableDef[];
  clauses?: DocumentClauseDef[];
  blocks: DocumentBlockDef[];
}

export interface DocumentSigningDefault {
  type:
    | "SIGNATURE"
    | "INITIALS"
    | "DATE_SIGNED"
    | "FULL_NAME"
    | "TITLE"
    | "COMPANY"
    | "TEXT"
    | "CHECKBOX"
    | "RADIO"
    | "DROPDOWN"
    | "ATTACHMENT";
  role: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required?: boolean;
  options?: string[];
}
