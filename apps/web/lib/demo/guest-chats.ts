/**
 * Demo guest chat & issue tracking store shared between in-room Guest portal and General Manager admin console.
 */

export interface ChatMenuItem {
  id: string;
  name: string;
  category: "all-day" | "beverages" | "desserts";
  price: number;
  desc: string;
  tag?: string;
  veg?: boolean;
}

export interface ChatMessage {
  id: string;
  from: "guest" | "ai" | "staff";
  senderName?: string;
  senderRole?: string;
  text: string;
  time: string;
  sources?: string[];
  type?: "text" | "menu" | "request_dispatched";
  menuItems?: ChatMenuItem[];
  dispatchedRequestId?: string;
  dispatchedType?: string;
}

export interface RoomIssue {
  title: string;
  description: string;
  category: "Maintenance" | "Housekeeping" | "F&B" | "Front Desk" | "Wellness";
  severity: "urgent" | "high" | "standard";
  status: "open" | "in_progress" | "escalated" | "resolved";
  ticketId?: string;
  reportedAt: string;
  slaMinutes: number;
  aiActionTaken: string;
  assignedTeam: string;
  resolutionNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface GuestChatThread {
  id: string;
  room: string;
  guestName: string;
  roomType: string;
  vipStatus?: string;
  checkIn: string;
  checkOut: string;
  status: "active" | "ai_resolved" | "escalated";
  unreadForStaff?: boolean;
  lastMessageSnippet: string;
  lastActive: string;
  currentIssue: RoomIssue;
  messages: ChatMessage[];
}

export const TODAY_MENU_ITEMS: ChatMenuItem[] = [
  {
    id: "mumbai-club",
    name: "Mumbai Club Sandwich",
    category: "all-day",
    price: 650,
    desc: "Triple-layer toasted sourdough, smoked chicken, fried egg, aged cheddar, crisp iceberg.",
    tag: "Chef's Special",
    veg: false,
  },
  {
    id: "paneer-kathi",
    name: "Paneer Tikka Kathi Roll",
    category: "all-day",
    price: 520,
    desc: "Clay-oven roasted cottage cheese, bell peppers, mint & pomegranate chutney.",
    tag: "Vegetarian",
    veg: true,
  },
  {
    id: "dal-makhani",
    name: "Dal Vesper & Butter Naan",
    category: "all-day",
    price: 580,
    desc: "Slow-simmered 24-hour black lentils with churned butter and warm tandoori naan.",
    tag: "Signature",
    veg: true,
  },
  {
    id: "caesar-salad",
    name: "Classic Caesar Salad",
    category: "all-day",
    price: 480,
    desc: "Crisp romaine hearts, shaved parmigiano-reggiano, garlic brioche croutons.",
    tag: "Fresh",
    veg: true,
  },
  {
    id: "coconut-water",
    name: "Fresh Tender Coconut Water",
    category: "beverages",
    price: 220,
    desc: "Served chilled in natural shell with tender coconut malai.",
    tag: "Hydration",
    veg: true,
  },
  {
    id: "masala-chai",
    name: "Kullad Masala Chai (Pot)",
    category: "beverages",
    price: 180,
    desc: "Slow-brewed Assam CTC with hand-crushed ginger, cardamom, and lemongrass.",
    tag: "Warm",
    veg: true,
  },
  {
    id: "chocolate-fondant",
    name: "Warm Valrhona Fondant",
    category: "desserts",
    price: 420,
    desc: "Molten dark chocolate core, Madagascar vanilla bean gelato.",
    tag: "Chef's Pick",
    veg: true,
  },
];

const INITIAL_THREADS: GuestChatThread[] = [
  {
    id: "thread-412",
    room: "412",
    guestName: "In-Room Guest",
    roomType: "Deluxe Ocean View",
    vipStatus: "In-House Guest",
    checkIn: "24 Sep",
    checkOut: "27 Sep",
    status: "active",
    unreadForStaff: true,
    lastMessageSnippet: "My air conditioner isn't cooling properly.",
    lastActive: "Just now",
    currentIssue: {
      title: "Air conditioner isn't cooling properly",
      description: "Guest reported room temperature is too warm and AC unit is blowing ambient air.",
      category: "Maintenance",
      severity: "urgent",
      status: "open",
      ticketId: "REQ-4979",
      reportedAt: "12:33 PM",
      slaMinutes: 20,
      aiActionTaken: "AI Concierge generated Ticket #REQ-4979 and alerted Duty Engineering Team.",
      assignedTeam: "Duty Engineering Technician (Ramesh Patil)",
    },
    messages: [
      {
        id: "msg-412-1",
        from: "ai",
        senderName: "Vesper AI Concierge",
        text: "Namaste and welcome to Room 412! I am your autonomous AI Concierge. How may I assist you today?",
        time: "12:00 PM",
        sources: ["Hotel Knowledge Base", "Front Desk SOP"],
        type: "text",
      },
      {
        id: "msg-412-2",
        from: "guest",
        senderName: "Guest (Room 412)",
        text: "My air conditioner isn't cooling properly.",
        time: "12:33 PM",
        type: "text",
      },
      {
        id: "msg-412-3",
        from: "ai",
        senderName: "Vesper AI Concierge",
        text: "I am very sorry for the inconvenience! I have alerted our Duty Engineering Team right away (Ticket #REQ-4979). A technician is on their way to inspect Room 412 within 20 minutes.",
        time: "12:33 PM",
        sources: ["Maintenance Operations", "Duty Manager Alert"],
        type: "request_dispatched",
        dispatchedRequestId: "REQ-4979",
        dispatchedType: "Engineering",
      },
    ],
  },
  {
    id: "thread-305",
    room: "305",
    guestName: "Priya Patel",
    roomType: "Garden Villa",
    vipStatus: "Platinum Elite",
    checkIn: "25 Sep",
    checkOut: "29 Sep",
    status: "escalated",
    unreadForStaff: true,
    lastMessageSnippet: "Strict Jain meal with dedicated cookware for dinner.",
    lastActive: "25m ago",
    currentIssue: {
      title: "Strict Jain dinner inquiry & dedicated cookware request",
      description: "Elderly family member requires strictly no root vegetables, garlic, or onions, prepared in dedicated Sattvic cookware.",
      category: "F&B",
      severity: "high",
      status: "escalated",
      ticketId: "REQ-4810",
      reportedAt: "11:32 AM",
      slaMinutes: 30,
      aiActionTaken: "AI Concierge escalated note to Executive Chef Ranveer for personal culinary oversight.",
      assignedTeam: "Executive Chef & The Verandah Kitchen",
    },
    messages: [
      {
        id: "msg-305-1",
        from: "guest",
        senderName: "Priya Patel",
        text: "We have an elderly family member who requires strictly no root vegetables or garlic for dinner tonight. Can you ensure separate cookware is used?",
        time: "11:32 AM",
      },
      {
        id: "msg-305-2",
        from: "ai",
        senderName: "Vesper AI Concierge",
        text: "Certainly, Ms. Patel. The Verandah maintains a dedicated Sattvic kitchen line with dedicated cookware. I am flagging your note directly to Executive Chef Ranveer for personal oversight.",
        time: "11:33 AM",
        sources: ["F&B Menu", "Culinary Guidelines"],
      },
    ],
  },
  {
    id: "thread-204",
    room: "204",
    guestName: "Kavya Iyer",
    roomType: "Deluxe Pool View",
    vipStatus: "In-House Guest",
    checkIn: "25 Sep",
    checkOut: "28 Sep",
    status: "active",
    unreadForStaff: false,
    lastMessageSnippet: "Extra bath towels and hypoallergenic pillows requested.",
    lastActive: "40m ago",
    currentIssue: {
      title: "Extra bath towels and hypoallergenic pillows requested",
      description: "Guest requested 2 extra bath sheets and 1 hypoallergenic pillow delivered to Room 204.",
      category: "Housekeeping",
      severity: "standard",
      status: "in_progress",
      ticketId: "REQ-4179",
      reportedAt: "11:15 AM",
      slaMinutes: 15,
      aiActionTaken: "AI Concierge created Housekeeping dispatch ticket #REQ-4179.",
      assignedTeam: "Housekeeping Floor 2 Attendant",
    },
    messages: [
      {
        id: "msg-204-1",
        from: "guest",
        senderName: "Kavya Iyer",
        text: "Can we have 2 extra bath towels and an extra pillow sent to 204?",
        time: "11:15 AM",
      },
      {
        id: "msg-204-2",
        from: "ai",
        senderName: "Vesper AI Concierge",
        text: "I have dispatched a request to our 2nd floor housekeeping attendant (Ticket #REQ-4179). Delivery will arrive within 15 minutes.",
        time: "11:15 AM",
      },
    ],
  },
  {
    id: "thread-608",
    room: "608",
    guestName: "Ananya Kapoor",
    roomType: "Executive Sea View",
    vipStatus: "Gold Elite",
    checkIn: "18 Nov",
    checkOut: "21 Nov",
    status: "ai_resolved",
    unreadForStaff: false,
    lastMessageSnippet: "Complimentary late checkout until 2:00 PM confirmed.",
    lastActive: "1h ago",
    currentIssue: {
      title: "Late checkout extension until 2:00 PM",
      description: "Guest requested keycard extension for late checkout due to evening flight departure.",
      category: "Front Desk",
      severity: "standard",
      status: "resolved",
      ticketId: "REQ-4088",
      reportedAt: "11:42 AM",
      slaMinutes: 15,
      aiActionTaken: "AI Concierge verified Gold Elite tier and confirmed complimentary extension to 2:00 PM.",
      assignedTeam: "Front Desk Operations",
      resolutionNote: "Keycard extended in PMS system. Clean turnover rescheduled with housekeeping.",
      resolvedAt: "11:44 AM",
      resolvedBy: "AI Autonomous Engine",
    },
    messages: [
      {
        id: "msg-608-1",
        from: "guest",
        senderName: "Ananya Kapoor",
        text: "Hi, can I get late checkout today? Our flight is in the evening.",
        time: "11:42 AM",
      },
      {
        id: "msg-608-2",
        from: "ai",
        senderName: "Vesper AI Concierge",
        text: "Hello Ms. Kapoor! As a Gold Elite member in Room 608, you are entitled to complimentary late checkout until 2:00 PM today. I have registered this with Front Desk and updated your digital keycard.",
        time: "11:43 AM",
        sources: ["Late Checkout Policy", "Loyalty Matrix"],
      },
    ],
  },
  {
    id: "thread-514",
    room: "514",
    guestName: "Rohan Verma",
    roomType: "Premier Sunset Suite",
    vipStatus: "Silver Elite",
    checkIn: "26 Sep",
    checkOut: "28 Sep",
    status: "ai_resolved",
    unreadForStaff: false,
    lastMessageSnippet: "Ayurvedic massage booked for 4:00 PM at Vesper Spa.",
    lastActive: "2h ago",
    currentIssue: {
      title: "Ayurvedic massage appointment inquiry & booking",
      description: "Guest inquired about therapy slots and booked 60-minute Abhyanga session for 4:00 PM.",
      category: "Wellness",
      severity: "standard",
      status: "resolved",
      ticketId: "REQ-4015",
      reportedAt: "10:50 AM",
      slaMinutes: 30,
      aiActionTaken: "AI Concierge checked live spa slot and confirmed appointment with therapist Meera.",
      assignedTeam: "Vesper Spa & Wellness",
      resolutionNote: "Therapist Meera assigned. Consultation form sent to guest.",
      resolvedAt: "10:52 AM",
      resolvedBy: "AI Autonomous Engine",
    },
    messages: [
      {
        id: "msg-514-1",
        from: "guest",
        senderName: "Rohan Verma",
        text: "Are there any slots available for an Ayurvedic massage this afternoon?",
        time: "10:50 AM",
      },
      {
        id: "msg-514-2",
        from: "ai",
        senderName: "Vesper AI Concierge",
        text: "Yes, Mr. Verma. We have an open slot at 4:00 PM for the 60-minute Abhyanga therapeutic massage at Vesper Spa (Level 3).",
        time: "10:51 AM",
        sources: ["Spa Directory", "Wellness Services"],
      },
    ],
  },
];

const STORAGE_KEY = "vesper_guest_chat_threads_v2";
const UPDATE_EVENT = "vesper_guest_chat_update_v2";

export function getStoredChatThreads(): GuestChatThread[] {
  if (typeof window === "undefined") return INITIAL_THREADS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_THREADS));
      return INITIAL_THREADS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_THREADS;
  }
}

