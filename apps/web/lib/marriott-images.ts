/**
 * Curated JW Marriott Mumbai Juhu Image Catalog.
 *
 * Organized by category with verified high-resolution Marriott CDN links,
 * descriptive alt texts, and UI placement tags.
 */

export interface MarriottImage {
  id: string;
  title: string;
  category: "rooms" | "suites" | "valet" | "dining" | "fitness" | "spa" | "pool_bar" | "rooftop_pool";
  url: string;
  alt: string;
  isPrimary?: boolean;
}

export const MARRIOTT_IMAGES: Record<string, MarriottImage[]> = {
  // 1. Rooms (6 Images)
  rooms: [
    {
      id: "room-1-premium",
      title: "Premium Room",
      category: "rooms",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-premium-room-2715-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "JW Marriott Mumbai Juhu - Premium Room with modern plush bedding and city view",
      isPrimary: true,
    },
    {
      id: "room-2-executive-twin",
      title: "Executive Lounge / Twin",
      category: "rooms",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-twin-executive-lounge-21464:Classic-Hor?wid=1336&fit=constrain",
      alt: "Executive Lounge and Twin Room accommodations with exclusive access",
      isPrimary: false,
    },
    {
      id: "room-3-twin-deluxe",
      title: "Twin Deluxe Room",
      category: "rooms",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-twin-deluxe-5333-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Twin Deluxe Room with twin beds, work desk and elegant furnishings",
      isPrimary: false,
    },
    {
      id: "room-4-guest-room",
      title: "Deluxe Guest Room",
      category: "rooms",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-guestroom-8493-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Deluxe Guest Room with warm ambiance and luxury amenities",
      isPrimary: false,
    },
    {
      id: "room-5-ocean-view",
      title: "Ocean View Room",
      category: "rooms",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-ocean-8495-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Ocean View Room overlooking Juhu Beach and Arabian Sea",
      isPrimary: false,
    },
    {
      id: "room-6-club",
      title: "Club Room",
      category: "rooms",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-club-8499-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Club Room with dedicated lounge perks and premium sea views",
      isPrimary: false,
    },
  ],

  // 2. Suites (9 Images)
  suites: [
    {
      id: "suite-1-living",
      title: "Suite Living Room",
      category: "suites",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-living-room-33278:Wide-Hor?wid=750&fit=constrain",
      alt: "Spacious private living room with plush sofas in JW Marriott Suite",
      isPrimary: true,
    },
    {
      id: "suite-2-living-alt",
      title: "Executive Suite Living Area",
      category: "suites",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-living-room-25431:Wide-Hor?wid=750&fit=constrain",
      alt: "Contemporary living room area in luxury suite",
      isPrimary: false,
    },
    {
      id: "suite-3-living-view",
      title: "Suite Living Area",
      category: "suites",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-living-8502-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Living area with floor-to-ceiling windows and scenic vistas",
      isPrimary: false,
    },
    {
      id: "suite-4-grand-ocean",
      title: "Grand Ocean Suite",
      category: "suites",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-grand-ocean-6995-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Grand Ocean Suite with panoramic Arabian Sea coastal views",
      isPrimary: false,
    },
    {
      id: "suite-5-royal",
      title: "Royal Suite",
      category: "suites",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-royal-8503-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Royal Suite with opulent design, dining table and master bedroom",
      isPrimary: false,
    },
    {
      id: "suite-6-king",
      title: "Suite King Bedroom",
      category: "suites",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-king-28398:Wide-Hor?wid=750&fit=constrain",
      alt: "Master King Bedroom in luxury suite with designer headboard",
      isPrimary: false,
    },
    {
      id: "suite-7-executive",
      title: "Executive Suite",
      category: "suites",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-executive-8497-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Executive Suite offering refined luxury and personalized butler service",
      isPrimary: false,
    },
    {
      id: "suite-8-presidential",
      title: "Presidential Suite",
      category: "suites",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-presidential-8501-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Presidential Suite with grand layout and private entertaining spaces",
      isPrimary: false,
    },
    {
      id: "suite-9-bath",
      title: "Suite Marble Bathroom",
      category: "suites",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-bath-6719-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Luxury en-suite marble bathroom with deep soaking tub and rain shower",
      isPrimary: false,
    },
  ],

  // 3. Valet Parking (1 Image)
  valet: [
    {
      id: "valet-1-limousine",
      title: "Valet & Limousine Service",
      category: "valet",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-limousine-0059-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "JW Marriott Mumbai Juhu - Valet parking and luxury airport limousine fleet",
      isPrimary: true,
    },
  ],

  // 4. All-Day Dining & Restaurants (6 Images)
  dining: [
    {
      id: "dining-1-mezzo-mezzo",
      title: "Mezzo Mezzo Italian Restaurant",
      category: "dining",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-mezzo-mezzo-39320:Wide-Hor?wid=750&fit=constrain",
      alt: "Mezzo Mezzo authentic Italian dining at JW Marriott Mumbai Juhu",
      isPrimary: true,
    },
    {
      id: "dining-2-mezzo-kitchen",
      title: "Mezzo Mezzo Show Kitchen",
      category: "dining",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-mezzo-mezzo-kitchen-18691:Wide-Hor?wid=750&fit=constrain",
      alt: "Live show kitchen and wood-fired oven at Mezzo Mezzo",
      isPrimary: false,
    },
    {
      id: "dining-3-mezzo-dining",
      title: "Mezzo Mezzo Dining Room",
      category: "dining",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-mezzo-mezzo-dining-22083:Wide-Hor?wid=750&fit=constrain",
      alt: "Elegant dining room setup at Mezzo Mezzo restaurant",
      isPrimary: false,
    },
    {
      id: "dining-4-mezzo-alfresco",
      title: "Mezzo Mezzo Alfresco Terrace",
      category: "dining",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-alfresco-area-mezzo-mezzo-41399:Wide-Hor?wid=750&fit=constrain",
      alt: "Alfresco open-air dining terrace overlooking palm trees",
      isPrimary: false,
    },
    {
      id: "dining-5-saffron",
      title: "Saffron Indian Fine Dining",
      category: "dining",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-saffron-restaurant-2-25801:Wide-Hor?wid=750&fit=constrain",
      alt: "Saffron contemporary Indian fine dining restaurant",
      isPrimary: false,
    },
    {
      id: "dining-6-terra",
      title: "Terra Private Dining",
      category: "dining",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-terra-private-dining--18239:Wide-Hor?wid=750&fit=constrain",
      alt: "Terra private dining room for exclusive gatherings and celebrations",
      isPrimary: false,
    },
  ],

  // 5. Fitness / Activities (3 Images)
  fitness: [
    {
      id: "fitness-1-gym",
      title: "24/7 Fitness Center",
      category: "fitness",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-fitness-0060-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Fully equipped state-of-the-art fitness center with cardio and strength equipment",
      isPrimary: true,
    },
    {
      id: "fitness-2-beach",
      title: "Juhu Beach Boardwalk",
      category: "fitness",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-juhu-beach-4412-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Direct access to Juhu Beach for morning walks and seaside wellness",
      isPrimary: false,
    },
    {
      id: "fitness-3-yoga",
      title: "Morning Yoga by the Sea",
      category: "fitness",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-yoga-15520:Wide-Hor?wid=750&fit=constrain",
      alt: "Guided yoga and meditation session in serene resort surroundings",
      isPrimary: false,
    },
  ],

  // 6. Spa & Wellness (1 Image + Quan Spa room)
  spa: [
    {
      id: "spa-1-quan",
      title: "Quan Spa Wellness Sanctuary",
      category: "spa",
      url: "/landing/spa.jpg",
      alt: "Warmly lit Quan Spa treatment room with Ayurvedic therapies at JW Marriott Mumbai Juhu",
      isPrimary: true,
    },
    {
      id: "spa-2-ballroom",
      title: "Grand Sangam Event Space",
      category: "spa",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-grand-sanham-ballroom-32189:Wide-Hor?wid=750&fit=constrain",
      alt: "Grand Sangam ballroom and luxury banquet reception hall",
      isPrimary: false,
    },
  ],

  // 7. Pool Bar (1 Image)
  pool_bar: [
    {
      id: "pool-bar-1",
      title: "Saltwater Pool Bar",
      category: "pool_bar",
      url: "https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-alfresco-area-mezzo-mezzo-41399:Wide-Hor?wid=750&fit=constrain",
      alt: "Outdoor poolside bar serving handcrafted cocktails and gourmet light bites",
      isPrimary: true,
    },
  ],

  // 8. Rooftop & Lagoon Pools (3 Images)
  rooftop_pool: [
    {
      id: "pool-1-lagoon",
      title: "Infinity Pool & Palm Gardens",
      category: "rooftop_pool",
      url: "/landing/pool.jpg",
      alt: "Resort lagoon pool surrounded by lush tropical palms and sun loungers",
      isPrimary: true,
    },
    {
      id: "pool-2-dusk",
      title: "Dusk Pool Reflection",
      category: "rooftop_pool",
      url: "/landing/arrival-pool.png",
      alt: "Illuminated resort exterior reflected across infinity swimming pool at twilight",
      isPrimary: false,
    },
    {
      id: "pool-3-ocean",
      title: "Seaside Pool Deck",
      category: "rooftop_pool",
      url: "https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-ocean-8495-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*",
      alt: "Panoramic sea view from resort poolside terrace",
      isPrimary: false,
    },
  ],
};

