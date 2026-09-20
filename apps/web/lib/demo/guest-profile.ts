import {
  Bed,
  Briefcase,
  Car,
  Clock,
  Gift,
  Leaf,
  VolumeX,
  Wifi,
  type LucideIcon,
} from "lucide-react";

/**
 * Demo guest profiles — the Guest DNA surface.
 *
 * Preferences carry an icon and a source, because a preference the front desk cannot
 * trace is one they will not act on: "sea-facing room" is worth honouring when it came
 * from three previous stays and worth checking when someone typed it once.
 */

export interface Preference {
  label: string;
  icon: LucideIcon;
}

export interface SentimentPoint {
  date: string;
  score: number;
  /** Prediction band around the smoothed score. */
  range: [number, number];
}

export interface StayRecord {
  checkIn: string;
  checkOut: string;
  roomType: string;
  nights: number;
  amount: number;
  feedback: number | null;
}

export interface GuestNote {
  note: string;
  source: string;
  date: string;
}

export interface GuestProfile {
  id: string;
  name: string;
  tier: string;
  memberSince: string;
  location: string;
  email: string;
  phone: string;
  quote: string | null;
  pastStays: number;
  totalSpend: number;
  avgNights: number;
  lastStay: string;
  /** Out of 10. The staff-review score from the performance engine, rescaled. */
  guestRating: number | null;
  preferences: Preference[];
  sentiment: SentimentPoint[];
  sentimentAverage: number;
  stays: StayRecord[];
  notes: GuestNote[];
}

export const guests: GuestProfile[] = [
  {
    id: "g1",
    name: "Rohan Mehta",
    tier: "Gold Elite",
    memberSince: "2022",
    location: "Mumbai, India",
    email: "rohan.mehta@gmail.com",
    phone: "+91 98765 43210",
    quote: "Always a pleasure to be back. The team here feels like family.",
    pastStays: 5,
    totalSpend: 4_28_500,
    avgNights: 2.8,
    lastStay: "Mar 2024",
    guestRating: 9.6,
    preferences: [
      { label: "Sea-facing room", icon: Leaf },
      { label: "Late checkout", icon: Clock },
      { label: "Jain meal (no onion/garlic)", icon: Leaf },
      { label: "Airport pickup", icon: Car },
      { label: "Quiet floor", icon: VolumeX },
      { label: "Extra pillows", icon: Bed },
      { label: "Welcome amenity", icon: Gift },
      { label: "High-speed Wi-Fi", icon: Wifi },
      { label: "Business traveller", icon: Briefcase },
    ],
    sentiment: [
      { date: "Jan 2023", score: 62, range: [54, 70] },
      { date: "Apr 2023", score: 66, range: [58, 74] },
      { date: "Jul 2023", score: 60, range: [52, 68] },
      { date: "Oct 2023", score: 64, range: [56, 72] },
      { date: "Jan 2024", score: 76, range: [68, 84] },
      { date: "Apr 2024", score: 74, range: [66, 82] },
      { date: "Jul 2024", score: 68, range: [60, 76] },
      { date: "Oct 2024", score: 78, range: [70, 86] },
      { date: "Jan 2025", score: 86, range: [78, 92] },
    ],
    sentimentAverage: 82,
    stays: [
      { checkIn: "12 Mar 2024", checkOut: "15 Mar 2024", roomType: "Deluxe Sea View", nights: 3, amount: 78_300, feedback: 9 },
      { checkIn: "18 Nov 2023", checkOut: "21 Nov 2023", roomType: "Executive", nights: 3, amount: 62_700, feedback: 10 },
      { checkIn: "05 Aug 2023", checkOut: "08 Aug 2023", roomType: "Deluxe", nights: 3, amount: 54_000, feedback: 8 },
      { checkIn: "14 Jan 2023", checkOut: "16 Jan 2023", roomType: "Executive Sea View", nights: 2, amount: 71_500, feedback: 9 },
      { checkIn: "22 Jun 2022", checkOut: "25 Jun 2022", roomType: "Deluxe", nights: 3, amount: 62_000, feedback: 8 },
    ],
    notes: [
      { note: "Prefers room on higher floors", source: "Front Desk", date: "15 Mar 2024" },
      { note: "Celebrated anniversary during stay", source: "Guest Relations", date: "14 Jan 2023" },
      { note: "Appreciated the service at Saffron (F&B)", source: "F&B", date: "16 Jan 2023" },
      { note: "Regular business traveller, corporate booking", source: "Sales", date: "20 Jun 2022" },
    ],
  },
];

export interface AtRiskGuest {
  id: string;
  name: string;
  lastStay: string;
  daysSince: number;
  risk: "high" | "medium";
}

export const atRisk: AtRiskGuest[] = [
  { id: "ar1", name: "Ananya Sharma", lastStay: "Mar 2024", daysSince: 120, risk: "high" },
  { id: "ar2", name: "Vikram Iyer", lastStay: "Apr 2024", daysSince: 95, risk: "medium" },
  { id: "ar3", name: "Neha Kapoor", lastStay: "May 2024", daysSince: 88, risk: "medium" },
  { id: "ar4", name: "Dev Patel", lastStay: "Feb 2024", daysSince: 102, risk: "medium" },
  { id: "ar5", name: "Sneha Rao", lastStay: "Jan 2024", daysSince: 110, risk: "medium" },
];

export const suggestedOffer = {
  title: "Complimentary Sea View Upgrade",
  detail: "Offer a complimentary upgrade to a Sea Facing room for their next stay.",
  tags: ["Likely to increase retention", "Aligns with preferences"],
};