export function saveStoredChatThreads(threads: GuestChatThread[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: threads }));
  } catch (e) {
    console.error("Failed to save guest chats:", e);
  }
}

export function subscribeChatThreads(callback: (threads: GuestChatThread[]) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleUpdate = (e: Event) => {
    const customEvent = e as CustomEvent<GuestChatThread[]>;
    callback(customEvent.detail || getStoredChatThreads());
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback(getStoredChatThreads());
    }
  };

  window.addEventListener(UPDATE_EVENT, handleUpdate);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(UPDATE_EVENT, handleUpdate);
    window.removeEventListener("storage", handleStorage);
  };
}

export function addMessageToRoomThread(
  room: string,
  message: ChatMessage,
  newStatus?: GuestChatThread["status"],
  updatedIssue?: Partial<RoomIssue>
): GuestChatThread {
  const threads = getStoredChatThreads();
  const threadIndex = threads.findIndex((t) => t.room === room);

  let targetThread: GuestChatThread;

  if (threadIndex >= 0) {
    const existing = threads[threadIndex];
    targetThread = {
      ...existing,
      messages: [...existing.messages, message],
      lastMessageSnippet: message.text.slice(0, 75) + (message.text.length > 75 ? "..." : ""),
      lastActive: "Just now",
      status: newStatus || existing.status,
      unreadForStaff: message.from === "guest" ? true : existing.unreadForStaff,
      currentIssue: {
        ...existing.currentIssue,
        ...(updatedIssue || {}),
      },
    };
    threads[threadIndex] = targetThread;
  } else {
    targetThread = {
      id: `thread-${room}`,
      room,
      guestName: "In-Room Guest",
      roomType: "Deluxe Ocean View",
      vipStatus: "In-House Guest",
      checkIn: "Today",
      checkOut: "3 Days",
      status: newStatus || "active",
      unreadForStaff: true,
      lastMessageSnippet: message.text.slice(0, 75),
      lastActive: "Just now",
      currentIssue: {
        title: message.text.slice(0, 50),
        description: message.text,
        category: "Front Desk",
        severity: "standard",
        status: "open",
        reportedAt: message.time,
        slaMinutes: 20,
        aiActionTaken: "Inquiry received by AI Concierge.",
        assignedTeam: "Front Desk Operations",
        ...(updatedIssue || {}),
      },
      messages: [message],
    };
    threads.unshift(targetThread);
  }

  saveStoredChatThreads(threads);
  return targetThread;
}

