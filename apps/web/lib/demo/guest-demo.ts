/**
 * Vesper Preferential VIP Guest Demo Mode.
 *
 * Designed specifically for live presentations, judge reviews, investor pitches,
 * and high-fidelity product demonstrations without requiring an active backend or physical QR camera.
 */

import { type GuestSession } from "@/lib/api";

export interface GuestPreferenceItem {
  label: string;
  tag: string;
  iconName: "Waves" | "Clock" | "Leaf" | "Bed" | "VolumeX" | "Car" | "Sparkles" | "UtensilsCrossed" | "Compass";
  desc: string;
}

export interface GuestPersona {
  id: string;
  name: string;
  roomNumber: string;
  tier: string;
  category: string;
  propertyName: string;
  stayId: string;
  token: string;
  checkIn: string;
  checkOut: string;
  folioTotal: number;
  vipBadge: string;
  preferences: GuestPreferenceItem[];
}

export const DEMO_GUEST_PREFERENTIAL: GuestPersona = {
  id: "g1",
  name: "Rohan Mehta",
  roomNumber: "405",
  tier: "Gold Elite VIP",
  category: "Executive Ocean Suite · Level 4",
  propertyName: "Vesper Luxury Ocean Resort & Spa",
  stayId: "stay-demo-405-rohan",
  token: "demo-token-rohan-mehta-405",
  checkIn: "16 Nov 2026",
  checkOut: "20 Nov 2026",
  folioTotal: 84000,
  vipBadge: "Preferential Member",
  preferences: [
    {
      label: "High Floor Sea View (Floor 4)",
      tag: "Oceanfront",
      iconName: "Waves",
      desc: "Guaranteed Floor 4 sea-facing suite with unobstructed Arabian Sea views",
    },
    {
      label: "Pre-approved 2:00 PM Express Late Checkout",
      tag: "VIP Benefit",
      iconName: "Clock",
      desc: "Complimentary late checkout granted by General Manager Arjun Mehta",
    },
    {
      label: "Jain / Sattvic Culinary Preference",
      tag: "Dietary",
      iconName: "Leaf",
      desc: "Strictly no root vegetables or garlic, prepared in dedicated Sattvic cookware",
    },
    {
      label: "Hypoallergenic Pillows & Turndown",
      tag: "Comfort",
      iconName: "Bed",
      desc: "2 extra microfibre goose-feather pillows with organic linen mist",
    },
    {
      label: "Quiet Suite Away from Elevators",
      tag: "Quiet Zone",
      iconName: "VolumeX",
      desc: "Secluded corner suite orientation for maximum executive peace",
    },
    {
      label: "BMW 7-Series Airport Transfer",
      tag: "Valet Logistics",
      iconName: "Car",
      desc: "Chauffeur on standby with flight tracking for Mumbai International (BOM)",
    },
  ],
};

export const DEMO_GUEST_PRESIDENTIAL: GuestPersona = {
  id: "g2",
  name: "Meera Kapoor",
  roomNumber: "501",
  tier: "VIP Royal Patron",
  category: "The Presidential Royal Villa · Top Floor",
  propertyName: "Vesper Luxury Ocean Resort & Spa",
  stayId: "stay-demo-501-meera",
  token: "demo-token-meera-kapoor-501",
  checkIn: "17 Nov 2026",
  checkOut: "22 Nov 2026",
  folioTotal: 198000,
  vipBadge: "Presidential Tier",
  preferences: [
    {
      label: "Private Infinity Plunge Pool",
      tag: "Presidential",
      iconName: "Waves",
      desc: "Heated private deck plunge pool maintained at 28°C",
    },
    {
      label: "Dedicated 24/7 Butler Service",
      tag: "VIP Exclusive",
      iconName: "Sparkles",
      desc: "Lead Butler assigned: Mr. Arjun Mehta & Senior Concierge",
    },
    {
      label: "Sunrise Champagne Breakfast",
      tag: "Culinary",
      iconName: "UtensilsCrossed",
      desc: "Moët & Chandon Brut Imperial with fresh brioche on private terrace",
    },
    {
      label: "Private Helipad Clearance & Yacht Charter",
      tag: "Aviation",
      iconName: "Compass",
      desc: "Direct access to Vesper Helipad and Arabian Sea cruiser",
    },
  ],
};

