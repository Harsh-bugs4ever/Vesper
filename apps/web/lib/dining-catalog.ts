export interface MenuItem {
  id: string;
  name: string;
  category: "starters" | "mains" | "biryani_tandoor" | "beverages" | "desserts";
  categoryLabel: string;
  price: number;
  description: string;
  is_veg: boolean;
  is_available: boolean;
  tag?: string;
  aiRationale?: string;
  calories?: string;
  preparationTimeMinutes: number;
  imageUrl?: string;
}

export const FALLBACK_MENU_ITEMS: MenuItem[] = [
  // --- NON-VEGETARIAN ITEMS ---
  {
    id: "mumbai-chicken-club",
    name: "Mumbai Smoked Chicken Club Sandwich",
    category: "starters",
    categoryLabel: "Starters & Small Bites",
    price: 650,
    description: "Triple-layer toasted brioche, smoked chicken breast, sunny egg, aged English cheddar, crisp iceberg & mustard mayo.",
    is_veg: false,
    is_available: true,
    tag: "Chef's Special",
    aiRationale: "Signature high-protein comfort classic, prepared fresh on artisanal sourdough.",
    calories: "520 kcal",
    preparationTimeMinutes: 20,
  },
  {
    id: "murgh-malai-tikka",
    name: "Murgh Malai Tikka & Mint Chutney",
    category: "biryani_tandoor",
    categoryLabel: "Biryani & Tandoor",
    price: 680,
    description: "Tender boneless chicken morsels steeped in rich cream cheese, green cardamom, and royal cumin, charred in the clay oven.",
    is_veg: false,
    is_available: true,
    tag: "Tandoor Special",
    aiRationale: "Succulent charcoal-roasted non-veg delicacy with subtle aromatic spices.",
    calories: "480 kcal",
    preparationTimeMinutes: 25,
  },
  {
    id: "awadhi-dum-biryani",
    name: "Awadhi Dum Gosht Biryani",
    category: "biryani_tandoor",
    categoryLabel: "Biryani & Tandoor",
    price: 790,
    description: "Slow-braised tender lamb pieces layered with aged basmati rice, saffron strands, rose water, and caramelized shallots.",
    is_veg: false,
    is_available: true,
    tag: "Royal Awadhi",
    aiRationale: "Slow-simmered non-veg royal delicacy, perfectly balanced with fragrant saffron.",
    calories: "680 kcal",
    preparationTimeMinutes: 30,
  },
  {
    id: "butter-chicken-makhani",
    name: "Old Delhi Butter Chicken & Butter Naan",
    category: "mains",
    categoryLabel: "Mains & Curries",
    price: 720,
    description: "Charcoal-grilled tandoori chicken simmered in a velvety San Marzano tomato, churned white butter, and fenugreek sauce.",
    is_veg: false,
    is_available: true,
    tag: "Bestseller",
    aiRationale: "Our most requested non-veg main course, served piping hot with garlic butter naan.",
    calories: "640 kcal",
    preparationTimeMinutes: 25,
  },
  {
    id: "coastal-tawa-prawns",
    name: "Konkan Pepper Garlic Tawa Prawns",
    category: "starters",
    categoryLabel: "Starters & Small Bites",
    price: 850,
    description: "Jumbo Arabian Sea prawns tossed in crushed Tellicherry black peppercorns, fresh curry leaves, and kokum butter.",
    is_veg: false,
    is_available: true,
    tag: "Coastal Catch",
    aiRationale: "Fresh coastal catch with intense coastal spices for seafood lovers.",
    calories: "390 kcal",
    preparationTimeMinutes: 20,
  },
  {
    id: "grilled-salmon-fillet",
    name: "Pan-Seared Atlantic Salmon Fillet",
    category: "mains",
    categoryLabel: "Mains & Curries",
    price: 950,
    description: "Crispy-skin Norwegian salmon with charred lemon caper butter, grilled asparagus spears, and crushed baby potatoes.",
    is_veg: false,
    is_available: true,
    tag: "Healthy Gourmet",
    aiRationale: "Omega-3 rich premium non-veg seafood entree with delicate Mediterranean seasoning.",
    calories: "460 kcal",
    preparationTimeMinutes: 25,
  },

  // --- VEGETARIAN ITEMS ---
  {
    id: "paneer-kathi-roll",
    name: "Paneer Tikka Kathi Roll",
    category: "starters",
    categoryLabel: "Starters & Small Bites",
    price: 520,
    description: "Clay-oven roasted cottage cheese, chargrilled bell peppers, pickled onions, and wild mint pomegranate chutney.",
    is_veg: true,
    is_available: true,
    tag: "Vegetarian",
    aiRationale: "Rich in protein and wrapped in flaky roomali roti.",
    calories: "440 kcal",
    preparationTimeMinutes: 20,
  },
  {
    id: "dal-vesper-naan",
    name: "Dal Vesper & Truffle Butter Naan",
    category: "mains",
    categoryLabel: "Mains & Curries",
    price: 580,
    description: "Slow-simmered 24-hour black urad lentils churned with white butter, served with fluffy tandoori truffle naan.",
    is_veg: true,
    is_available: true,
    tag: "Signature Dish",
    aiRationale: "Velvety comfort food recipe perfected over 24 hours of slow charcoal cooking.",
    calories: "510 kcal",
    preparationTimeMinutes: 25,
  },
  {
    id: "caesar-salad-gourmet",
    name: "Crisp Romaine Caesar Salad",
    category: "starters",
    categoryLabel: "Starters & Small Bites",
    price: 480,
    description: "Crisp hydro-grown romaine hearts, aged parmigiano-reggiano shavings, and garlic herb brioche croutons.",
    is_veg: true,
    is_available: true,
    tag: "Farm Fresh",
    aiRationale: "Light, crunchy organic salad tossed in creamy emulsified emulsion.",
    calories: "280 kcal",
    preparationTimeMinutes: 15,
  },
  {
    id: "truffle-mushroom-risotto",
    name: "Wild Forest Mushroom & Truffle Risotto",
    category: "mains",
    categoryLabel: "Mains & Curries",
    price: 640,
    description: "Creamy Carnaroli arborio rice, pan-roasted porcini and shiitake mushrooms, Umbrian black truffle oil, and parmesan crisp.",
    is_veg: true,
    is_available: true,
    tag: "Italian Craft",
    aiRationale: "Decadent umami-rich vegetarian specialty crafted by our Italian sous chef.",
    calories: "520 kcal",
    preparationTimeMinutes: 25,
  },

  // --- ARTISANAL BEVERAGES ---
  {
    id: "kashmiri-kahwa-pot",
    name: "Artisanal Kashmiri Saffron Kahwa",
    category: "beverages",
    categoryLabel: "Artisanal Beverages",
    price: 280,
    description: "Handpicked green tea steeped with pure Pampore saffron, whole cinnamon, green cardamom, and slivered almonds.",
    is_veg: true,
    is_available: true,
    tag: "Wellness",
    aiRationale: "A soothing digestive elixir that pairs wonderfully with rich gravies and biryanis.",
    calories: "90 kcal",
    preparationTimeMinutes: 15,
  },
  {
    id: "alphonso-mango-lassi",
    name: "Chilled Alphonso Mango & Mint Lassi",
    category: "beverages",
    categoryLabel: "Artisanal Beverages",
    price: 320,
    description: "Fresh Ratnagiri Alphonso mango pulp churned with chilled organic hung curd, cardamom, and garden mint.",
    is_veg: true,
    is_available: true,
    tag: "Refreshing",
    aiRationale: "Rich and creamy cooler to balance warm spices.",
    calories: "210 kcal",
    preparationTimeMinutes: 10,
  },

  {
    id: "barolo-reserve-2018",
    name: "Barolo DOCG 2018 Vintage Reserve",
    category: "beverages",
    categoryLabel: "Artisanal Beverages",
    price: 4800,
    description: "Piedmont vintage reserve aged 38 months in Slavonian oak. (Depleted: 0 btl · AI Auto-Order PO-2026-904 in transit · Concealed from guest menu by AI Shield)",
    is_veg: true,
    is_available: false,
    tag: "Sommelier Pick",
    aiRationale: "Exclusive vintage reserve. Automatically concealed from guest room menu while replenishment is in transit.",
    calories: "120 kcal",
    preparationTimeMinutes: 5,
  },

  // --- GOURMET DESSERTS ---
  {
    id: "dark-chocolate-fondant",
    name: "Warm Belgian Dark Chocolate Fondant",
    category: "desserts",
    categoryLabel: "Gourmet Desserts",
    price: 420,
    description: "70% Callebaut dark chocolate molten lava cake served with Madagascar vanilla bean ice cream & berry coulis.",
    is_veg: true,
    is_available: true,
    tag: "Decadent",
    aiRationale: "Warm flowing dark chocolate dessert to complete your dining experience.",
    calories: "480 kcal",
    preparationTimeMinutes: 20,
  },
  {
    id: "gulab-jamun-pista-rabri",
    name: "Warm Shahi Gulab Jamun with Pista Rabri",
    category: "desserts",
    categoryLabel: "Gourmet Desserts",
    price: 380,
    description: "Tender golden mawa dumplings steeped in saffron rose syrup, blanketed in slow-reduced pistachio rabri.",
    is_veg: true,
    is_available: true,
    tag: "Royal Indian",
    aiRationale: "Classic royal indulgence served at optimum temperature.",
    calories: "410 kcal",
    preparationTimeMinutes: 15,
  },
];

