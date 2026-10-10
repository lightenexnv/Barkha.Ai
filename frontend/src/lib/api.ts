// API Configuration and Types for Barkha.AI

// Production builds default to the Render backend so a missing env var can't break the site
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "https://barkha-ai-backend.onrender.com" : "http://localhost:8000")
).replace(/\/+$/, "");

// Types matching the backend models
export interface SiteDetailsInput {
  site_name: string;
  latitude: number;
  longitude: number;
  roof_area: number;
  roof_material: string;
  roof_condition: string;
  soil_type: string;
  annual_rainfall: number;
  water_demand: number;
  /** ₹ per m³ used for savings; the backend defaults to 50 */
  water_tariff?: number;
  /** First-flush diversion per rain event (mm); the backend defaults to 1.5 */
  first_flush_mm?: number;
  /** Location-derived climate data, filled in automatically from the coordinates */
  monthly_rainfall?: number[];
  rainfall_source?: string;
  rainfall_period?: string;
  city?: string;
  district?: string;
  state?: string;
  /** Roof outline from pin-to-roof detection, as [lat, lon] pairs */
  roof_polygon?: [number, number][];
}

export interface AssessmentResult {
  assessment_id: string;
  harvestable_volume: number;
  recommended_option: string;
  storage_recommendation: {
    required_volume: number;
    recommended_volume: number;
    storage_days: number;
    annual_supply?: number;
    demand_coverage?: number;
    annual_demand?: number;
  };
  recharge_recommendation: {
    recharge_pit: { diameter: number; depth: number; area: number; count?: number };
    recharge_trench: { length: number; width: number; depth: number; count?: number };
    infiltration_rate: number;
    suitability_score: number;
    design_runoff?: number;
    recharge_feasible?: boolean;
  };
  cost_analysis: {
    storage_tank_cost: number;
    recharge_structure_cost: number;
    piping_cost: number;
    filtration_cost: number;
    labor_cost: number;
    material_contingency: number;
    tax: number;
    total_cost: number;
  };
  savings_analysis: {
    annual_water_saved: number;
    annual_recharge?: number;
    annual_cost_savings: number;
    monthly_savings: number;
    water_tariff_used: number;
  };
  safety_checks: string[];
  bill_of_quantities: {
    items: Array<{
      item: string;
      quantity: string;
      rate: number;
      amount: number;
    }>;
    total_cost: number;
  };
  payback_period: string | null;
  additional_info?: Record<string, unknown> | null;
  // Present on results from the current engine; older saved results lack them
  financial_statement?: FinancialStatement | null;
  subsidies?: SubsidySummary | null;
  dossiers?: Dossier[] | null;
  hydrology?: Hydrology | null;
}

export interface StatementRow {
  sno: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  component: string;
}

export interface FinancialStatement {
  materials: StatementRow[];
  materials_subtotal: number;
  additional: StatementRow[];
  additional_subtotal: number;
  contingency_rate: number;
  contingency: number;
  total_cost: number;
  recharge_kind: string | null;
  rates_note: string;
}

export interface SubsidyScheme {
  id: string;
  name: string;
  authority: string;
  level: string;
  assistance: string;
  eligibility: string;
  how_to_apply: string;
  portal: string;
  grant_rate: number | null;
  grant_cap: number | null;
  applies_to: string;
  indicative_grant: number;
}

export interface SubsidySummary {
  state: string | null;
  state_code: string | null;
  schemes: SubsidyScheme[];
  applied_scheme: string | null;
  indicative_subsidy: number;
  gross_cost: number;
  indicative_net_cost: number;
  disclaimer: string;
}

export interface Dossier {
  id: string;
  title: string;
  description: string;
  mechanism: string;
  justification: string;
  dimensions: { label: string; value: string }[];
  bill_of_materials: string[];
  installation_steps: string[];
  financial: {
    materials_subtotal: number;
    additional_subtotal: number;
    contingency: number;
    total_cost: number;
    breakdown: { label: string; amount: number }[];
  };
  benefits: {
    annual_litres_saved: number;
    annual_recharge_litres: number;
    annual_bill_savings: number;
    summary: string[];
  };
  maintenance: string[];
  suitability: { score: number; label: string; factors: string[] };
  recommended: boolean;
}

export interface Hydrology {
  annual_rainfall: number;
  monthly_rainfall: number[];
  monthly_harvest: number[];
  runoff_coefficient: number;
  condition_factor: number;
  first_flush_loss: number;
  rain_events: number;
  gross_rainfall_volume: number;
  infiltration_rate: number;
}

export interface RoofDetection {
  /** Outline as [lat, lon] pairs */
  polygon: [number, number][];
  area_m2: number;
  confidence: number;
  zoom: number;
  metres_per_pixel: number;
  method: string;
  imagery: string;
}

export interface Assessment {
  id: string;
  site_name: string;
  latitude: number;
  longitude: number;
  roof_area: number;
  roof_material: string;
  roof_condition: string;
  soil_type: string;
  annual_rainfall: number;
  water_demand: number;
  site_photos?: string[];
  assessment_data: Record<string, unknown>;
  recommendations: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  is_synced: boolean;
}