export const DEMO_PERSONAS: Record<string, GuestPersona> = {
  "405": DEMO_GUEST_PREFERENTIAL,
  rohan: DEMO_GUEST_PREFERENTIAL,
  "501": DEMO_GUEST_PRESIDENTIAL,
  meera: DEMO_GUEST_PRESIDENTIAL,
};

export interface DemoMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  tag?: string;
  calories?: string;
  preparationTimeMinutes: number;
}

export const DEMO_MENU_CATEGORIES: Record<string, DemoMenuItem[]> = {
  "Starters & Small Bites": [
    {
      id: "paneer-kathi-roll",
      name: "Paneer Tikka Kathi Roll",
      description: "Clay-oven roasted cottage cheese, chargrilled bell peppers, pickled onions, and wild mint pomegranate chutney. (Jain/Sattvic option available)",
      price: 520,
      is_veg: true,
      is_available: true,
      tag: "Chef's Special",
      calories: "440 kcal",
      preparationTimeMinutes: 20,
    },
    {
      id: "mumbai-chicken-club",
      name: "Mumbai Smoked Chicken Club Sandwich",
      description: "Triple-layer toasted brioche, smoked chicken breast, sunny egg, aged English cheddar, crisp iceberg & mustard mayo.",
      price: 650,
      is_veg: false,
      is_available: true,
      tag: "Bestseller",
      calories: "520 kcal",
      preparationTimeMinutes: 20,
    },
    {
      id: "caesar-salad-gourmet",
      name: "Crisp Romaine Caesar Salad",
      description: "Crisp hydro-grown romaine hearts, aged parmigiano-reggiano shavings, and garlic herb brioche croutons.",
      price: 480,
      is_veg: true,
      is_available: true,
      tag: "Farm Fresh",
      calories: "280 kcal",
      preparationTimeMinutes: 15,
    },
    {
      id: "coastal-tawa-prawns",
      name: "Konkan Pepper Garlic Tawa Prawns",
      description: "Jumbo Arabian Sea prawns tossed in crushed Tellicherry black peppercorns, fresh curry leaves, and kokum butter.",
      price: 850,
      is_veg: false,
      is_available: true,
      tag: "Coastal Catch",
      calories: "390 kcal",
      preparationTimeMinutes: 20,
    },
  ],
  "Mains & Curries": [
    {
      id: "dal-vesper-naan",
      name: "Dal Vesper & Truffle Butter Naan",
      description: "Slow-simmered 24-hour black urad lentils churned with white butter, served with fluffy tandoori truffle naan. (Sattvic preparation for Mr. Mehta)",
      price: 580,
      is_veg: true,
      is_available: true,
      tag: "Signature Dish",
      calories: "510 kcal",
      preparationTimeMinutes: 25,
    },
    {
      id: "butter-chicken-makhani",
      name: "Old Delhi Butter Chicken & Butter Naan",
      description: "Charcoal-grilled tandoori chicken simmered in a velvety San Marzano tomato, churned white butter, and fenugreek sauce.",
      price: 720,
      is_veg: false,
      is_available: true,
      tag: "Royal Recipe",
      calories: "640 kcal",
      preparationTimeMinutes: 25,
    },
    {
      id: "truffle-mushroom-risotto",
      name: "Wild Forest Mushroom & Truffle Risotto",
      description: "Creamy Carnaroli arborio rice, pan-roasted porcini and shiitake mushrooms, Umbrian black truffle oil, and parmesan crisp.",
      price: 640,
      is_veg: true,
      is_available: true,
      tag: "Italian Craft",
      calories: "520 kcal",
      preparationTimeMinutes: 25,
    },
    {
      id: "grilled-salmon-fillet",
      name: "Pan-Seared Atlantic Salmon Fillet",
      description: "Crispy-skin Norwegian salmon with charred lemon caper butter, grilled asparagus spears, and crushed baby potatoes.",
      price: 950,
      is_veg: false,
      is_available: true,
      tag: "Healthy Gourmet",
      calories: "460 kcal",
      preparationTimeMinutes: 25,
    },
  ],
  "Biryani & Tandoor": [
    {
      id: "awadhi-dum-biryani",
      name: "Awadhi Dum Gosht Biryani",
      description: "Slow-braised tender lamb pieces layered with aged basmati rice, saffron strands, rose water, and caramelized shallots.",
      price: 790,
      is_veg: false,
      is_available: true,
      tag: "Royal Awadhi",
      calories: "680 kcal",
      preparationTimeMinutes: 30,
    },
    {
      id: "subz-dum-biryani",
      name: "Nizami Subz Dum Biryani",
      description: "Garden vegetables, baby potatoes, and paneer layered with aged Dehradun basmati rice, mint, and pure saffron milk.",
      price: 590,
      is_veg: true,
      is_available: true,
      tag: "Vegetarian",
      calories: "520 kcal",
      preparationTimeMinutes: 25,
    },
    {
      id: "murgh-malai-tikka",
      name: "Murgh Malai Tikka & Mint Chutney",
      description: "Tender boneless chicken morsels steeped in rich cream cheese, green cardamom, and royal cumin, charred in the clay oven.",
      price: 680,
      is_veg: false,
      is_available: true,
      tag: "Tandoor Special",
      calories: "480 kcal",
      preparationTimeMinutes: 25,
    },
  ],
  "Artisanal Beverages": [
    {
      id: "alphonso-mango-lassi",
      name: "Chilled Alphonso Mango & Mint Lassi",
      description: "Fresh Ratnagiri Alphonso mango pulp churned with chilled organic hung curd, green cardamom, and garden mint.",
      price: 320,
      is_veg: true,
      is_available: true,
      tag: "Refreshing",
      calories: "210 kcal",
      preparationTimeMinutes: 10,
    },
    {
      id: "kashmiri-kahwa-pot",
      name: "Artisanal Kashmiri Saffron Kahwa",
      description: "Handpicked green tea steeped with pure Pampore saffron, whole cinnamon, green cardamom, and slivered almonds.",
      price: 280,
      is_veg: true,
      is_available: true,
      tag: "Wellness Elixir",
      calories: "90 kcal",
      preparationTimeMinutes: 15,
    },
    {
      id: "tender-coconut-water",
      name: "Fresh Tender Coconut Water",
      description: "Served chilled in natural carved shell with tender coconut malai and a hint of lime.",
      price: 220,
      is_veg: true,
      is_available: true,
      tag: "Hydration",
      calories: "60 kcal",
      preparationTimeMinutes: 5,
    },
    {
      id: "kullad-masala-chai",
      name: "Kullad Masala Chai (Pot for 2)",
      description: "Slow-brewed Assam CTC with hand-crushed ginger, cardamom, clove, and lemongrass.",
      price: 240,
      is_veg: true,
      is_available: true,
      tag: "Warm Classic",
      calories: "120 kcal",
      preparationTimeMinutes: 10,
    },
  ],
  "Gourmet Desserts": [
    {
      id: "dark-chocolate-fondant",
      name: "Warm Belgian Dark Chocolate Fondant",
      description: "70% Callebaut dark chocolate molten lava cake served with Madagascar vanilla bean gelato & berry coulis.",
      price: 420,
      is_veg: true,
      is_available: true,
      tag: "Decadent",
      calories: "480 kcal",
      preparationTimeMinutes: 20,
    },
    {
      id: "gulab-jamun-pista-rabri",
      name: "Warm Shahi Gulab Jamun with Pista Rabri",
      description: "Tender golden mawa dumplings steeped in saffron rose syrup, blanketed in slow-reduced pistachio rabri.",
      price: 380,
      is_veg: true,
      is_available: true,
      tag: "Royal Indian",
      calories: "410 kcal",
      preparationTimeMinutes: 15,
    },
  ],
};

