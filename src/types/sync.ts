export interface Empleado {
  empID?: string | number;
  fullName?: string;
  ci?: string;
  phone?: string;
  cargo?: string;
  regional?: string;
  AD?: string | null;
  [key: string]: unknown;
}

export interface SurveyApiItem {
  data?: Empleado;
}
