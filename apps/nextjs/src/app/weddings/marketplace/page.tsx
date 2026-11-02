import type { Metadata } from "next";

import MarketplaceApp from "./marketplace-app";

export const metadata: Metadata = {
  title: "Wedtopia — Supplier rentals",
  description:
    "Browse supplier-published wedding rentals, request your date and manage your reservations.",
};
export default function Page() {
  return <MarketplaceApp />;
}