export interface DemoRequestItem {
  id: string;
  kind: string;
  status: string;
  note: string | null;
  total_amount: number;
  due_at: string;
  rating: number | null;
  items: { menu_item_id: string; name?: string; quantity: number; unit_price?: number; is_veg?: boolean }[];
}

export function getInitialDemoRequests(roomNumber: string = "405"): DemoRequestItem[] {
  const now = new Date();
  const plus18Mins = new Date(now.getTime() + 18 * 60 * 1000).toISOString();
  const tomorrow2PM = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 14, 0, 0).toISOString();
  const past2Hours = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  if (roomNumber === "501") {
    return [
      {
        id: "REQ-501-1",
        kind: "room_service",
        status: "in_progress",
        note: "Champagne flutes chilled, severed on private pool deck",
        total_amount: 14500,
        due_at: plus18Mins,
        rating: null,
        items: [
          { menu_item_id: "champagne-reserve", name: "Moët & Chandon Brut Imperial Champagne", quantity: 1, unit_price: 13500, is_veg: true },
          { menu_item_id: "dark-chocolate-fondant", name: "Warm Belgian Dark Chocolate Fondant", quantity: 2, unit_price: 420, is_veg: true },
        ],
      },
      {
        id: "REQ-501-2",
        kind: "other",
        status: "accepted",
        note: "Private Helicopter Helipad Transfer scheduled for 11:30 AM departure",
        total_amount: 0,
        due_at: tomorrow2PM,
        rating: null,
        items: [],
      },
      {
        id: "REQ-501-3",
        kind: "amenities",
        status: "delivered",
        note: "Diptique luxury bath collection replenishment completed by Lead Butler",
        total_amount: 0,
        due_at: past2Hours,
        rating: 5,
        items: [],
      },
    ];
  }

  // Room 405 (Rohan Mehta)
  return [
    {
      id: "REQ-405-1",
      kind: "room_service",
      status: "in_progress",
      note: "Strictly Sattvic preparation: no root vegetables, garlic or onion. Extra napkins requested.",
      total_amount: 900,
      due_at: plus18Mins,
      rating: null,
      items: [
        { menu_item_id: "dal-vesper-naan", name: "Dal Vesper & Truffle Butter Naan", quantity: 1, unit_price: 580, is_veg: true },
        { menu_item_id: "alphonso-mango-lassi", name: "Chilled Alphonso Mango & Mint Lassi", quantity: 1, unit_price: 320, is_veg: true },
      ],
    },
    {
      id: "REQ-405-2",
      kind: "other",
      status: "accepted",
      note: "Express 2:00 PM Late Checkout (Gold Elite Member Benefit - pre-approved by GM Arjun Mehta)",
      total_amount: 0,
      due_at: tomorrow2PM,
      rating: null,
      items: [],
    },
    {
      id: "REQ-405-3",
      kind: "amenities",
      status: "delivered",
      note: "2 Extra Hypoallergenic Goose-Feather Pillows delivered and placed on master bed",
      total_amount: 0,
      due_at: past2Hours,
      rating: 5,
      items: [],
    },
    {
      id: "REQ-405-4",
      kind: "maintenance",
      status: "delivered",
      note: "Air conditioning climate calibration: set to preferred 21.5°C whisper-quiet mode",
      total_amount: 0,
      due_at: past2Hours,
      rating: 5,
      items: [],
    },
  ];
}

