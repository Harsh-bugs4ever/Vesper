export interface LandingImage {
  id: string;
  scene: string;
  src: string;
  alt: string;
  credit: string;
}

const marriottCredit = "JW Marriott Mumbai Juhu / Marriott International";

export const landingImages: readonly LandingImage[] = [
  {
    id: "entrance",
    scene: "The arrival",
    src: "/landing/arrival-pool.png",
    alt: "Illuminated resort building reflected in a swimming pool at dusk",
    credit: "Image supplied for this project by the user; original source not supplied",
  },
  // JW Marriott Mumbai Juhu lobby interior with marble floors, columns and seating.
  {
    id: "lobby",
    scene: "The lobby",
    src: "/landing/lobby.jpg",
    alt: "Marble-floored lobby with tall columns and seating at JW Marriott Mumbai Juhu",
    credit: "JW Marriott Mumbai Juhu / via Family Travel Genie",
  },
  // Ocean-view guest room: bed, nightstand and window in one wide composition.
  {
    id: "room",
    scene: "The guest room",
    src: "/landing/room.jpg",
    alt: "Twin-bed ocean-view guest room at JW Marriott Mumbai Juhu",
    credit: marriottCredit,
  },
  // Outdoor swimming pool at JW Marriott Mumbai Juhu, framed by palms and resort gardens.
  {
    id: "pool",
    scene: "The poolside",
    src: "/landing/pool.jpg",
    alt: "Outdoor pool surrounded by palm trees at JW Marriott Mumbai Juhu",
    credit: marriottCredit,
  },
  // Lotus Cafe viewed from the lotus pond, with diners visible through the tall windows.
  {
    id: "dining",
    scene: "The dining room",
    src: "/landing/dining.jpg",
    alt: "Lotus Cafe at JW Marriott Mumbai Juhu, viewed across the lotus pond",
    credit: marriottCredit,
  },
  // Quan Spa treatment room at the Juhu property, with warm timber, a treatment bed and soft lighting.
  {
    id: "spa",
    scene: "The spa",
    src: "/landing/spa.jpg",
    alt: "Warmly lit Quan Spa treatment room at JW Marriott Mumbai Juhu",
    credit: "Quan Spa, JW Marriott Mumbai Juhu / via Luxurylaunches (2015)",
  },
  // Juhu Beach at sunset, with the sun above the Arabian Sea and silhouettes along the shore.
  {
    id: "beach",
    scene: "The sunset",
    src: "/landing/beach.jpg",
    alt: "Sunset over Juhu Beach and the Arabian Sea in Mumbai",
    credit:
      "Unsplash / photo-1633791636335-bf74f38cf0db; featured by The Land of Wanderlust",
  },
];
