export type WasteCategory = 'plastic' | 'paper' | 'metal' | 'general';

export type StatusColor = 'green' | 'yellow' | 'red';

export type StationConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface FillLevels {
  plastic: number | null;
  paper: number | null;
  metal: number | null;
  general: number | null;
}

export interface LiveBinItem {
  bin_id: string;
  category_id?: string | null;
  category_slug?: WasteCategory | null;
  category_name: string;
  capacity_liters: number;
  fill_percentage: number | null;
  operational_status?: string | null;
  reading_source?: 'HARDWARE' | 'SIMULATED' | null;
  updated_at: string | null;
}

export interface LiveDisposalArea {
  area_id: string;
  area_name: string;
  description?: string | null;
  bins: LiveBinItem[];
}

export interface LiveFloor {
  floor_id: string;
  floor_name: string;
  floor_order: number;
  disposal_areas: LiveDisposalArea[];
}

export interface StationLiveStatus {
  station_id: string;
  name: string;
  location_name?: string | null;
  description?: string | null;
  image_url?: string | null;
  latitude: number | null;
  longitude: number | null;
  is_online: boolean;
  connectivity_status?: StationConnectivityStatus;
  is_stale?: boolean;
  has_sensor_error?: boolean;
  sensor_error_categories?: string[];
  max_fill_pct: number | null;
  status_color: StatusColor | null;
  fill_levels: FillLevels;
  updated_at: string | null;
  floors?: LiveFloor[];
}

export interface LiveStatusResponse {
  stations: StationLiveStatus[];
  total_active_stations?: number;
  total_waste_categories?: number;
  total_monitored_compartments?: number;
  total_drop_events?: number | null;
}

export interface CategoryBreakdown {
  plastic: number;
  paper: number;
  metal: number;
  general: number;
}

export interface AnalyticsData {
  total_items_today: number;
  sorting_accuracy_pct: number | null;
  breakdown: CategoryBreakdown;
}

export interface WasteEvent {
  event_id: string;
  station_id: string;
  waste_category: WasteCategory | 'unknown';
  dropped_in_bin: WasteCategory | 'unknown';
  confidence: number;
  is_correct_sort: boolean | null;
  timestamp: string;
}