export interface DemoConciergeMessage {
  id: string;
  question: string;
  answer: string;
  sources: string[];
  model: string | null;
  outcome: "answered" | "escalated";
  escalated: boolean;
  escalation_reason: string | null;
  handled_at: string | null;
  created_at: string;
}

export function getInitialDemoConciergeMessages(roomNumber: string = "405"): DemoConciergeMessage[] {
  const now = new Date();
  const timeStr = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60 * 1000).toISOString();

  if (roomNumber === "501") {
    return [
      {
        id: "msg-demo-501-1",
        question: "Can we have a private butler arrange sunset champagne on our terrace?",
        answer: "Certainly, Ms. Kapoor! Your dedicated butler, Mr. Arjun, has been notified. We will set up chilled Moët & Chandon Brut with artisanal chocolate pairings on your private ocean terrace by 5:45 PM for sunset.",
        sources: ["Presidential Butler SOP", "VIP Royal Amenities Guide"],
        model: "Vesper-Concierge-v2",
        outcome: "answered",
        escalated: false,
        escalation_reason: null,
        handled_at: null,
        created_at: timeStr(35),
      },
      {
        id: "msg-demo-501-2",
        question: "What time is our helicopter transfer to Mumbai Airport?",
        answer: "Your charter flight is cleared for 11:30 AM tomorrow from the Vesper Oceanfront Helipad. Chauffeur buggy escort from Villa 501 will depart at 11:15 AM. Luggage is pre-checked directly with ground operations.",
        sources: ["Aviation Concierge Portal", "Front Office Log"],
        model: "Vesper-Concierge-v2",
        outcome: "answered",
        escalated: false,
        escalation_reason: null,
        handled_at: null,
        created_at: timeStr(10),
      },
    ];
  }

  // Room 405 (Rohan Mehta)
  return [
    {
      id: "msg-demo-405-1",
      question: "Can I get a late checkout tomorrow afternoon?",
      answer: "Namaste Mr. Mehta! As an esteemed Gold Elite VIP guest, you are entitled to our complimentary express late checkout until 2:00 PM. I have automatically confirmed this with Front Desk Manager Nikhil Rao. Your RFID keycard has been extended accordingly.",
      sources: ["Loyalty Tier Privileges (Gold Elite)", "Front Desk Departure SOP"],
      model: "Vesper-Concierge-v2",
      outcome: "answered",
      escalated: false,
      escalation_reason: null,
      handled_at: null,
      created_at: timeStr(45),
    },
    {
      id: "msg-demo-405-2",
      question: "What Jain or Sattvic dining options do you have for in-room dining?",
      answer: "Executive Chef Ranveer maintains a dedicated Sattvic kitchen line for our guests. Recommended today are our 24-hour slow-cooked Dal Vesper with Truffle Butter Naan, clay-oven roasted Paneer Tikka Kathi Roll, and fresh Alphonso Mango & Mint Lassi—all prepared strictly with no root vegetables, onion, or garlic.",
      sources: ["Culinary Operations", "The Verandah Sattvic Menu Guide"],
      model: "Vesper-Concierge-v2",
      outcome: "answered",
      escalated: false,
      escalation_reason: null,
      handled_at: null,
      created_at: timeStr(20),
    },
    {
      id: "msg-demo-405-3",
      question: "How do I book a massage at the spa?",
      answer: "Vesper Ayurvedic Spa is located on Level 3 and open until 9:00 PM. We have reserved an opening at 4:00 PM today for our signature 60-minute Abhyanga therapeutic massage. Would you like me to confirm this time slot for you?",
      sources: ["Vesper Spa Directory", "Wellness Treatment Schedule"],
      model: "Vesper-Concierge-v2",
      outcome: "answered",
      escalated: false,
      escalation_reason: null,
      handled_at: null,
      created_at: timeStr(5),
    },
  ];
}