export interface OrderItemHistorySummary {
  name: string;
  is_veg: boolean;
  quantity: number;
}

export interface AiRecommendationResult {
  preference: "non-veg" | "veg" | "neutral";
  preferenceLabel: string;
  headline: string;
  explanation: string;
  recommendations: MenuItem[];
}

/**
 * Intelligent AI Recommendation Engine:
 * Analyzes the user's order history and cart.
 * If user orders/ordered non-veg food, it strictly suggests NON-VEGETARIAN foods only!
 * If user orders/ordered veg food only, it suggests vegetarian foods.
 */
export function getAiDiningRecommendations(
  orderHistory: OrderItemHistorySummary[],
  cartItemIds: string[] = [],
  availableCatalog?: MenuItem[]
): AiRecommendationResult {
  const catalog = availableCatalog && availableCatalog.length > 0 ? availableCatalog : FALLBACK_MENU_ITEMS;

  // Check if non-veg items exist in order history or current cart
  const orderedNonVegCount = orderHistory.filter((item) => !item.is_veg).reduce((sum, item) => sum + item.quantity, 0);
  const orderedVegCount = orderHistory.filter((item) => item.is_veg).reduce((sum, item) => sum + item.quantity, 0);

  // Check current cart
  const cartItems = catalog.filter((item) => cartItemIds.includes(item.id));
  const cartNonVegCount = cartItems.filter((item) => !item.is_veg).length;
  const cartVegCount = cartItems.filter((item) => item.is_veg).length;

  const totalNonVeg = orderedNonVegCount + cartNonVegCount;
  const totalVeg = orderedVegCount + cartVegCount;

  // Recent non-veg item names for personalized phrasing
  const recentNonVegNames = [
    ...orderHistory.filter((i) => !i.is_veg).map((i) => i.name),
    ...cartItems.filter((i) => !i.is_veg).map((i) => i.name),
  ];

  const recentVegNames = [
    ...orderHistory.filter((i) => i.is_veg).map((i) => i.name),
    ...cartItems.filter((i) => i.is_veg).map((i) => i.name),
  ];

  // If user has chosen non-veg: STRICTLY suggest non-veg food only!
  if (totalNonVeg > 0) {
    const primarySample = recentNonVegNames[0] || "non-vegetarian selection";
    // Filter STRICTLY to non-veg food items
    let nonVegPool = catalog.filter((item) => !item.is_veg);
    if (nonVegPool.length === 0) {
      nonVegPool = FALLBACK_MENU_ITEMS.filter((item) => !item.is_veg);
    }
    
    // Sort items: prioritize items not yet ordered/in cart, then popular ones
    const prioritizedNonVeg = [...nonVegPool].sort((a, b) => {
      const aInCart = cartItemIds.includes(a.id) ? 1 : 0;
      const bInCart = cartItemIds.includes(b.id) ? 1 : 0;
      return aInCart - bInCart;
    });

    return {
      preference: "non-veg",
      preferenceLabel: "Non-Vegetarian Gourmet Palate",
      headline: "Curated Non-Vegetarian Delicacies",
      explanation: `Our AI Concierge analyzed your order history of ${primarySample}. To honor your non-vegetarian palate, we are suggesting only premium non-veg delicacies prepared fresh in the resort kitchen.`,
      recommendations: prioritizedNonVeg.slice(0, 4),
    };
  }

  // If user has exclusively ordered vegetarian
  if (totalVeg > 0) {
    const primarySample = recentVegNames[0] || "vegetarian selection";
    let vegPool = catalog.filter((item) => item.is_veg && item.category !== "beverages");
    if (vegPool.length === 0) {
      vegPool = FALLBACK_MENU_ITEMS.filter((item) => item.is_veg && item.category !== "beverages");
    }

    return {
      preference: "veg",
      preferenceLabel: "Pure Vegetarian Palate",
      headline: "Artisanal Vegetarian Specialties",
      explanation: `Our AI Concierge identified your pure vegetarian preference from your order of ${primarySample}. Here are wholesome, handcrafted vegetarian specialties curated for you.`,
      recommendations: vegPool.slice(0, 4),
    };
  }

  // If no history yet, provide chef's balanced top recommendations from catalog
  const topSignatures = catalog.slice(0, 4);
  const fallbackSignatures = [
    FALLBACK_MENU_ITEMS.find((i) => i.id === "mumbai-chicken-club")!,
    FALLBACK_MENU_ITEMS.find((i) => i.id === "murgh-malai-tikka")!,
    FALLBACK_MENU_ITEMS.find((i) => i.id === "dal-vesper-naan")!,
    FALLBACK_MENU_ITEMS.find((i) => i.id === "awadhi-dum-biryani")!,
  ].filter(Boolean);

  return {
    preference: "neutral",
    preferenceLabel: "Chef Ranveer's Highlights",
    headline: "Executive Chef's Signature Recommendations",
    explanation: "Curated signature dishes from Vesper's kitchen. Place your first order to unlock deeply tailored AI palate recommendations!",
    recommendations: topSignatures.length >= 2 ? topSignatures : fallbackSignatures,
  };
}

