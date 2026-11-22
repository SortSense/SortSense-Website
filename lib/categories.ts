export type Availability = 'available' | 'nearly-full' | 'full' | 'unknown';
export type CategorySlug = 'plastic' | 'paper' | 'metal' | 'general';

export interface Bin {
  id: string;
  category: CategorySlug;
  label: string;
  status: Availability;
  fill: number | null;
  updated: string;
  accepts: string[];
  capacityLiters?: number;
  areaId?: string;
  areaName?: string;
  floorName?: string;
  operationalStatus?: string | null;
  readingSource?: 'HARDWARE' | 'SIMULATED' | null;
}

export interface DisposalArea {
  id: string;
  name: string;
  description?: string;
  bins: Bin[];
}

export interface Floor {
  id: string;
  name: string;
  order: number;
  areas: DisposalArea[];
}

export interface Station {
  id: string;
  name: string;
  landmark?: string;
  description?: string;
  imageUrl?: string | null;
  accessibility?: string;
  coordinates: [number, number] | null;
  distance?: number;
  walkTime?: number;
  hasValidCoordinates: boolean;
  bins: Bin[];
  floors?: Floor[];
}

export interface CategoryInfo {
  slug: CategorySlug;
  name: string;
  shortDescription: string;
  description: string;
  accepts: string[];
  avoids: string[];
  preparation: string;
  color: string;
}

export const categories: CategoryInfo[] = [
  {
    slug: 'plastic',
    name: 'Plastic',
    shortDescription: 'Clean bottles and rigid containers',
    description: 'Campus guidance for eligible plastic containers.',
    accepts: ['Drink bottles', 'Shampoo bottles', 'Clean food tubs'],
    avoids: ['Plastic bags', 'Food-soiled packaging', 'Foam containers'],
    preparation: 'Empty liquids and lightly rinse containers before disposal.',
    color: '#38A6A0',
  },
  {
    slug: 'paper',
    name: 'Paper',
    shortDescription: 'Clean paper and flattened cardboard',
    description: 'Guidance for dry, recyclable paper products.',
    accepts: ['Office paper', 'Newspapers', 'Flattened cardboard'],
    avoids: ['Used tissues', 'Waxed paper', 'Food-soiled card'],
    preparation: 'Keep items dry and flatten cardboard where possible.',
    color: '#D49A3A',
  },
  {
    slug: 'metal',
    name: 'Metal',
    shortDescription: 'Empty cans and eligible containers',
    description: 'Campus guidance for common metal packaging.',
    accepts: ['Drink cans', 'Food tins', 'Clean foil trays'],
    avoids: ['Batteries', 'Electronics', 'Pressurized canisters'],
    preparation: 'Empty and lightly rinse cans. Keep hazardous items separate.',
    color: '#71849A',
  },
  {
    slug: 'general',
    name: 'General waste',
    shortDescription: 'Items that cannot enter recycling',
    description: 'Guidance for non-recyclable everyday waste.',
    accepts: ['Used tissues', 'Food-soiled wrappers', 'Broken ceramics'],
    avoids: ['Batteries', 'Liquids', 'Electronic waste'],
    preparation: 'Bag loose or messy waste and keep liquids out.',
    color: '#776F68',
  },
];

export const statusLabels: Record<Availability, string> = {
  available: 'Available',
  'nearly-full': 'Nearly full',
  full: 'Full',
  unknown: 'Status unavailable',
};

export function availableCount(station: Station): number {
  return station.bins.filter((bin) => bin.status === 'available').length;
}
