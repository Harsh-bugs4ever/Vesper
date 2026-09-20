/**
 * Demo room inventory and housekeeping state for a 302-room property.
 *
 * Built from a fixed pattern rather than `Math.random`: the board is server-rendered and
 * then hydrated, and a random layout would differ between the two passes and surface as
 * a hydration mismatch. A deterministic spread also means a demo looks the same twice.
 *
 * The status counts are exact by construction — a pool holding precisely the intended
 * number of each status is dealt out in a stride that scatters them. That way the
 * headline tiles are computed from the same rooms the board draws, and the two can never
 * disagree.
 */

export type RoomStatus = "ready" | "cleaning" | "dirty" | "blocked" | "out_of_order";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Room {
  number: string;
  floor: number;
  category: string;
  status: RoomStatus;
  /** Minutes elapsed in the current clean. Only meaningful while cleaning. */
  cleaningMinutes?: number;
  attendant?: string;
  attendantRole?: string;
  /** The departing or in-house guest, when there is one. */
  guest?: string;
  guestNote?: string;
  estimatedMinutes: number;
  checklist: ChecklistItem[];
}

const ATTENDANTS = [
  { name: "Sunita Yadav", role: "Room Attendant" },
  { name: "Rajesh Patil", role: "Room Attendant" },
  { name: "Pooja Singh", role: "Senior Attendant" },
  { name: "Imran Shaikh", role: "Room Attendant" },
  { name: "Meena Shinde", role: "Floor Supervisor" },
  { name: "Anjali Deshmukh", role: "Room Attendant" },
] as const;

const GUESTS = [
  "Mr. Rohan Mehta",
  "Ms. Kavya Iyer",
  "Dr. Sanjay Kulkarni",
  "Mrs. Leela Menon",
  "Mr. Faisal Khan",
  "Ms. Divya Rao",
  "Mr. Nikhil Bose",
  "Ms. Ritu Chandran",
] as const;

/** The standard clean, in the order an attendant works through a room. */
const STANDARD_CHECKLIST: { id: string; label: string }[] = [
  { id: "linen", label: "Strip bed and change linen" },
  { id: "bathroom", label: "Clean bathroom" },
  { id: "floor", label: "Vacuum and mop" },
  { id: "dust", label: "Dust surfaces" },
  { id: "amenities", label: "Restock amenities" },
  { id: "inspect", label: "Final inspection" },
];

export interface FloorPlan {
  floor: number;
  category: string;
  rooms: number;
}

/** Floors 2–21 at fifteen rooms each, plus two presidential suites on 22. */
function buildFloorPlan(): FloorPlan[] {
  const plan: FloorPlan[] = [];
  for (let floor = 2; floor <= 21; floor += 1) {
    const category =
      floor <= 7 ? "Deluxe" : floor <= 13 ? "Executive" : floor <= 18 ? "Premium" : "Suite";
    plan.push({ floor, category, rooms: 15 });
  }
  plan.push({ floor: 22, category: "Presidential", rooms: 2 });
  return plan;
}

export const floorPlan: FloorPlan[] = buildFloorPlan();

/** Exactly these many of each, summing to 302. */
const STATUS_COUNTS: [RoomStatus, number][] = [
  ["ready", 184],
  ["dirty", 64],
  ["cleaning", 28],
  ["blocked", 24],
  ["out_of_order", 2],
];

/**
 * Deal the status pool out in a co-prime stride so the same statuses do not clump on
 * one floor. 97 shares no factor with 302, so stepping by it visits every slot once.
 */
function dealStatuses(total: number): RoomStatus[] {
  const pool: RoomStatus[] = [];
  for (const [status, count] of STATUS_COUNTS) {
    for (let i = 0; i < count; i += 1) pool.push(status);
  }

  const dealt = new Array<RoomStatus>(total);
  let slot = 0;
  for (const status of pool) {
    while (dealt[slot] !== undefined) slot = (slot + 1) % total;
    dealt[slot] = status;
    slot = (slot + 97) % total;
  }
  return dealt;
}

function buildRooms(): Room[] {
  const total = floorPlan.reduce((sum, floor) => sum + floor.rooms, 0);
  const statuses = dealStatuses(total);

  const rooms: Room[] = [];
  let index = 0;

  for (const floor of floorPlan) {
    for (let slot = 1; slot <= floor.rooms; slot += 1) {
      const status = statuses[index];
      const attendant = ATTENDANTS[index % ATTENDANTS.length];
      const needsAttendant = status === "cleaning" || status === "dirty";

      // Cleans run 8–30 minutes; suites take longer than a standard room.
      const estimated = floor.category === "Suite" || floor.category === "Presidential" ? 45 : 30;
      const elapsed = 8 + ((index * 7) % 23);

      // Part-done checklists on rooms in progress, untouched ones elsewhere.
      const progress = status === "cleaning" ? 1 + (index % 4) : 0;

      rooms.push({
        number: `${floor.floor}${String(slot).padStart(2, "0")}`,
        floor: floor.floor,
        category: floor.category,
        status,
        cleaningMinutes: status === "cleaning" ? elapsed : undefined,
        attendant: needsAttendant ? attendant.name : undefined,
        attendantRole: needsAttendant ? attendant.role : undefined,
        guest: status === "dirty" ? GUESTS[index % GUESTS.length] : undefined,
        guestNote: status === "dirty" ? "Checked out at 10:15 AM" : undefined,
        estimatedMinutes: estimated,
        checklist: STANDARD_CHECKLIST.map((item, position) => ({
          ...item,
          done: position < progress,
        })),
      });

      index += 1;
    }
  }

  return rooms;
}

export const rooms: Room[] = buildRooms();

export const statusMeta: Record<
  RoomStatus,
  { label: string; dot: string; tile: string; chip: string }
> = {
  ready: {
    label: "Ready",
    dot: "bg-emerald-500",
    tile: "border-emerald-200 bg-emerald-50 text-emerald-900",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  cleaning: {
    label: "Cleaning",
    dot: "bg-sage-400",
    tile: "border-sage-200 bg-sage-50 text-sage-900",
    chip: "border-sage-200 bg-sage-50 text-sage-800",
  },
  dirty: {
    label: "Dirty",
    dot: "bg-gold-500",
    tile: "border-gold-200 bg-gold-50 text-gold-900",
    chip: "border-gold-200 bg-gold-50 text-gold-800",
  },
  blocked: {
    label: "Blocked",
    dot: "bg-sand-400",
    tile: "border-sand-200 bg-sand-100 text-sand-700",
    chip: "border-sand-200 bg-sand-100 text-sand-700",
  },
  out_of_order: {
    label: "Out of Order",
    dot: "bg-rose-400",
    tile: "border-rose-200 bg-rose-50 text-rose-800",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

/** Where a room goes when the attendant advances it, and what the button should say. */
export const nextStatus: Partial<Record<RoomStatus, { to: RoomStatus; action: string }>> = {
  dirty: { to: "cleaning", action: "Mark as Cleaning" },
  cleaning: { to: "ready", action: "Mark as Ready" },
  ready: { to: "dirty", action: "Mark for Cleaning" },
};

export const ROOM_TYPES = ["Deluxe", "Executive", "Premium", "Suite", "Presidential"] as const;

export const ATTENDANT_NAMES = ATTENDANTS.map((person) => person.name);
