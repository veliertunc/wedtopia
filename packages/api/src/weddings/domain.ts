export const categories = [
  "All rentals",
  "Venues",
  "Vehicles",
  "Equipment",
  "Installations",
  "Dresses",
  "Suits & costumes",
] as const;
export type Category = (typeof categories)[number];
export interface Rental {
  id: string;
  name: string;
  category: Category;
  city: string;
  area: string;
  price: number;
  capacity: number;
  image: string;
  tag: string;
  description: string;
  lat: number;
  lng: number;
}
// Curated demonstration inventory, not live supplier availability. Prices are TRY/day.
export const rentals: Rental[] = [
  {
    id: "bosphorus",
    name: "The Bosphorus Garden",
    category: "Venues",
    city: "Istanbul",
    area: "Beykoz",
    price: 85000,
    capacity: 250,
    image: "photo-1519741497674-611481863552",
    tag: "Waterfront ceremony",
    description:
      "An intimate garden, a sea breeze, and a sunset made for your story. Garden and reception space rental; catering quoted separately.",
    lat: 41.133,
    lng: 29.091,
  },
  {
    id: "olive",
    name: "Under the Olive Trees",
    category: "Venues",
    city: "Izmir",
    area: "Urla",
    price: 62000,
    capacity: 180,
    image: "photo-1519225421980-715cb0215aed",
    tag: "Countryside escape",
    description:
      "A sunlit olive grove with a courtyard for a relaxed, Mediterranean celebration.",
    lat: 38.322,
    lng: 26.765,
  },
  {
    id: "palace",
    name: "A Palace by the Sea",
    category: "Venues",
    city: "Istanbul",
    area: "Besiktas",
    price: 140000,
    capacity: 400,
    image: "photo-1465495976277-4387d4b0e4a6",
    tag: "A little extraordinary",
    description:
      "Historic architecture and an elegant terrace overlooking the Bosphorus.",
    lat: 41.043,
    lng: 29.016,
  },
  {
    id: "vintage",
    name: "The Vintage Getaway",
    category: "Vehicles",
    city: "Istanbul",
    area: "Sisli",
    price: 12500,
    capacity: 4,
    image: "photo-1489824904134-891ab64532f1",
    tag: "Arrive in style",
    description:
      "Classic wedding car with a chauffeur for an eight-hour celebration.",
    lat: 41.06,
    lng: 28.987,
  },
  {
    id: "sound",
    name: "Sound & Starlight",
    category: "Equipment",
    city: "Istanbul",
    area: "Kadikoy",
    price: 18000,
    capacity: 300,
    image: "photo-1470229722913-7c0e2dbbafd3",
    tag: "Set the atmosphere",
    description:
      "PA, microphones, dance-floor lighting and technician for one evening.",
    lat: 40.99,
    lng: 29.028,
  },
  {
    id: "flowers",
    name: "The Garden Installation",
    category: "Installations",
    city: "Istanbul",
    area: "Beykoz",
    price: 24000,
    capacity: 250,
    image: "photo-1478146896981-b80fe463b330",
    tag: "Beautiful little details",
    description:
      "Ceremony arch and table styling with installation and collection included.",
    lat: 41.13,
    lng: 29.09,
  },
  {
    id: "dress",
    name: "The Seraphine Gown",
    category: "Dresses",
    city: "Istanbul",
    area: "Nisantasi",
    price: 16000,
    capacity: 1,
    image: "photo-1594552072238-b8a33785b261",
    tag: "Something borrowed",
    description:
      "Ivory bridal gown rental with fitting appointment and cleaning. Sizes confirmed by the atelier.",
    lat: 41.052,
    lng: 28.995,
  },
  {
    id: "suit",
    name: "The Midnight Tuxedo",
    category: "Suits & costumes",
    city: "Istanbul",
    area: "Nisantasi",
    price: 6500,
    capacity: 1,
    image: "photo-1594938298603-c8148c4dae35",
    tag: "Tailored to the moment",
    description:
      "Three-piece formalwear rental, fitting and cleaning included.",
    lat: 41.05,
    lng: 28.99,
  },
];
export interface WeddingPlan {
  names: string;
  date: string;
  city: string;
  guests: number;
  budget: number;
  style: string;
  rentalIds: string[];
  months: number;
}
export const initialPlan: WeddingPlan = {
  names: "Our wedding",
  date: "2027-06-19",
  city: "Istanbul",
  guests: 150,
  budget: 250000,
  style: "Romantic garden",
  rentalIds: [],
  months: 6,
};
export const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
export const photo = (id: string, width = 1000) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
export function totalFor(ids: string[]) {
  return rentals
    .filter((r) => ids.includes(r.id))
    .reduce((sum, r) => sum + r.price, 0);
}
export function installments(total: number, months: number) {
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(total * 100) ||
    !Number.isSafeInteger(total * 100) ||
    total < 0 ||
    ![1, 3, 6, 12].includes(months)
  )
    throw new Error("Invalid installment plan");
  const cents = total * 100;
  const base = Math.floor(cents / months);
  return Array.from(
    { length: months },
    (_, i) => (base + (i < cents % months ? 1 : 0)) / 100,
  );
}
export function suggestBundle(plan: WeddingPlan) {
  const chosen: Rental[] = [];
  for (const category of categories.slice(1)) {
    const option = rentals
      .filter(
        (r) =>
          r.category === category &&
          r.city === plan.city &&
          (category !== "Venues" || r.capacity >= plan.guests),
      )
      .sort((a, b) => a.price - b.price)[0];
    if (
      option &&
      totalFor(chosen.map((r) => r.id)) + option.price <= plan.budget
    )
      chosen.push(option);
  }
  return chosen;
}
export function mapsLink(r: Rental) {
  return `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
}
export function uberLink(r: Rental, clientId?: string) {
  const query = new URLSearchParams({
    action: "setPickup",
    pickup: "my_location",
    "dropoff[latitude]": String(r.lat),
    "dropoff[longitude]": String(r.lng),
    "dropoff[nickname]": r.name,
  });
  if (clientId) query.set("client_id", clientId);
  return `https://m.uber.com/ul/?${query}`;
}

