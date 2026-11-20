export type DemoReadingSource = "SIMULATED" | "LEGACY" | "HARDWARE";
export type DemoOperationalStatus = "NORMAL" | "SENSOR_ERROR";

export interface DemoBin {
  binId: string;
  categoryName: string;
  categorySlug: "plastic" | "paper" | "metal" | "general";
  capacityLiters: number;
  fillPercentage: number | null;
  operationalStatus: DemoOperationalStatus;
  readingSource: DemoReadingSource;
}

export interface DemoDisposalArea {
  areaId: string;
  areaName: string;
  bins: DemoBin[];
}

export interface DemoFloor {
  floorId: string;
  floorName: string;
  disposalAreas: DemoDisposalArea[];
}

export interface DemoStation {
  stationCode: string;
  stationName: string;
  locationName: string;
  description: string;
  floors: DemoFloor[];
}

export const PITCH_DEMO_STATIONS: DemoStation[] = [
  {
    stationCode: "NTHU-SHUIMU",
    stationName: "NTHU Shuimu Center",
    locationName: "NTHU Main Campus",
    description:
      "Deterministic pitch fallback view — zero live database writes",
    floors: [
      {
        floorId: "demo-fl-1",
        floorName: "1F",
        disposalAreas: [
          {
            areaId: "demo-ar-1",
            areaName: "Main Hallway",
            bins: [
              {
                binId: "c01645cf-6eab-4dc5-9a79-4a9b9405f37f",
                categoryName: "Plastic",
                categorySlug: "plastic",
                capacityLiters: 60,
                fillPercentage: 85,
                operationalStatus: "NORMAL",
                readingSource: "SIMULATED",
              },
              {
                binId: "bda84bad-82cf-4bb8-b8a5-d1c09e984536",
                categoryName: "Paper",
                categorySlug: "paper",
                capacityLiters: 60,
                fillPercentage: 40,
                operationalStatus: "NORMAL",
                readingSource: "SIMULATED",
              },
              {
                binId: "694f269a-f7f7-4a82-b19b-c7b3d42a81d4",
                categoryName: "Metal",
                categorySlug: "metal",
                capacityLiters: 60,
                fillPercentage: 15,
                operationalStatus: "NORMAL",
                readingSource: "SIMULATED",
              },
              {
                binId: "6f7644f3-9597-43c7-a45a-ecefd0953374",
                categoryName: "General Waste",
                categorySlug: "general",
                capacityLiters: 60,
                fillPercentage: null,
                operationalStatus: "SENSOR_ERROR",
                readingSource: "SIMULATED",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    stationCode: "RLS-TEST-STATION",
    stationName: "RLS Test Station",
    locationName: "RLS Test Location",
    description:
      "Legacy baseline record preserved alongside simulated telemetry",
    floors: [
      {
        floorId: "demo-fl-rls",
        floorName: "Unassigned Floor",
        disposalAreas: [
          {
            areaId: "demo-ar-rls",
            areaName: "Unassigned Area",
            bins: [
              {
                binId: "d1819ce1-d4f5-4bb5-bd0c-b1fabdc6c886",
                categoryName: "Plastic",
                categorySlug: "plastic",
                capacityLiters: 50,
                fillPercentage: 75,
                operationalStatus: "NORMAL",
                readingSource: "LEGACY",
              },
            ],
          },
        ],
      },
    ],
  },
];