export function generateDemoAiConciergeResponse(
  question: string,
  persona: GuestPersona
): DemoConciergeMessage {
  const q = question.toLowerCase();
  let answer = "";
  let sources: string[] = ["Vesper Luxury Directory", "Front Desk SOP"];
  let escalated = false;
  let escalationReason: string | null = null;

  if (q.includes("late checkout") || q.includes("check out") || q.includes("checkout")) {
    answer = `Good news, ${persona.name}! As a ${persona.tier} guest, your express 2:00 PM late checkout is pre-approved with zero surcharge. Your digital keycard and room folio remain active until 2:00 PM tomorrow. Let us know if you need luggage assistance upon departure.`;
    sources = ["Front Desk SOP", "VIP Privileges Directory"];
  } else if (q.includes("jain") || q.includes("sattvic") || q.includes("diet") || q.includes("onion") || q.includes("garlic") || q.includes("veg")) {
    answer = `We take dietary preferences with utmost precision, Mr. Mehta. The Verandah has dedicated Sattvic cookware and prepares meals free of root vegetables, onion, and garlic. Our Dal Vesper, Paneer Tikka, and Subz Biryani can all be served Sattvic style. Simply add a note in your order or inform us here!`;
    sources = ["Executive Culinary SOP", "Dietary & Allergen Shield"];
  } else if (q.includes("spa") || q.includes("massage") || q.includes("wellness") || q.includes("ayurvedic")) {
    answer = `The Vesper Ayurvedic Spa on Level 3 is open daily from 8:00 AM to 9:00 PM. Signature treatments include the 60-min Abhyanga Herbal Therapy and Shirodhara relaxation ritual. We have priority slots open for our Suite guests this afternoon.`;
    sources = ["Vesper Spa Directory", "Ayurvedic Treatment Guidelines"];
  } else if (q.includes("pool") || q.includes("swim") || q.includes("beach")) {
    answer = `Our Infinity Ocean Pool overlooks Juhu Beach on Level 2 and is heated to 28°C, open 7:00 AM – 8:00 PM. Poolside bar service with fresh tender coconuts and signature mocktails is available throughout the day. Private beach cabanas are complimentary for Suite guests.`;
    sources = ["Pool & Recreation SOP"];
  } else if (q.includes("wifi") || q.includes("internet") || q.includes("speed")) {
    answer = `High-speed Wi-Fi network 'Vesper-Luxury-Guest' is connected automatically in Suite ${persona.roomNumber}. Your speed profile is set to our VIP Tier (300 Mbps symmetrical with dedicated bandwidth). No login gateway required.`;
    sources = ["IT Network Telemetry"];
  } else if (q.includes("pillow") || q.includes("linen") || q.includes("towel") || q.includes("housekeeping") || q.includes("clean")) {
    answer = `Housekeeping Floor 4 team has noted your preference for hypoallergenic pillows. We have dispatched a priority refresh to Suite ${persona.roomNumber}. Expected delivery within 12 minutes!`;
    sources = ["Housekeeping Operations", "Duty Attendant Dispatch"];
  } else if (q.includes("ac") || q.includes("climate") || q.includes("temperature") || q.includes("cold") || q.includes("warm") || q.includes("heat")) {
    answer = `Your suite thermostat is calibrated to 21.5°C in silent airflow mode. You can adjust the bedside wall controller or let me know your desired temperature, and I will adjust the BMS smart climate node remotely.`;
    sources = ["BMS Smart Thermostat IoT"];
  } else if (q.includes("airport") || q.includes("cab") || q.includes("car") || q.includes("transfer") || q.includes("flight")) {
    answer = `Your departure airport transfer in our executive BMW 7-Series is coordinated with Mumbai International Airport (BOM) terminal traffic. Concierge will load your luggage and confirm departure timing with you 2 hours prior to flight.`;
    sources = ["Valet & Logistics Operations"];
  } else if (q.includes("manager") || q.includes("complaint") || q.includes("urgent") || q.includes("emergency") || q.includes("escalat")) {
    answer = `I have immediately alerted Duty Manager Arjun Mehta regarding your inquiry. A senior team member will reach out to Suite ${persona.roomNumber} or visit in person within 5 minutes.`;
    sources = ["Duty Manager Alert", "Emergency Protocol"];
    escalated = true;
    escalationReason = "Guest requested senior managerial assistance.";
  } else {
    answer = `Thank you for reaching out, ${persona.name}. As our ${persona.tier} guest in Suite ${persona.roomNumber}, our entire front office and culinary team are at your service. Whether you need in-room dining, spa appointments, housekeeping or bespoke resort experiences, simply ask!`;
    sources = ["Vesper Luxury Concierge SOP"];
  }

  return {
    id: `msg-demo-${Date.now()}`,
    question,
    answer,
    sources,
    model: "Vesper-Autonomous-Concierge",
    outcome: escalated ? "escalated" : "answered",
    escalated,
    escalation_reason: escalationReason,
    handled_at: null,
    created_at: new Date().toISOString(),
  };
}

