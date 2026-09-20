/**
 * Demo roster for the week of 17–23 Nov 2026.
 *
 * `required` comes from the workforce optimiser and `scheduled` from what is actually
 * on the rota, so the gap between them is the whole point of the screen. Two departments
 * are deliberately short — a roster page where everything is fine teaches nobody how the
 * warnings read.
 */

export interface DepartmentStaffing {
  department: string;
  required: number;
  scheduled: number;
}

export const staffing: DepartmentStaffing[] = [
  { department: "Front Desk", required: 32, scheduled: 30 },
  { department: "Housekeeping", required: 60, scheduled: 54 },
  { department: "F&B", required: 48, scheduled: 48 },
  { department: "Maintenance", required: 18, scheduled: 14 },
  { department: "Security", required: 24, scheduled: 24 },
  { department: "Concierge", required: 16, scheduled: 12 },
  { department: "Spa & Wellness", required: 14, scheduled: 14 },
];

export type ShiftName = "Morning" | "Afternoon" | "Evening" | "Night" | "Day" | "Unassigned";

export interface RosterCell {
  shift: ShiftName;
  person: string | null;
}

export interface RosterRow {
  department: string;
  /** Seven cells, Monday through Sunday. */
  days: RosterCell[];
}

/** Tint per shift. Unassigned is the one that has to catch the eye. */
export const shiftTone: Record<ShiftName, string> = {
  Morning: "border-sage-200 bg-sage-50 text-sage-900",
  Day: "border-sage-200 bg-sage-50 text-sage-900",
  Afternoon: "border-sand-200 bg-sand-100 text-sand-800",
  Evening: "border-gold-200 bg-gold-50 text-gold-900",
  Night: "border-sand-300 bg-sand-100 text-sand-800",
  Unassigned: "border-rose-200 bg-rose-50 text-rose-700",
};

export const WEEK = [
  { label: "Mon", date: "17 Nov" },
  { label: "Tue", date: "18 Nov" },
  { label: "Wed", date: "19 Nov" },
  { label: "Thu", date: "20 Nov" },
  { label: "Fri", date: "21 Nov" },
  { label: "Sat", date: "22 Nov" },
  { label: "Sun", date: "23 Nov" },
] as const;

const cell = (shift: ShiftName, person: string | null = null): RosterCell => ({ shift, person });

export const roster: RosterRow[] = [
  {
    department: "Front Desk",
    days: [
      cell("Morning", "Aarav Sharma"),
      cell("Morning", "Neha Kulkarni"),
      cell("Evening", "Rohan Mehta"),
      cell("Morning", "Aarav Sharma"),
      cell("Evening", "Priya Nair"),
      cell("Morning", "Neha Kulkarni"),
      cell("Evening", "Rohan Mehta"),
    ],
  },
  {
    department: "Housekeeping",
    days: [
      cell("Morning", "Sunita Yadav"),
      cell("Morning", "Rajesh Patil"),
      cell("Afternoon", "Pooja Singh"),
      cell("Morning", "Sunita Yadav"),
      cell("Afternoon", "Imran Shaikh"),
      cell("Morning", "Rajesh Patil"),
      cell("Afternoon", "Pooja Singh"),
    ],
  },
  {
    department: "F&B",
    days: [
      cell("Morning", "Vikram Rao"),
      cell("Evening", "Sneha Iyer"),
      cell("Evening", "Karan Deshmukh"),
      cell("Morning", "Vikram Rao"),
      cell("Evening", "Sneha Iyer"),
      cell("Evening", "Karan Deshmukh"),
      cell("Morning", "Anjali Verma"),
    ],
  },
  {
    department: "Maintenance",
    days: [
      cell("Day", "Suresh Jadhav"),
      cell("Day", "Manoj Kumar"),
      cell("Unassigned"),
      cell("Night", "Ramesh Gupta"),
      cell("Day", "Suresh Jadhav"),
      cell("Unassigned"),
      cell("Night", "Ramesh Gupta"),
    ],
  },
  {
    department: "Security",
    days: [
      cell("Day", "Amit Singh"),
      cell("Night", "Deepak Rawat"),
      cell("Day", "Amit Singh"),
      cell("Night", "Sanjay Yadav"),
      cell("Day", "Amit Singh"),
      cell("Night", "Deepak Rawat"),
      cell("Day", "Sanjay Yadav"),
    ],
  },
  {
    department: "Concierge",
    days: [
      cell("Morning", "Kunal Malhotra"),
      cell("Unassigned"),
      cell("Evening", "Ritika Soni"),
      cell("Morning", "Kunal Malhotra"),
      cell("Unassigned"),
      cell("Evening", "Ritika Soni"),
      cell("Morning", "Arjun Nair"),
    ],
  },
  {
    department: "Spa & Wellness",
    days: [
      cell("Morning", "Meera Iyer"),
      cell("Evening", "Aditya Bhat"),
      cell("Morning", "Meera Iyer"),
      cell("Evening", "Simran Kaur"),
      cell("Morning", "Aditya Bhat"),
      cell("Evening", "Simran Kaur"),
      cell("Morning", "Meera Iyer"),
    ],
  },
];

export interface StaffingAlert {
  id: string;
  title: string;
  detail: string;
  severity: "warning" | "info";
}

export const alerts: StaffingAlert[] = [
  {
    id: "a1",
    title: "Maintenance is understaffed",
    detail: "14 scheduled vs 18 required (−4)",
    severity: "warning",
  },
  {
    id: "a2",
    title: "Concierge is understaffed",
    detail: "12 scheduled vs 16 required (−4)",
    severity: "warning",
  },
  {
    id: "a3",
    title: "Overall staffing is at 93% of requirement",
    detail: "2 departments need attention.",
    severity: "info",
  },
];

export const SHIFTS = ["All Shifts", "Morning", "Afternoon", "Evening", "Night", "Day"] as const;