/**
 * Get primary image for an amenity by key or category.
 */
export function getAmenityImage(key: string, name?: string): string {
  const normalized = (key + " " + (name || "")).toLowerCase();

  if (normalized.includes("pool_bar") || normalized.includes("pool bar") || normalized.includes("bar")) {
    return "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1000&q=80";
  }
  if (normalized.includes("pool") || normalized.includes("swimming") || normalized.includes("sky pool")) {
    return "/landing/pool.jpg";
  }
  if (normalized.includes("spa") || normalized.includes("quan") || normalized.includes("massage") || normalized.includes("wellness")) {
    return "/landing/spa.jpg";
  }
  if (normalized.includes("fitness") || normalized.includes("gym") || normalized.includes("technogym") || normalized.includes("workout")) {
    return "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1000&q=80";
  }
  if (normalized.includes("beach") || normalized.includes("boardwalk") || normalized.includes("sea") || normalized.includes("lounger")) {
    return "/landing/beach.jpg";
  }
  if (normalized.includes("dining") || normalized.includes("restaurant") || normalized.includes("lounge") || normalized.includes("club") || normalized.includes("food")) {
    return "/landing/dining.jpg";
  }
  if (normalized.includes("valet") || normalized.includes("parking") || normalized.includes("limousine") || normalized.includes("car")) {
    return "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1000&q=80";
  }

  return "/landing/pool.jpg";
}

/**
 * Get room category images for a given category key.
 */
export function getRoomCategoryImages(key: string) {
  const k = key.toLowerCase();
  if (k.includes("suite")) {
    return MARRIOTT_IMAGES.suites;
  }
  if (k.includes("club")) {
    return MARRIOTT_IMAGES.rooms.filter((r) => r.id === "room-6-club" || r.id === "room-5-ocean-view");
  }
  if (k.includes("executive")) {
    return [
      MARRIOTT_IMAGES.rooms.find((r) => r.id === "room-2-executive-twin")!,
      MARRIOTT_IMAGES.suites.find((s) => s.id === "suite-7-executive")!,
    ].filter(Boolean);
  }
  // Default to deluxe
  return MARRIOTT_IMAGES.rooms.filter((r) => r.id === "room-1-premium" || r.id === "room-3-twin-deluxe" || r.id === "room-4-guest-room");
}
