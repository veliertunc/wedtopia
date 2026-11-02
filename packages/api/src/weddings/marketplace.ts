export const liveCategories = [
  "Venues",
  "Vehicles",
  "Equipment",
  "Installations",
  "Dresses",
  "Suits & costumes",
] as const;
export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled";
export interface LiveRental {
  id: string;
  ownerId?: string;
  title: string;
  businessName: string;
  contact: string;
  category: string;
  city: string;
  description: string;
  price: number;
  stock: number;
  capacity: number;
  published: boolean;
  createdAt: string;
  available?: number;
}
export interface LiveBooking {
  id: string;
  listingId: string;
  renterId?: string;
  day: string;
  quantity: number;
  unitPrice: number;
  title: string;
  businessName: string;
  contact: string;
  total: number;
  status: BookingStatus;
  note: string;
  createdAt: string;
}
export const bookingLabels: Record<BookingStatus, string> = {
  pending: "Awaiting supplier",
  confirmed: "Confirmed by supplier",
  declined: "Declined",
  cancelled: "Cancelled",
};
export function canTransition(
  status: BookingStatus,
  next: BookingStatus,
  actor: "renter" | "supplier",
) {
  return (
    status === "pending" &&
    (actor === "renter"
      ? next === "cancelled"
      : next === "confirmed" || next === "declined")
  );
}
export function availableUnits(stock: number, confirmed: number) {
  if (![stock, confirmed].every((n) => Number.isSafeInteger(n) && n >= 0))
    throw new Error("Invalid inventory count");
  return Math.max(0, stock - confirmed);
}
export function bookingTotal(price: number, quantity: number) {
  if (
    !Number.isSafeInteger(price) ||
    price < 1 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    !Number.isSafeInteger(price * quantity) ||
    price * quantity > 2000000000
  )
    throw new Error("Invalid rental amount");
  return price * quantity;
}
