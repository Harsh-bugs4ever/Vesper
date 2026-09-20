/**
 * Demo attendance and task state for the staff section.
 *
 * Times are plain strings rather than Date objects on purpose: they are display values
 * for a single property in a single timezone, and parsing them into dates on the client
 * would silently re-interpret them in the viewer's zone — the timezone bug the sprint
 * plan calls out for Day 1.
 */

export type AttendanceState = "on_shift" | "on_break" | "late" | "absent" | "off_duty";

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: Department;
  shift: string;
  checkIn: string | null;
  state: AttendanceState;
  tasksDone: number;
  tasksAssigned: number;
}

export type Department =
  | "Housekeeping"
  | "Food & Beverage"
  | "Front Office"
  | "Engineering"
  | "Spa & Wellness";

export const attendanceMeta: Record<AttendanceState, { label: string; chip: string; dot: string }> = {
  on_shift: {
    label: "On shift",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  on_break: {
    label: "On break",
    chip: "border-sand-200 bg-sand-100 text-sand-700",
    dot: "bg-sand-400",
  },
  late: {
    label: "Late",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  absent: {
    label: "Absent",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
  off_duty: {
    label: "Off duty",
    chip: "border-sand-200 bg-white text-sand-500",
    dot: "bg-sand-300",
  },
};

export const staff: StaffMember[] = [
  {
    id: "s1",
    name: "Ramesh Patil",
    role: "Housekeeping Attendant",
    department: "Housekeeping",
    shift: "07:00 – 15:30",
    checkIn: "06:52",
    state: "on_shift",
    tasksDone: 11,
    tasksAssigned: 14,
  },
  {
    id: "s2",
    name: "Anjali Deshmukh",
    role: "Floor Attendant (Villas)",
    department: "Housekeeping",
    shift: "07:00 – 15:30",
    checkIn: "07:04",
    state: "on_shift",
    tasksDone: 9,
    tasksAssigned: 12,
  },
  {
    id: "s3",
    name: "Sunita Kamble",
    role: "Housekeeping Attendant",
    department: "Housekeeping",
    shift: "07:00 – 15:30",
    checkIn: "07:26",
    state: "late",
    tasksDone: 7,
    tasksAssigned: 13,
  },
  {
    id: "s4",
    name: "Vikram Jadhav",
    role: "Senior Attendant",
    department: "Housekeeping",
    shift: "07:00 – 15:30",
    checkIn: "06:48",
    state: "on_break",
    tasksDone: 10,
    tasksAssigned: 11,
  },
  {
    id: "s5",
    name: "Imran Shaikh",
    role: "Commis Chef",
    department: "Food & Beverage",
    shift: "06:00 – 14:30",
    checkIn: "05:55",
    state: "on_shift",
    tasksDone: 8,
    tasksAssigned: 9,
  },
  {
    id: "s6",
    name: "Neha Kulkarni",
    role: "Restaurant Steward",
    department: "Food & Beverage",
    shift: "11:00 – 20:00",
    checkIn: "11:02",
    state: "on_shift",
    tasksDone: 5,
    tasksAssigned: 8,
  },
  {
    id: "s7",
    name: "Farhan Qureshi",
    role: "Room Service Attendant",
    department: "Food & Beverage",
    shift: "11:00 – 20:00",
    checkIn: null,
    state: "absent",
    tasksDone: 0,
    tasksAssigned: 7,
  },
  {
    id: "s8",
    name: "Priya Nair",
    role: "Front Office Executive",
    department: "Front Office",
    shift: "07:00 – 15:30",
    checkIn: "06:58",
    state: "on_shift",
    tasksDone: 6,
    tasksAssigned: 6,
  },
  {
    id: "s9",
    name: "Aditya Rane",
    role: "Guest Relations",
    department: "Front Office",
    shift: "14:00 – 22:30",
    checkIn: "13:56",
    state: "on_shift",
    tasksDone: 4,
    tasksAssigned: 7,
  },
  {
    id: "s10",
    name: "Rajesh Verma",
    role: "Engineering Lead",
    department: "Engineering",
    shift: "08:00 – 17:00",
    checkIn: "07:51",
    state: "on_shift",
    tasksDone: 3,
    tasksAssigned: 5,
  },
  {
    id: "s11",
    name: "Sameer Joshi",
    role: "Maintenance Technician",
    department: "Engineering",
    shift: "08:00 – 17:00",
    checkIn: "08:19",
    state: "late",
    tasksDone: 2,
    tasksAssigned: 6,
  },
  {
    id: "s12",
    name: "Meena Shinde",
    role: "Spa Therapist",
    department: "Spa & Wellness",
    shift: "10:00 – 19:00",
    checkIn: "09:52",
    state: "on_shift",
    tasksDone: 4,
    tasksAssigned: 4,
  },
  {
    id: "s13",
    name: "Kiran Bhosale",
    role: "Spa Receptionist",
    department: "Spa & Wellness",
    shift: "10:00 – 19:00",
    checkIn: null,
    state: "off_duty",
    tasksDone: 0,
    tasksAssigned: 0,
  },
];

export const DEPARTMENTS: Department[] = [
  "Housekeeping",
  "Food & Beverage",
  "Front Office",
  "Engineering",
  "Spa & Wellness",
];
