export type WasteCategory = 'plastic' | 'paper' | 'metal' | 'general';

export type StatusColor = 'green' | 'yellow' | 'red';

export interface FillLevels {
  plastic: number;
  paper: number;
  metal: number;
  general: number;
}

export interface StationLiveStatus {
  station_id: string;
  name: string;
  latitude: number;
  longitude: number;
  is_online: boolean;
  max_fill_pct: number;
  status_color: StatusColor;
  fill_levels: FillLevels;
  updated_at: string;
}

export interface LiveStatusResponse {
  stations: StationLiveStatus[];
}

export interface CategoryBreakdown {
  plastic: number;
  paper: number;
  metal: number;
  general: number;
}

export interface AnalyticsData {
  total_items_today: number;
  sorting_accuracy_pct: number;
  breakdown: CategoryBreakdown;
}

export interface WasteEvent {
  event_id: string;
  station_id: string;
  waste_category: WasteCategory;
  dropped_in_bin: WasteCategory;
  confidence: number;
  is_correct_sort: boolean;
  timestamp: string;
}