export function generateDemoDayPlan(existingPlan: string, persona: GuestPersona) {
  const isJain = persona.id === "g1";

  return {
    day: "Today",
    summary: existingPlan
      ? `Customized luxury itinerary balancing your plan ("${existingPlan}") with preferred Gold Elite suite amenities and peaceful beachside pace.`
      : `Curated bespoke resort itinerary crafted for Mr. ${persona.name}, featuring private wellness, oceanfront dining, and sunset leisure.`,
    stops: [
      {
        time: "08:30 AM",
        amenity: "Sunrise Ocean Yoga & Breathwork",
        crowd: "Quieter",
        reason: "Gentle Hatha flow on the oceanfront teak pavilion with soothing Arabian Sea breeze.",
        location: "Oceanfront Lawn & Teak Deck",
        opening_hours: "07:00 – 10:00 AM",
      },
      {
        time: "10:00 AM",
        amenity: "Artisanal Breakfast at The Verandah",
        crowd: "Busier",
        reason: isJain
          ? "Dedicated chef's table serving fresh Sattvic poha, seasonal berries, and freshly churned Alphonso Mango Lassi."
          : "Full coastal breakfast buffet featuring organic eggs florentine and cold-pressed citrus juices.",
        location: "The Verandah (Level 1)",
        opening_hours: "06:30 – 11:00 AM",
      },
      {
        time: "02:00 PM",
        amenity: "Abhyanga Therapeutic Herbal Massage",
        crowd: "Quieter",
        reason: "60-minute warm herbal oil therapy by master therapists to release travel tension.",
        location: "Vesper Ayurvedic Spa (Level 3)",
        opening_hours: "08:00 AM – 09:00 PM",
      },
      {
        time: "05:30 PM",
        amenity: "Sunset High Tea & Ocean Views",
        crowd: "Busier",
        reason: "Kashmiri Saffron Kahwa, artisanal finger sandwiches, and panoramic Juhu Beach golden hour.",
        location: "Sunset Terrace Lounge (Level 4)",
        opening_hours: "04:30 – 07:00 PM",
      },
      {
        time: "08:00 PM",
        amenity: "Signature Coastal Dinner at Saffron",
        crowd: "Quieter",
        reason: isJain
          ? "Special 5-course Sattvic degustation menu personally supervised by Executive Chef Ranveer."
          : "Beachside candlelit dinner with fresh tandoor specialties and live acoustic sitar.",
        location: "Saffron Beach Pavilion",
        opening_hours: "07:00 – 11:30 PM",
      },
    ],
  };
}