export function getFoodImage(name: string, category?: string): string {
  const n = (name || "").toLowerCase();
  const c = (category || "").toLowerCase();

  if (n.includes("sandwich") || n.includes("club") || n.includes("burger")) {
    return "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("tikka") || n.includes("kebab") || n.includes("tandoor")) {
    return "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("biryani") || n.includes("rice") || n.includes("pulao") || n.includes("gosht")) {
    return "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("butter chicken") || n.includes("murgh") || n.includes("chicken") || n.includes("curry")) {
    return "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("salmon") || n.includes("fish") || n.includes("sea bass")) {
    return "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("prawn") || n.includes("shrimp") || n.includes("seafood")) {
    return "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("dal") || n.includes("lentil") || n.includes("naan")) {
    return "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("risotto") || n.includes("mushroom") || n.includes("pasta")) {
    return "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("burrata") || n.includes("salad") || n.includes("tomato")) {
    return "https://images.unsplash.com/photo-1592417817098-8f3d6ef23a28?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("cake") || n.includes("lava") || n.includes("chocolate") || n.includes("brownie")) {
    return "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("tart") || n.includes("mango") || n.includes("dessert") || c.includes("dessert")) {
    return "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop&q=80";
  }
  if (n.includes("juice") || n.includes("orange") || n.includes("beverage") || n.includes("latte") || n.includes("coffee") || c.includes("beverage")) {
    return "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&auto=format&fit=crop&q=80";
  }

  return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80";
}
