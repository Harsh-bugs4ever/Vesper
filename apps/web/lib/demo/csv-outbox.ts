/**
 * Demo data for the CSV Import & Outbox features (Day 9).
 */

export interface CsvImportRow {
  row: number;
  guestName: string;
  email: string;
  roomCategory: string;
  checkIn: string;
  checkOut: string;
  status: "valid" | "warning" | "error";
  message?: string;
}

export interface OutboxMessage {
  id: string;
  channel: "whatsapp" | "sms" | "email";
  recipient: string;
  subject: string;
  preview: string;
  status: "delivered" | "sent" | "failed" | "queued";
  sentAt: string;
  template?: string;
}

export const csvDryRunResults: CsvImportRow[] = [
  { row: 1, guestName: "Aditya Kapoor", email: "aditya.k@gmail.com", roomCategory: "DLX_OCN", checkIn: "2026-12-18", checkOut: "2026-12-22", status: "valid" },
  { row: 2, guestName: "Sarah Mitchell", email: "sarah.m@outlook.com", roomCategory: "EXEC_STE", checkIn: "2026-12-19", checkOut: "2026-12-23", status: "valid" },
  { row: 3, guestName: "Rajesh Iyer", email: "rajesh.iyer@", roomCategory: "DLX_OCN", checkIn: "2026-12-20", checkOut: "2026-12-24", status: "error", message: "Invalid email format" },
  { row: 4, guestName: "Meera Joshi", email: "meera.j@yahoo.com", roomCategory: "UNKNOWN_CAT", checkIn: "2026-12-18", checkOut: "2026-12-21", status: "error", message: "Room category 'UNKNOWN_CAT' not found in property inventory" },
  { row: 5, guestName: "David Chen", email: "d.chen@proton.me", roomCategory: "PRES_VIL", checkIn: "2026-12-22", checkOut: "2026-12-20", status: "error", message: "Check-out date is before check-in date" },
  { row: 6, guestName: "Ananya Reddy", email: "ananya.r@gmail.com", roomCategory: "SEA_CLB", checkIn: "2026-12-20", checkOut: "2026-12-25", status: "valid" },
  { row: 7, guestName: "James O'Brien", email: "james.ob@icloud.com", roomCategory: "DLX_OCN", checkIn: "2026-12-24", checkOut: "2026-12-28", status: "warning", message: "Potential duplicate: guest with same name checked in 2 weeks ago" },
  { row: 8, guestName: "Priyanka Menon", email: "priyanka.m@gmail.com", roomCategory: "EXEC_STE", checkIn: "2026-12-19", checkOut: "2026-12-23", status: "valid" },
  { row: 9, guestName: "", email: "noname@email.com", roomCategory: "DLX_OCN", checkIn: "2026-12-21", checkOut: "2026-12-24", status: "error", message: "Guest name is required" },
  { row: 10, guestName: "Fatima Al-Rashid", email: "fatima.ar@gmail.com", roomCategory: "PRES_VIL", checkIn: "2026-12-26", checkOut: "2026-12-31", status: "valid" },
];

export const outboxMessages: OutboxMessage[] = [
  {
    id: "msg_001",
    channel: "whatsapp",
    recipient: "Aditya Kapoor (+91 98765 43210)",
    subject: "Pre-Arrival Welcome",
    preview: "Namaste Aditya! We're excited to welcome you to JW Marriott Mumbai on Dec 18th...",
    status: "delivered",
    sentAt: "2 hours ago",
    template: "pre_arrival_welcome_v3",
  },
  {
    id: "msg_002",
    channel: "email",
    recipient: "sarah.m@outlook.com",
    subject: "Your Spa Booking Confirmation - Quan Wellness",
    preview: "Dear Sarah, your 90-min Ayurvedic Rejuvenation session is confirmed for Dec 20th at 10:00 AM...",
    status: "delivered",
    sentAt: "4 hours ago",
    template: "spa_booking_confirmation",
  },
  {
    id: "msg_003",
    channel: "sms",
    recipient: "+91 87654 32109",
    subject: "Room 412 Checkout Reminder",
    preview: "Dear Guest, a gentle reminder that checkout is at 11:00 AM tomorrow. Need a late checkout? Reply YES.",
    status: "sent",
    sentAt: "30 min ago",
  },
  {
    id: "msg_004",
    channel: "whatsapp",
    recipient: "Meera Joshi (+91 99887 76655)",
    subject: "Feedback Request - How Was Your Stay?",
    preview: "Dear Meera, we hope you enjoyed your stay. Your feedback helps us improve...",
    status: "failed",
    sentAt: "1 hour ago",
    template: "post_checkout_feedback_v2",
  },
  {
    id: "msg_005",
    channel: "email",
    recipient: "d.chen@proton.me",
    subject: "Welcome to Vesper Loyalty - Gold Tier",
    preview: "Congratulations David! You've been enrolled in our Vesper Loyalty programme at Gold tier...",
    status: "queued",
    sentAt: "Scheduled for 6:00 PM",
    template: "loyalty_enrollment",
  },
  {
    id: "msg_006",
    channel: "whatsapp",
    recipient: "Ananya Reddy (+91 77665 54433)",
    subject: "AI Concierge - Restaurant Recommendation",
    preview: "Hi Ananya! Based on your preferences, we recommend Dashanzi for tonight — their Wagyu tasting menu is...",
    status: "delivered",
    sentAt: "45 min ago",
  },
  {
    id: "msg_007",
    channel: "sms",
    recipient: "+91 88776 65544",
    subject: "Weather Alert - Beach Advisory",
    preview: "Important: High tide advisory for Juhu Beach today 3–6 PM. Pool & spa remain open. Stay safe!",
    status: "delivered",
    sentAt: "3 hours ago",
    template: "weather_advisory",
  },
];