// API Functions
class BarkhaAPI {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, detail: ${errorText}`);
      }
      
      // For JSON responses
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        return await response.json();
      }
      
      // For binary responses (e.g., PDF)
      return response as unknown as T;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Create new assessment
  async createAssessment(siteData: SiteDetailsInput): Promise<AssessmentResult> {
    return this.request<AssessmentResult>('/api/assess', {
      method: 'POST',
      body: JSON.stringify(siteData),
    });
  }

  // Get all assessments
  async getAssessments(skip = 0, limit = 100): Promise<Assessment[]> {
    return this.request<Assessment[]>(`/api/assessments?skip=${skip}&limit=${limit}`);
  }

  // Get specific assessment
  async getAssessment(assessmentId: string): Promise<Assessment> {
    return this.request<Assessment>(`/api/assessments/${assessmentId}`);
  }

  // Upload site photos
  async uploadPhotos(assessmentId: string, files: File[]): Promise<{ message: string }> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    return this.request<{ message: string }>(`/api/upload-photos/${assessmentId}`, {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let fetch set multipart/form-data boundary
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  /** Segment the roof under a pinned point (pin-to-roof detection). */
  async detectRoof(latitude: number, longitude: number, signal?: AbortSignal): Promise<RoofDetection> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/detect-roof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiError(0, error instanceof Error ? error.message : 'Network error');
    }
    if (!response.ok) throw new ApiError(response.status, await errorDetail(response));
    return response.json();
  }

  /** Download a report the server generates from its stored copy of the assessment. */
  async downloadReport(assessmentId: string, format: ReportFormat): Promise<DownloadedFile> {
    const path = REPORT_PATHS[format];
    return this.fetchFile(
      `${API_BASE_URL}/api/${path}/${encodeURIComponent(assessmentId)}`,
      { method: 'GET', headers: { Accept: REPORT_MIME_TYPES[format] } },
      defaultReportName(assessmentId, format),
    );
  }

  /** Have the server build a report from data the client already holds. */
  async downloadReportDirect(
    site: Partial<SiteDetailsInput>,
    result: Partial<AssessmentResult>,
    format: ReportFormat,
  ): Promise<DownloadedFile> {
    return this.fetchFile(
      `${API_BASE_URL}/api/generate-report-direct`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: REPORT_MIME_TYPES[format] },
        body: JSON.stringify({ site, result, format }),
      },
      defaultReportName(result.assessment_id || 'report', format),
    );
  }

  private async fetchFile(url: string, init: RequestInit, fallbackName: string): Promise<DownloadedFile> {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      // fetch only rejects when the server could not be reached at all
      throw new ApiError(0, error instanceof Error ? error.message : 'Network error');
    }
    if (!response.ok) {
      throw new ApiError(response.status, await errorDetail(response));
    }
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const blob = await response.blob();
    return {
      // Re-wrap so the Blob carries the right MIME type even if the server omitted it
      blob: blob.type ? blob : new Blob([blob], { type: contentType }),
      filename: filenameFromDisposition(response.headers.get('Content-Disposition')) || fallbackName,
    };
  }
}

export type ReportFormat = 'pdf' | 'txt' | 'zip';

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

/** HTTP failure with the server's `detail` message; status 0 means unreachable. */
export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
    this.name = 'ApiError';
  }
}

const REPORT_PATHS: Record<ReportFormat, string> = {
  pdf: 'generate-report',
  txt: 'generate-text-report',
  zip: 'download-reports',
};

export const REPORT_MIME_TYPES: Record<ReportFormat, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  zip: 'application/zip',
};

export const defaultReportName = (assessmentId: string, format: ReportFormat) =>
  `${format === 'zip' ? 'RTRWH_Reports' : 'RTRWH_Assessment'}_${assessmentId.slice(0, 8)}.${format}`;

/** Read FastAPI's {"detail": ...} body, falling back to the raw text. */
const errorDetail = async (response: Response): Promise<string> => {
  let text = '';
  try {
    text = await response.text();
    const json = JSON.parse(text);
    if (typeof json?.detail === 'string') return json.detail;
    if (json?.detail) return JSON.stringify(json.detail);
  } catch {
    // Not JSON; use the text as is
  }
  return text || `HTTP ${response.status}`;
};

export const filenameFromDisposition = (header: string | null): string | null => {
  if (!header) return null;
  const encoded = header.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // Malformed encoding; try the plain filename parameter instead
    }
  }
  const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
};

export const api = new BarkhaAPI();

// Utility functions
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatVolume = (volume: number): string => {
  return `${volume.toLocaleString('en-IN')} m³`;
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Constants
export const ROOF_MATERIALS = [
  'concrete',
  'tile', 
  'metal',
  'asbestos',
  'thatched'
] as const;

export const ROOF_CONDITIONS = [
  'good',
  'fair',
  'poor'
] as const;

export const SOIL_TYPES = [
  'sandy',
  'loamy', 
  'clay',
  'rocky'
] as const;

export const RECOMMENDATION_LABELS = {
  'storage_only': 'Storage System Only',
  'recharge_only': 'Recharge System Only', 
  'hybrid': 'Hybrid System (Storage + Recharge)',
  'storage_priority_hybrid': 'Storage Priority Hybrid',
  'not_feasible': 'Not Feasible'
} as const;