export function resolveRoomIssue(
  room: string,
  resolutionNote?: string,
  resolvedBy: string = "Arjun Mehta (General Manager)"
): void {
  const threads = getStoredChatThreads();
  const now = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const updated = threads.map((t) => {
    if (t.room === room) {
      return {
        ...t,
        status: "ai_resolved" as const,
        unreadForStaff: false,
        currentIssue: {
          ...t.currentIssue,
          status: "resolved" as const,
          resolutionNote: resolutionNote || "Problem verified and marked resolved by General Manager.",
          resolvedAt: now,
          resolvedBy,
        },
      };
    }
    return t;
  });
  saveStoredChatThreads(updated);
}

export function escalateRoomIssue(room: string, note?: string): void {
  const threads = getStoredChatThreads();
  const updated = threads.map((t) => {
    if (t.room === room) {
      return {
        ...t,
        status: "escalated" as const,
        unreadForStaff: true,
        currentIssue: {
          ...t.currentIssue,
          status: "escalated" as const,
          severity: "urgent" as const,
          resolutionNote: note || "Escalated for immediate senior managerial attention.",
        },
      };
    }
    return t;
  });
  saveStoredChatThreads(updated);
}

export function updateAssignedTeam(room: string, team: string): void {
  const threads = getStoredChatThreads();
  const updated = threads.map((t) => {
    if (t.room === room) {
      return {
        ...t,
        currentIssue: {
          ...t.currentIssue,
          status: "in_progress" as const,
          assignedTeam: team,
        },
      };
    }
    return t;
  });
  saveStoredChatThreads(updated);
}
