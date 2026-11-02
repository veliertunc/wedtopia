import type { Metadata } from "next";

import WeddingApp from "./wedding-app";

export const metadata: Metadata = {
  title: "Wedtopia — A day that's entirely yours",
  description:
    "Discover beautiful wedding venues, rent the details, and bring your celebration together in one thoughtful plan.",
};
export default function WeddingsPage() {
  return <WeddingApp />;
}
