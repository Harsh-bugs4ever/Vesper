/**
 * Demo guest requests, as they arrive from the in-room QR page.
 *
 * Each request carries the SLA its department promised and how long it has actually been
 * open, because the only number a duty manager cares about is the gap between the two.
 */

export type RequestChannel = "Room Service" | "Housekeeping" | "Maintenance" | "Front Desk";

export type RequestState = "new" | "accepted" | "done";

export interface GuestRequest {
  id: string;
  room: string;
  guest: string;
  channel: RequestChannel;
  summary: string;
  detail: string;
  raisedAt: string;
  /** Minutes since the guest raised it. */
  openFor: number;
  /** Minutes the department promises for this channel. */
  sla: number;
  state: RequestState;
  assignee?: string;
  /** Rupees, for orders that carry a charge. */
  value?: number;
}

export const channelMeta: Record<RequestChannel, { chip: string; sla: number }> = {
  "Room Service": { chip: "border-gold-200 bg-gold-50 text-gold-800", sla: 30 },
  Housekeeping: { chip: "border-sage-200 bg-sage-50 text-sage-800", sla: 20 },
  Maintenance: { chip: "border-rose-200 bg-rose-50 text-rose-700", sla: 45 },
  "Front Desk": { chip: "border-sand-200 bg-sand-100 text-sand-700", sla: 15 },
};

export const requests: GuestRequest[] = [
  {
    id: "REQ-4181",
    room: "318",
    guest: "Mr. Arvind Nair",
    channel: "Maintenance",
    summary: "AC not cooling",
    detail: "Guest reports the room has not cooled since check-in. Photo attached of the panel.",
    raisedAt: "5:54 PM",
    openFor: 52,
    sla: 45,
    state: "accepted",
    assignee: "Sameer Joshi",
  },
  {
    id: "REQ-4180",
    room: "612",
    guest: "Mr. Rohan Mehta",
    channel: "Room Service",
    summary: "Club sandwich, masala chai ×2",
    detail: "No onion. Deliver to the balcony table.",
    raisedAt: "6:02 PM",
    openFor: 34,
    sla: 30,
    state: "accepted",
    assignee: "Neha Kulkarni",
    value: 1_240,
  },
  {
    id: "REQ-4179",
    room: "204",
    guest: "Ms. Kavya Iyer",
    channel: "Housekeeping",
    summary: "Extra towels and pillows",
    detail: "Two bath towels, one extra pillow.",
    raisedAt: "6:18 PM",
    openFor: 18,
    sla: 20,
    state: "new",
  },
  {
    id: "REQ-4178",
    room: "507",
    guest: "Dr. Sanjay Kulkarni",
    channel: "Front Desk",
    summary: "Airport cab for 5:30 AM",
    detail: "Departure to T2. Sedan, one large suitcase.",
    raisedAt: "6:21 PM",
    openFor: 15,
    sla: 15,
    state: "new",
  },
  {
    id: "REQ-4177",
    room: "411",
    guest: "Mrs. Leela Menon",
    channel: "Housekeeping",
    summary: "Room cleaning requested",
    detail: "Guest stepping out for dinner, asks for a turndown while away.",
    raisedAt: "6:24 PM",
    openFor: 12,
    sla: 20,
    state: "accepted",
    assignee: "Anjali Deshmukh",
  },
  {
    id: "REQ-4176",
    room: "129",
    guest: "Mr. Faisal Khan",
    channel: "Room Service",
    summary: "Paneer tikka, two fresh lime sodas",
    detail: "Less spicy. Allergy noted: no peanuts.",
    raisedAt: "6:29 PM",
    openFor: 7,
    sla: 30,
    state: "new",
    value: 980,
  },
  {
    id: "REQ-4175",
    room: "233",
    guest: "Ms. Divya Rao",
    channel: "Maintenance",
    summary: "Bathroom tap dripping",
    detail: "Slow but constant drip from the basin tap.",
    raisedAt: "6:31 PM",
    openFor: 5,
    sla: 45,
    state: "new",
  },
  {
    id: "REQ-4174",
    room: "308",
    guest: "Mr. Nikhil Bose",
    channel: "Front Desk",
    summary: "Late check-out to 2 PM",
    detail: "Flight at 5 PM. Willing to pay the half-day charge if needed.",
    raisedAt: "6:33 PM",
    openFor: 3,
    sla: 15,
    state: "new",
  },
  {
    id: "REQ-4173",
    room: "405",
    guest: "Ms. Priya Sharma",
    channel: "Housekeeping",
    summary: "Turndown completed",
    detail: "Standard evening turndown.",
    raisedAt: "6:20 PM",
    openFor: 16,
    sla: 20,
    state: "done",
    assignee: "Ramesh Patil",
  },
  {
    id: "REQ-4172",
    room: "118",
    guest: "Mr. Tarun Gupta",
    channel: "Room Service",
    summary: "Breakfast tray collected",
    detail: "Tray cleared from the corridor.",
    raisedAt: "10:40 AM",
    openFor: 22,
    sla: 30,
    state: "done",
    assignee: "Farhan Qureshi",
    value: 760,
  },
];

export const CHANNELS: RequestChannel[] = [
  "Room Service",
  "Housekeeping",
  "Maintenance",
  "Front Desk",
];