export const DEMO_RESORT_AMENITIES = [
  {
    id: "amenity-1",
    name: "Infinity Ocean Pool & Cabanas",
    category: "recreation",
    location: "Level 2 · Ocean Deck",
    operating_hours: "07:00 AM – 08:00 PM",
    is_available: true,
    closure_notes: null,
    image_url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-pool-5330-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
    description: "Heated infinity-edge pool suspended directly above Juhu Beach with private serviced cabanas and poolside mixology.",
  },
  {
    id: "amenity-2",
    name: "Vesper Ayurvedic Spa & Wellness",
    category: "wellness",
    location: "Level 3 · North Wing",
    operating_hours: "08:00 AM – 09:00 PM",
    is_available: true,
    closure_notes: null,
    image_url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-spa-5334-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
    description: "Holistic sanctuary offering traditional Kerala Abhyanga, steam grottoes, aroma baths, and restorative sound meditation.",
  },
  {
    id: "amenity-3",
    name: "The Verandah All-Day Dining",
    category: "dining",
    location: "Level 1 · Lobby Terrace",
    operating_hours: "Open 24 Hours",
    is_available: true,
    closure_notes: null,
    image_url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-restaurant-5336-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
    description: "World-class multi-cuisine culinary theater with dedicated Sattvic, Mediterranean, and charcoal tandoor kitchens.",
  },
  {
    id: "amenity-4",
    name: "Private Beach Club & Water Lounge",
    category: "recreation",
    location: "Beachfront Promenade",
    operating_hours: "09:00 AM – 06:30 PM",
    is_available: true,
    closure_notes: null,
    image_url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-pool-bar-5332-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
    description: "Exclusive access to private manicured sands, luxury sun loungers, beach volleyball, and personal attendant service.",
  },
  {
    id: "amenity-5",
    name: "Fitness & Movement Pavilion",
    category: "wellness",
    location: "Level 3 · South Wing",
    operating_hours: "Open 24 Hours",
    is_available: true,
    closure_notes: null,
    image_url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-fitness-5335-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
    description: "State-of-the-art Technogym cardio biomechanics, Olympic free weights, private reformer Pilates studio, and certified trainers.",
  },
  {
    id: "amenity-6",
    name: "Executive Ocean Lounge",
    category: "services",
    location: "Level 4 · Executive Wing",
    operating_hours: "06:30 AM – 11:00 PM",
    is_available: true,
    closure_notes: null,
    image_url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-twin-executive-lounge-21464:Classic-Hor?wid=1336&fit=constrain",
    description: "Private retreat for Suite and Gold Elite guests with complimentary evening cocktails, chef canapés, and meeting suites.",
  },
];

const DEMO_REQUESTS_KEY = "vesper_demo_guest_requests_v3";
const DEMO_CONCIERGE_KEY = "vesper_demo_concierge_history_v3";

export function getDemoGuestPersona(roomOrKey?: string): GuestPersona {
  if (roomOrKey && DEMO_PERSONAS[roomOrKey]) {
    return DEMO_PERSONAS[roomOrKey];
  }
  return DEMO_GUEST_PREFERENTIAL;
}

