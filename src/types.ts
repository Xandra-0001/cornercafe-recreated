export type Zone = 'Window' | 'Indoor' | 'Patio';

export interface CafeTable {
  id: string; // e.g. "T1"
  name: string;
  zone: Zone;
  floor: 1 | 2 | 3;
  capacity: number; // e.g. 2, 4, 6
  isAvailable: boolean;
  x: number; // SVG pixel coordinate X
  y: number; // SVG pixel coordinate Y
  width: number;
  height: number;
  shape?: 'round' | 'rect';
  description?: string;
  features?: string[];
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'Coffee & Brews' | 'Tea & Matchas' | 'Pastries & Bakes' | 'Sandwiches & Savory';
  price: number;
  description: string;
  tags?: string[];
}

export interface PreOrderItem {
  item: MenuItem;
  quantity: number;
}

export interface Booking {
  id: string;
  referenceNumber: string;
  date: string;
  timeSlot: string;
  partySize: number;
  table: CafeTable;
  preOrders: PreOrderItem[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  specialRequests: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  createdAt: string;
}

export interface WizardState {
  date: string;
  partySize: number;
  selectedTable: CafeTable | null;
  timeSlot: string;
  preOrders: PreOrderItem[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  specialRequests: string;
}