/** Validate persisted or imported data before letting it into either client. Past dates remain valid drafts. */
export function readWeddingPlan(value: unknown): WeddingPlan | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (
    typeof p.names !== "string" ||
    !p.names.trim() ||
    p.names.length > 120 ||
    typeof p.style !== "string" ||
    p.style.length > 200 ||
    typeof p.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
    !Number.isFinite(Date.parse(p.date)) ||
    new Date(p.date).toISOString().slice(0, 10) !== p.date ||
    !["Istanbul", "Izmir"].includes(p.city as string) ||
    typeof p.guests !== "number" ||
    !Number.isInteger(p.guests) ||
    p.guests < 2 ||
    p.guests > 2000 ||
    typeof p.budget !== "number" ||
    !Number.isSafeInteger(p.budget) ||
    p.budget < 1000 ||
    p.budget > 100000000 ||
    ![1, 3, 6, 12].includes(p.months as number) ||
    !Array.isArray(p.rentalIds) ||
    p.rentalIds.length > 30 ||
    p.rentalIds.some(
      (id) => typeof id !== "string" || !rentals.some((r) => r.id === id),
    ) ||
    new Set(p.rentalIds).size !== p.rentalIds.length
  )
    return null;
  return {
    names: p.names.trim(),
    date: p.date,
    city: p.city as string,
    guests: p.guests,
    budget: p.budget,
    style: p.style,
    rentalIds: [...p.rentalIds] as string[],
    months: p.months as number,
  };
}

/** Only provider-generated Google Maps URLs may become clickable place links. */
export function safePlaceUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["maps.google.com", "www.google.com", "maps.app.goo.gl"].includes(
        url.hostname,
      )
      ? url.href
      : null;
  } catch {
    return null;
  }
}