export function createGuestSessionFromPersona(persona: GuestPersona): GuestSession {
  return {
    token: persona.token,
    expires_in: 86400 * 3,
    room_number: persona.roomNumber,
    property_name: persona.propertyName,
    guest_name: persona.name,
    stay_id: persona.stayId,
  };
}

export function isDemoSession(session: GuestSession | null): boolean {
  if (!session) return false;
  return Boolean(
    session.token.startsWith("demo-token-") ||
    session.stay_id.startsWith("stay-demo-") ||
    session.room_number === "405" ||
    session.room_number === "501"
  );
}

export function getStoredDemoRequests(roomNumber: string = "405"): DemoRequestItem[] {
  if (typeof window === "undefined") return getInitialDemoRequests(roomNumber);
  try {
    const raw = window.localStorage.getItem(`${DEMO_REQUESTS_KEY}_${roomNumber}`);
    if (!raw) {
      const initial = getInitialDemoRequests(roomNumber);
      window.localStorage.setItem(`${DEMO_REQUESTS_KEY}_${roomNumber}`, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return getInitialDemoRequests(roomNumber);
  }
}

export function saveStoredDemoRequests(roomNumber: string, requests: DemoRequestItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${DEMO_REQUESTS_KEY}_${roomNumber}`, JSON.stringify(requests));
    window.dispatchEvent(new CustomEvent("vesper_demo_requests_updated", { detail: { roomNumber, requests } }));
  } catch {
    // Ignore storage quota errors
  }
}

export function addDemoRequest(
  roomNumber: string,
  data: {
    kind: string;
    note?: string;
    items?: { menu_item_id: string; name?: string; quantity: number; unit_price?: number; is_veg?: boolean }[];
    total_amount?: number;
  }
): DemoRequestItem {
  const current = getStoredDemoRequests(roomNumber);
  const now = new Date();
  const dueMinutes = data.kind === "room_service" ? 25 : data.kind === "other" ? 60 : 15;
  const dueAt = new Date(now.getTime() + dueMinutes * 60 * 1000).toISOString();

  const newReq: DemoRequestItem = {
    id: `REQ-${roomNumber}-${Date.now().toString().slice(-4)}`,
    kind: data.kind,
    status: "received",
    note: data.note || null,
    total_amount: data.total_amount || 0,
    due_at: dueAt,
    rating: null,
    items: data.items || [],
  };

  const updated = [newReq, ...current];
  saveStoredDemoRequests(roomNumber, updated);
  return newReq;
}

export function rateDemoRequest(roomNumber: string, requestId: string, rating: number): void {
  const current = getStoredDemoRequests(roomNumber);
  const updated = current.map((req) => (req.id === requestId ? { ...req, rating } : req));
  saveStoredDemoRequests(roomNumber, updated);
}

export function getStoredDemoConciergeMessages(roomNumber: string = "405"): DemoConciergeMessage[] {
  if (typeof window === "undefined") return getInitialDemoConciergeMessages(roomNumber);
  try {
    const raw = window.localStorage.getItem(`${DEMO_CONCIERGE_KEY}_${roomNumber}`);
    if (!raw) {
      const initial = getInitialDemoConciergeMessages(roomNumber);
      window.localStorage.setItem(`${DEMO_CONCIERGE_KEY}_${roomNumber}`, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return getInitialDemoConciergeMessages(roomNumber);
  }
}

export function saveStoredDemoConciergeMessages(roomNumber: string, messages: DemoConciergeMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${DEMO_CONCIERGE_KEY}_${roomNumber}`, JSON.stringify(messages));
    window.dispatchEvent(new CustomEvent("vesper_demo_concierge_updated", { detail: { roomNumber, messages } }));
  } catch {
    // Ignore storage quota errors
  }
}

export function resetDemoGuestData(roomNumber: string = "405"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${DEMO_REQUESTS_KEY}_${roomNumber}`);
    window.localStorage.removeItem(`${DEMO_CONCIERGE_KEY}_${roomNumber}`);
    window.sessionStorage.removeItem(`vesper_guest_plan_stay-demo-${roomNumber}`);
    window.sessionStorage.removeItem(`vesper_guest_taste_history_${roomNumber}`);
  } catch {
    // Ignore
  }
}
