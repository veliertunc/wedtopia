import type { WeddingPlan } from "./domain";

export interface SavedPlan {
  id: string;
  data: WeddingPlan;
  createdAt: string;
}
export interface AvailabilityRequest {
  id: string;
  plan: WeddingPlan;
  total: number;
  status: string;
  createdAt: string;
}
export interface PlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  attributions?: { provider?: string; providerUri?: string }[];
}
