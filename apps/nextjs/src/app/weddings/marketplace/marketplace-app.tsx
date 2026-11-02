"use client";

import { useEffect, useRef, useState } from "react";

import type { LiveBooking, LiveRental } from "@acme/api/weddings/marketplace";
import type { DatabaseReadiness } from "@acme/api/weddings/readiness";
import { initialPlan, money } from "@acme/api/weddings/domain";
import { bookingLabels, liveCategories } from "@acme/api/weddings/marketplace";

import { authClient } from "~/auth/client";

import "../weddings.css";
import "./marketplace.css";

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/weddings/${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const result = (await response.json()) as T & {
    error?: string;
    details?: string[];
  };
  if (!response.ok)
    throw new Error(result.details?.[0] ?? result.error ?? "Please try again.");
  return result;
}
export default function MarketplaceApp() {
  const [tab, setTab] = useState("Discover");
  const [day, setDay] = useState(initialPlan.date);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("All rentals");
  const [listings, setListings] = useState<LiveRental[]>([]);
  const [owned, setOwned] = useState<LiveRental[]>([]);
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [incoming, setIncoming] = useState<LiveBooking[]>([]);
  const [selected, setSelected] = useState<LiveRental | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [service, setService] = useState<DatabaseReadiness | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    businessName: "",
    contact: "",
    category: "Venues",
    city: "Istanbul",
    description: "",
    price: 10000,
    stock: 1,
    capacity: 150,
  });
  const requestKey = useRef("");
  const { data: session } = authClient.useSession();
  async function checkService() {
    try {
      const response = await fetch("/api/weddings/readiness", {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      const result = (await response.json()) as Partial<DatabaseReadiness>;
      if (
        typeof result.ready !== "boolean" ||
        typeof result.message !== "string"
      )
        throw new Error("Unavailable");
      setService(result as DatabaseReadiness);
    } catch {
      setService({
        ready: false,
        state: "unavailable",
        message:
          "The rental service is temporarily unavailable. You can still plan with the inspiration collection.",
      });
    }
  }
  useEffect(() => {
    void checkService();
  }, []);
  useEffect(() => {
    requestKey.current = "";
  }, [selected, day, quantity, note]);
  async function discover() {
    setBusy(true);
    setStatus("");
    setSelected(null);
    try {
      const result = await api<{ listings: LiveRental[] }>(
        `marketplace?${new URLSearchParams({ day, city: city.trim() })}`,
      );
      setListings(result.listings);
      setLoaded(true);
    } catch (error) {
      setStatus((error as Error).message);
      setLoaded(false);
    } finally {
      setBusy(false);
    }
  }
  async function account(supplier: boolean) {
    setBusy(true);
    setStatus("");
    try {
      if (supplier) {
        const result = await api<{
          listings: LiveRental[];
          bookings: LiveBooking[];
        }>("supplier");
        setOwned(result.listings);
        setIncoming(result.bookings);
      } else {
        const result = await api<{ bookings: LiveBooking[] }>("bookings");
        setBookings(result.bookings);
      }
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function mutate(path: string, body: unknown, supplier = false) {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      await api(path, body);
      setStatus(
        path === "listing"
          ? "Rental saved. Refresh your supplier dashboard to see the latest details."
          : "Request updated. Refresh your requests to see the latest status.",
      );
      if (supplier) {
        const result = await api<{
          listings: LiveRental[];
          bookings: LiveBooking[];
        }>("supplier");
        setOwned(result.listings);
        setIncoming(result.bookings);
      } else {
        const result = await api<{ bookings: LiveBooking[] }>("bookings");
        setBookings(result.bookings);
      }
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reserve() {
    if (!selected || busy) return;
    setBusy(true);
    setStatus("");
    requestKey.current ||= crypto.randomUUID();
    try {
      await api("reservation", {
        listingId: selected.id,
        day,
        quantity,
        note,
        idempotencyKey: requestKey.current,
      });
      setSelected(null);
      setTab("My requests");
      const result = await api<{ bookings: LiveBooking[] }>("bookings");
      setBookings(result.bookings);
      setStatus(
        "Your request was sent. It does not reserve stock until the supplier confirms. No payment was collected.",
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function bookingCard(booking: LiveBooking, supplier = false) {
    return (
      <article className="wm-request" key={booking.id}>
        <div>
          <span className="w-eyebrow w-green">
            {bookingLabels[booking.status]}
          </span>
          <h3>{booking.title}</h3>
          <p>
            {booking.businessName} · {booking.contact} · {booking.day} ·{" "}
            {booking.quantity} unit
            {booking.quantity === 1 ? "" : "s"}
          </p>
          <strong>{money(booking.total)}</strong>
          <small>Request {booking.id.slice(0, 8)} · no online payment</small>
          {booking.note && <p className="wm-note">{booking.note}</p>}
        </div>
        {booking.status === "pending" && (
          <div className="w-modal-actions">
            {supplier ? (
              <>
                <button
                  className="w-button w-dark"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      "booking-decision",
                      { id: booking.id, decision: "confirmed" },
                      true,
                    )
                  }
                >
                  Confirm stock
                </button>
                <button
                  className="w-button w-outline"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      "booking-decision",
                      { id: booking.id, decision: "declined" },
                      true,
                    )
                  }
                >
                  Decline
                </button>
              </>
            ) : (
              <button
                className="w-button w-outline"
                disabled={busy}
                onClick={() =>
                  void mutate("booking-decision", {
                    id: booking.id,
                    decision: "cancelled",
                  })
                }
              >
                Cancel pending request
              </button>
            )}
          </div>
        )}
        {booking.status === "confirmed" && (
          <p>
            Supplier-confirmed stock for this date. Arrange delivery, fitting,
            payment and cancellation terms with the supplier before proceeding.
          </p>
        )}
      </article>
    );
  }
  return (
    <main className="wedtopia wm-page">
      <header className="w-header">
        <a className="w-logo" href="/weddings">
          wedtopia.
        </a>
        <a className="w-link" href="/weddings">
          ← Back to your wedding
        </a>
      </header>
      <section className="wm-intro">
        <span className="w-eyebrow w-green">THE PEOPLE BEHIND YOUR DAY</span>
        <h1>
          Beautiful details.
          <br />
          <em>Real connections.</em>
        </h1>
        <p>
          Rentals published by suppliers. Find your date, send a request, and
          let the details come together.
        </p>
        <small>
          Supplier-entered listings are not independently verified. Confirm all
          service and payment terms directly.
        </small>
      </section>
      <div className="wm-content">
        <nav className="wm-tabs" aria-label="Marketplace views">
          {["Discover", "My requests", "Supplier studio"].map((value) => (
            <button
              key={value}
              className={`w-button ${value === tab ? "w-dark" : "w-outline"}`}
              onClick={() => {
                setTab(value);
                setStatus("");
              }}
            >
              {value}
            </button>
          ))}
        </nav>
        {!session && (
          <div className="wm-signin">
            <p>
              Browse freely. Sign in to request rentals or manage your supplier
              studio.
            </p>
            <button
              className="w-button w-outline"
              disabled={busy}
              onClick={() =>
                void authClient.signIn
                  .social({
                    provider: "discord",
                    callbackURL: "/weddings/marketplace",
                  })
                  .then((result) => {
                    if (result.error)
                      setStatus(
                        result.error.message ?? "Sign-in is unavailable.",
                      );
                  })
                  .catch(() =>
                    setStatus(
                      "Sign-in is unavailable. Please try again later.",
                    ),
                  )
              }
            >
              Sign in with Discord
            </button>
          </div>
        )}
        {service && !service.ready && (
          <aside className="wm-status" role="status">
            <p>{service.message}</p>
            <div className="w-modal-actions">
              <button
                className="w-button w-outline"
                onClick={() => void checkService()}
              >
                Try live service again
              </button>
              <a className="w-link" href="/weddings">
                Continue with inspiration →
              </a>
            </div>
          </aside>
        )}
        {status && (
          <p className="wm-status" role="status">
            {status}
          </p>
        )}
        {tab === "Discover" && (
          <>
            <form
              className="wm-search"
              onSubmit={(event) => {
                event.preventDefault();
                void discover();
              }}
            >
              <label>
                Your wedding date
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={day}
                  onChange={(e) => {
                    setDay(e.target.value);
                    setLoaded(false);
                    setListings([]);
                    setSelected(null);
                  }}
                  required
                />
              </label>
              <label>
                City
                <input
                  value={city}
                  placeholder="All cities"
                  maxLength={100}
                  onChange={(e) => setCity(e.target.value)}
                />
              </label>
              <label>
                Rental type
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {["All rentals", ...liveCategories].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <button className="w-button w-dark" disabled={busy}>
                Find rentals
              </button>
            </form>
            {!loaded && (
              <div className="w-empty">
                <h3>A little more to discover.</h3>
                <p>
                  Choose your date and search supplier-published rentals. Sample
                  rentals are available in the inspiration collection.
                </p>
              </div>
            )}
            {loaded &&
              !listings.filter(
                (l) => category === "All rentals" || l.category === category,
              ).length && (
                <div className="w-empty">
                  <h3>No published rentals match yet.</h3>
                  <p>
                    Try another city, or publish your first rental in the
                    supplier studio.
                  </p>
                </div>
              )}
            <div className="wm-grid">
              {listings
                .filter(
                  (l) => category === "All rentals" || l.category === category,
                )
                .map((listing) => (
                  <article className="wm-listing" key={listing.id}>
                    <div className="wm-listing-art">
                      <span>
                        {listing.category === "Venues"
                          ? "⌂"
                          : listing.category === "Vehicles"
                            ? "↗"
                            : "✧"}
                      </span>
                      <small>
                        {listing.category} · {listing.city}
                      </small>
                    </div>
                    <div className="wm-listing-copy">
                      <span className="w-eyebrow w-green">
                        {listing.businessName} · {listing.contact}
                      </span>
                      <h2>{listing.title}</h2>
                      <p>{listing.description}</p>
                      <small>
                        {listing.available} of {listing.stock} units currently
                        available for {day}
                        {listing.category === "Venues"
                          ? ` · ${listing.capacity} guests`
                          : ""}
                      </small>
                      <div className="wm-listing-bottom">
                        <strong>
                          {money(listing.price)}
                          <small> / unit / day</small>
                        </strong>
                        <button
                          className="w-button w-dark"
                          disabled={busy || !listing.available}
                          onClick={() => {
                            setSelected(listing);
                            setQuantity(1);
                            setNote("");
                          }}
                        >
                          Request date
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
            </div>
            {selected && (
              <section className="wm-reserve">
                <span className="w-eyebrow w-green">MAKE A CONNECTION</span>
                <h2>{selected.title}</h2>
                <p>
                  {day} · {selected.businessName}. Requests are for a single
                  rental day. Availability may change before confirmation.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void reserve();
                  }}
                >
                  <div className="w-plan-fields">
                    <label>
                      Quantity
                      <input
                        type="number"
                        min={1}
                        max={selected.stock}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        required
                      />
                    </label>
                    <label>
                      A note for the supplier
                      <textarea
                        autoFocus
                        value={note}
                        maxLength={1000}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Timing, sizing, setup or delivery preferences…"
                      />
                    </label>
                  </div>
                  <p>
                    Requested total:{" "}
                    <strong>{money(selected.price * (quantity || 0))}</strong>
                  </p>
                  <div className="w-modal-actions">
                    <button className="w-button w-dark" disabled={busy}>
                      Send request
                    </button>
                    <button
                      className="w-button w-outline"
                      type="button"
                      onClick={() => setSelected(null)}
                    >
                      Keep browsing
                    </button>
                  </div>
                </form>
              </section>
            )}
          </>
        )}
        {tab === "My requests" && (
          <section>
            <h2>Your day, taking shape.</h2>
            <p>
              Pending requests do not hold stock. Only the supplier can confirm
              a rental. Confirmed reservations cannot be cancelled here.
            </p>
            <button
              className="w-button w-outline"
              disabled={busy}
              onClick={() => void account(false)}
            >
              Refresh my requests
            </button>
            {bookings.map((b) => bookingCard(b))}
          </section>
        )}
        {tab === "Supplier studio" && (
          <section>
            <span className="w-eyebrow w-green">YOUR SUPPLIER STUDIO</span>
            <h2>
              Be part of their <em>beautiful day.</em>
            </h2>
            <p>
              Create a draft, review its details, then publish it. Rental
              details and stock stay fixed after creation; archive and create a
              new listing to change your offer. Existing reservations remain
              visible after archiving.
            </p>
            <button
              className="w-button w-outline"
              disabled={busy}
              onClick={() => void account(true)}
            >
              Refresh supplier dashboard
            </button>
            <form
              className="wm-create"
              onSubmit={(e) => {
                e.preventDefault();
                void mutate("listing", { operation: "create", ...draft }, true);
              }}
            >
              <h3>Create a rental draft</h3>
              <div className="w-plan-fields">
                <label>
                  Public business contact
                  <input
                    required
                    minLength={3}
                    maxLength={200}
                    placeholder="Business email, phone or website"
                    value={draft.contact}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, contact: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="w-plan-fields">
                <label>
                  Rental name
                  <input
                    required
                    minLength={3}
                    maxLength={120}
                    value={draft.title}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, title: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Business name
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={draft.businessName}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, businessName: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Category
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, category: e.target.value }))
                    }
                  >
                    {liveCategories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  City
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={draft.city}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, city: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Price per unit per day · TRY
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000000}
                    value={draft.price}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, price: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Units available
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000}
                    value={draft.stock}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, stock: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Guest / item capacity
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000}
                    value={draft.capacity}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        capacity: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Description and included services
                  <textarea
                    required
                    minLength={20}
                    maxLength={2000}
                    value={draft.description}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, description: e.target.value }))
                    }
                  />
                </label>
              </div>
              <button className="w-button w-dark" disabled={busy}>
                Create draft
              </button>
            </form>
            <h3>Your rentals</h3>
            {owned.map((listing) => (
              <article className="wm-owned" key={listing.id}>
                <div>
                  <strong>{listing.title}</strong>
                  <p>
                    {listing.businessName} · {listing.contact} · {listing.city}{" "}
                    · {money(listing.price)} / unit / day · {listing.stock}{" "}
                    units
                  </p>
                  <small>
                    {listing.published ? "Published" : "Draft / archived"}
                  </small>
                </div>
                <button
                  className="w-button w-outline"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      "listing",
                      {
                        id: listing.id,
                        operation: listing.published ? "archive" : "publish",
                      },
                      true,
                    )
                  }
                >
                  {listing.published ? "Archive" : "Publish rental"}
                </button>
              </article>
            ))}
            <h3>Incoming requests</h3>
            {incoming.map((b) => bookingCard(b, true))}
          </section>
        )}
      </div>
      <footer className="w-footer">
        <a className="w-logo" href="/weddings">
          wedtopia.
        </a>
        <p>Borrow the details. Keep the memories.</p>
      </footer>
    </main>
  );
}
