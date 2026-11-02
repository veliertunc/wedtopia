"use client";

import { useEffect, useRef, useState } from "react";

import type {
  Category,
  Rental,
  WeddingPlan,
} from "../../../../../packages/api/src/weddings/domain";
import {
  categories,
  initialPlan,
  installments,
  mapsLink,
  money,
  photo,
  readWeddingPlan,
  rentals,
  safePlaceUrl,
  suggestBundle,
  totalFor,
  uberLink,
} from "../../../../../packages/api/src/weddings/domain";
import AccountPanel from "./account-panel";

import "./weddings.css";

interface Message {
  role: "user" | "assistant";
  text: string;
  model?: string;
}
interface Place {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  attributions?: { provider?: string; providerUri?: string }[];
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/weddings/${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data;
}
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    ),
    pin: (
      <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM21 2v4m-2-2h4" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M2 21v-3a7 7 0 0 1 14 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    bag: (
      <>
        <rect x="4" y="7" width="16" height="14" rx="2" />
        <path d="M8 7V5a4 4 0 0 1 8 0v2" />
      </>
    ),
    flower: (
      <>
        <path d="M12 9c-8-11-14 2-4 4-8 8 4 14 6 4 10 4 12-9 2-8 4-9-9-12-7-2" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
    car: (
      <>
        <path d="m5 6-3 7v6h3v-3h14v3h3v-6l-3-7H5ZM2 12h20M6 6l1-3h10l1 3" />
        <path d="M6 13v1m12-1v1" />
      </>
    ),
    dress: <path d="m8 3 4 3 4-3 1 6-3 3 6 10H4l6-10-3-3 1-6Z" />,
    venue: (
      <>
        <path d="m2 9 10-7 10 7M4 8v13h16V8M9 21v-7h6v7M8 10h1m6 0h1" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.spark}
    </svg>
  );
}
export default function WeddingApp() {
  const [plan, setPlan] = useState<WeddingPlan>(initialPlan);
  const [cloudPlanId, setCloudPlanId] = useState<string>();
  const [ready, setReady] = useState(false);
  const [category, setCategory] = useState<Category>("All rentals");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [dialog, setDialog] = useState<"plan" | "ai" | "map" | null>(null);
  const [detail, setDetail] = useState<Rental | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("auto");
  const [models, setModels] = useState<
    { id: string; provider: string; model: string }[]
  >([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "A beautiful day starts with an idea. Tell me about your celebration — the atmosphere, the people, and the little things you love. Connect a configured model to start planning together.",
    },
  ]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeQuery, setPlaceQuery] = useState("Wedding venues in Istanbul");
  const requestKey = useRef("");
  const modalRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      const stored = readWeddingPlan(
        JSON.parse(localStorage.getItem("wedtopia.plan.v1") ?? "null"),
      );
      if (stored) setPlan(stored);
      const saved = JSON.parse(
        localStorage.getItem("wedtopia.favorites.v1") ?? "[]",
      ) as unknown;
      if (Array.isArray(saved))
        setFavorites(
          saved.filter((id): id is string => typeof id === "string"),
        );
    } catch {
      /* An unavailable or corrupted local store starts with a fresh plan. */
    }
    setReady(true);
    void api<{ models: typeof models }>("models")
      .then((data) => setModels(data.models))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("wedtopia.plan.v1", JSON.stringify(plan));
        requestKey.current = "";
      } catch {
        setNotice(
          "Device storage is unavailable. Export your plan to keep it.",
        );
      }
  }, [plan, ready]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          "wedtopia.favorites.v1",
          JSON.stringify(favorites),
        );
      } catch {
        /* The session remains usable without storage. */
      }
  }, [favorites, ready]);
  useEffect(() => {
    const modal = modalRef.current;
    if (dialog || detail) {
      if (!modal?.open) modal?.showModal();
    } else modal?.close();
  }, [dialog, detail]);
  useEffect(() => {
    if (notice) {
      const timeout = setTimeout(() => setNotice(""), 10000);
      return () => clearTimeout(timeout);
    }
  }, [notice]);
  const update = <K extends keyof WeddingPlan>(key: K, value: WeddingPlan[K]) =>
    setPlan((p) => ({ ...p, [key]: value }));
  const total = totalFor(plan.rentalIds);
  const selected = rentals.filter((r) => plan.rentalIds.includes(r.id));
  const shown = rentals
    .filter(
      (r) =>
        (category === "All rentals" || r.category === category) &&
        (!onlyFavorites || favorites.includes(r.id)) &&
        `${r.name} ${r.city} ${r.area} ${r.category}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "price"
        ? a.price - b.price
        : sort === "capacity"
          ? b.capacity - a.capacity
          : 0,
    );
  function toggleRental(r: Rental) {
    if (
      !plan.rentalIds.includes(r.id) &&
      (r.city !== plan.city ||
        (r.category === "Venues" && r.capacity < plan.guests))
    ) {
      setNotice(
        "This rental does not match your city or guest count. Update your wedding preferences first.",
      );
      return;
    }
    update(
      "rentalIds",
      plan.rentalIds.includes(r.id)
        ? plan.rentalIds.filter((id) => id !== r.id)
        : [...plan.rentalIds, r.id],
    );
  }
  function autoBundle() {
    const bundle = suggestBundle(plan);
    update(
      "rentalIds",
      bundle.map((r) => r.id),
    );
    setDialog("plan");
    setNotice(
      bundle.length
        ? "A sample bundle matched to your city, guests and budget. Review each rental before requesting."
        : "No matching bundle was found. Try a higher budget or a smaller guest count.",
    );
  }
  async function send(message = input) {
    if (!message.trim() || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: message }]);
    try {
      const answer = await api<{ text: string; model: string }>("ai", {
        message,
        plan,
        model,
        history: messages.slice(-10).map(({ role, text }) => ({ role, text })),
      });
      setMessages((m) => [...m, { role: "assistant", ...answer }]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: (error as Error).message },
      ]);
    } finally {
      setBusy(false);
    }
  }
  async function saveCloud() {
    setBusy(true);
    try {
      const result = await api<{ plan: { id: string } }>("plans", {
        ...plan,
        id: cloudPlanId,
      });
      setCloudPlanId(result.plan.id);
      setNotice("Your wedding plan is saved to your account.");
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function requestRentals() {
    setBusy(true);
    try {
      requestKey.current ||= crypto.randomUUID();
      const data = await api<{ request: { id: string } }>("requests", {
        plan,
        idempotencyKey: requestKey.current,
      });
      setNotice(
        `Sample request ${data.request.id.slice(0, 8)} received. Awaiting supplier confirmation. No payment was taken.`,
      );
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportPlan() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...plan,
            total,
            currency: "TRY",
            status: "draft",
            rentals: selected,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "our-wedtopia-plan.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  function close() {
    setDialog(null);
    setDetail(null);
  }
  return (
    <main className="wedtopia">
      <div className="w-announcement">
        A little less planning. A lot more celebrating.{" "}
        <span>Meet your wedding, beautifully together.</span>
        <span aria-hidden="true">✧</span>
      </div>
      <header className="w-header">
        <a className="w-logo" href="/weddings" aria-label="Wedtopia home">
          <span className="w-logo-mark">
            w<span>✧</span>
          </span>
          wedtopia<span className="w-logo-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="/weddings/marketplace">Supplier rentals</a>
          <a href="#discover" className="active">
            Discover rentals
          </a>
          <button onClick={() => setDialog("plan")}>
            My wedding <span className="w-count">{selected.length}</span>
          </button>
          <button
            onClick={() => {
              setOnlyFavorites(!onlyFavorites);
              document
                .getElementById("discover")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            {onlyFavorites ? "All discoveries" : "Saved favorites"}
          </button>
        </nav>
        <button
          className="w-button w-dark w-header-action"
          onClick={() => setDialog("ai")}
        >
          <Icon name="spark" size={16} /> Your wedding, imagined
        </button>
      </header>
      <section className="w-hero">
        <img
          className="w-hero-image"
          src={photo("photo-1519741497674-611481863552", 2200)}
          alt="Wedding bouquet and bridal details in warm garden light"
        />
        <div className="w-hero-shade" />
        <div className="w-hero-copy">
          <span className="w-eyebrow">FOR YOUR ONCE-IN-A-LIFETIME</span>
          <h1>
            A day that’s
            <br />
            entirely <em>yours.</em>
          </h1>
          <p>
            The perfect place. The thoughtful details. The way you feel.
            <br className="w-desktop" /> Bring it all together, without the
            overwhelm.
          </p>
          <a className="w-button w-white" href="#discover">
            Find your something special <Icon name="arrow" size={18} />
          </a>
          <div className="w-hero-note">
            <span className="w-line" /> Beautifully borrowed. Unforgettable
            forever.
          </div>
        </div>
        <div className="w-hero-caption">
          <span>THE WEDTOPIA WAY</span>
          <p>
            One beautiful vision.
            <br />
            Every little detail.
          </p>
          <span className="w-caption-flower">✳</span>
        </div>
      </section>
      <section className="w-search-wrap" aria-label="Wedding preferences">
        <form
          className="w-search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(plan.city);
            document
              .getElementById("discover")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <label>
            <Icon name="pin" />
            <span>
              <small>WHERE’S THE CELEBRATION?</small>
              <select
                value={plan.city}
                onChange={(e) => update("city", e.target.value)}
              >
                <option>Istanbul</option>
                <option>Izmir</option>
              </select>
            </span>
          </label>
          <label>
            <Icon name="calendar" />
            <span>
              <small>YOUR SPECIAL DATE</small>
              <input
                aria-label="Wedding date"
                type="date"
                value={plan.date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => update("date", e.target.value)}
                required
              />
            </span>
          </label>
          <label>
            <Icon name="users" />
            <span>
              <small>YOUR FAVORITE PEOPLE</small>
              <input
                aria-label="Number of guests"
                type="number"
                min="2"
                max="2000"
                value={plan.guests}
                onChange={(e) => update("guests", Number(e.target.value))}
                required
              />
            </span>
          </label>
          <button className="w-button w-dark" type="submit">
            <Icon name="search" size={18} /> Let’s find it
          </button>
        </form>
      </section>
      <section className="w-values">
        <span>
          <Icon name="check" size={16} /> Every detail in one place
        </span>
        <span>
          <Icon name="heart" size={16} /> More meaning, less excess
        </span>
        <span>
          <Icon name="bag" size={16} /> A plan that fits your budget
        </span>
        <span className="w-demo-label">A curated sample collection</span>
      </section>
      <section className="w-discover" id="discover">
        <a className="w-link" href="/weddings/marketplace">
          Browse supplier rentals and availability →
        </a>
        <div className="w-section-head">
          <div>
            <span className="w-eyebrow w-green">
              THE PIECES OF YOUR PERFECT DAY
            </span>
            <h2>
              Fall in love with the <em>possibilities.</em>
            </h2>
            <p>
              From the first “wow” to the last dance. Find what feels like you.
            </p>
          </div>
          <button className="w-link" onClick={() => setDialog("map")}>
            <Icon name="pin" size={17} /> Explore on Google Maps{" "}
            <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="w-categories" role="group" aria-label="Rental category">
          {categories.map((c, i) => (
            <button
              key={c}
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              <Icon
                name={
                  ["spark", "venue", "car", "bag", "flower", "dress", "users"][
                    i
                  ]!
                }
                size={19}
              />
              {c}
            </button>
          ))}
        </div>
        <div className="w-results-bar">
          <span>
            {onlyFavorites
              ? "Your saved favorites"
              : category === "All rentals"
                ? "A few things we think you’ll love"
                : `Discover ${category.toLowerCase()}`}{" "}
            <small>({shown.length})</small>
          </span>
          <div>
            <label className="w-filter-search">
              <Icon name="search" size={16} />
              <input
                aria-label="Search rentals"
                placeholder="Find a little magic…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Sort rentals"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recommended">Recommended</option>
              <option value="price">Price: low to high</option>
              <option value="capacity">Guest capacity</option>
            </select>
          </div>
        </div>
        <div className="w-grid">
          {shown.map((r, index) => (
            <article className="w-card" key={r.id}>
              <div className="w-card-visual">
                <button
                  className="w-image-button"
                  aria-label={`View ${r.name}`}
                  onClick={() => setDetail(r)}
                >
                  <img
                    src={photo(r.image, 800)}
                    alt={r.name}
                    loading={index > 2 ? "lazy" : "eager"}
                  />
                </button>
                <span className="w-card-tag">{r.tag}</span>
                <button
                  className={`w-favorite ${favorites.includes(r.id) ? "saved" : ""}`}
                  aria-label={`${favorites.includes(r.id) ? "Unsave" : "Save"} ${r.name}`}
                  aria-pressed={favorites.includes(r.id)}
                  onClick={() =>
                    setFavorites((ids) =>
                      ids.includes(r.id)
                        ? ids.filter((id) => id !== r.id)
                        : [...ids, r.id],
                    )
                  }
                >
                  <Icon name="heart" size={18} />
                </button>
              </div>
              <div className="w-card-topline">
                <span>{r.category}</span>
                <span>
                  <Icon name="pin" size={12} /> {r.area}, {r.city}
                </span>
              </div>
              <button className="w-card-title" onClick={() => setDetail(r)}>
                {r.name}
              </button>
              <p>
                {r.category === "Venues"
                  ? `Room for ${r.capacity} of your favorite people`
                  : r.description.split(".")[0]}
              </p>
              <div className="w-card-bottom">
                <span>
                  <strong>{money(r.price)}</strong>
                  <small> / day</small>
                </span>
                <button
                  aria-label={`${plan.rentalIds.includes(r.id) ? "Remove" : "Add"} ${r.name} ${plan.rentalIds.includes(r.id) ? "from" : "to"} wedding plan`}
                  className={plan.rentalIds.includes(r.id) ? "added" : ""}
                  onClick={() => toggleRental(r)}
                >
                  {plan.rentalIds.includes(r.id) ? (
                    <Icon name="check" size={17} />
                  ) : (
                    "+"
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
        {!shown.length && (
          <div className="w-empty">
            <Icon name="flower" size={36} />
            <h3>A little more room to discover</h3>
            <p>
              Try another category or save a few favorites to make this space
              yours.
            </p>
            <button
              className="w-button w-dark"
              onClick={() => {
                setCategory("All rentals");
                setOnlyFavorites(false);
                setSearch("");
              }}
            >
              See the collection
            </button>
          </div>
        )}
      </section>
      <section className="w-ideas">
        <div className="w-ideas-art">
          <img
            src={photo("photo-1519225421980-715cb0215aed", 900)}
            alt="Wedding flowers and thoughtful table details"
            loading="lazy"
          />
          <span className="w-art-note">
            a little inspiration
            <br />
            <em>a lot of you.</em>
          </span>
        </div>
        <div className="w-ideas-copy">
          <span className="w-eyebrow w-green">
            <Icon name="spark" size={16} /> YOUR PERSONAL WEDDING MUSE
          </span>
          <h2>
            Your ideas.
            <br />
            <em>Beautifully brought together.</em>
          </h2>
          <p>
            A garden party under the stars? A timeless city celebration? Tell
            our wedding assistant what you love, and find the places and details
            that belong together.
          </p>
          <div className="w-idea-pills">
            <span>Thoughtful rental pairings</span>
            <span>Made for your budget</span>
            <span>Inspired by you</span>
          </div>
          <button className="w-button w-dark" onClick={() => setDialog("ai")}>
            Let’s dream it up <Icon name="spark" size={17} />
          </button>
          <button className="w-link" onClick={autoBundle}>
            Or build a sample bundle <Icon name="arrow" size={15} />
          </button>
        </div>
      </section>
      <section className="w-closing">
        <span>LESS TO OWN. MORE TO REMEMBER.</span>
        <h2>
          Borrow the details.
          <br />
          <em>Keep the memories.</em>
        </h2>
        <p>A celebration that feels good, in every sense.</p>
        <button
          className="w-button w-outline"
          onClick={() => setDialog("plan")}
        >
          Make it yours <Icon name="arrow" size={17} />
        </button>
      </section>
      <footer className="w-footer">
        <a className="w-logo" href="/weddings">
          wedtopia<span className="w-logo-dot">.</span>
        </a>
        <p>For the day. For the memories. For you.</p>
        <span>
          Thoughtfully planned, together. © {new Date().getFullYear()}
        </span>
      </footer>
      {selected.length > 0 && (
        <button className="w-floating-plan" onClick={() => setDialog("plan")}>
          <Icon name="bag" size={19} />
          <span>
            Your wedding{" "}
            <small>
              {selected.length} details · {money(total)}
            </small>
          </span>
          <Icon name="arrow" size={18} />
        </button>
      )}
      {notice && (
        <div className="w-notice" role="status">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <dialog
        ref={modalRef}
        className={`w-modal ${dialog === "ai" ? "w-chat-modal" : ""}`}
        onCancel={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <button
          className="w-modal-close"
          aria-label="Close dialog"
          onClick={close}
        >
          <Icon name="close" />
        </button>
        {detail && (
          <>
            <img
              className="w-detail-image"
              src={photo(detail.image)}
              alt={detail.name}
            />
            <span className="w-eyebrow w-green">
              {detail.category} · {detail.city}
            </span>
            <h2>{detail.name}</h2>
            <p>{detail.description}</p>
            <div className="w-detail-price">
              {money(detail.price)} <small>/ day · sample price</small>
            </div>
            <p>
              Supplier confirmation is required for dates, sizing, deposits,
              cancellation terms and availability.
            </p>
            <div className="w-modal-actions">
              <button
                className="w-button w-dark"
                onClick={() => toggleRental(detail)}
              >
                {plan.rentalIds.includes(detail.id)
                  ? "Remove from wedding"
                  : "Add to my wedding"}
              </button>
              <a
                className="w-button w-outline"
                href={mapsLink(detail)}
                target="_blank"
                rel="noreferrer"
              >
                View area on Maps
              </a>
              {detail.category === "Venues" && (
                <a
                  className="w-link"
                  href={uberLink(detail)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit with Uber ↗
                </a>
              )}
            </div>
          </>
        )}
        {dialog === "plan" && (
          <>
            <span className="w-eyebrow w-green">YOUR DAY, TAKING SHAPE</span>
            <h2>
              A little plan.
              <br />
              <em>A beautiful beginning.</em>
            </h2>
            <p>
              Draft saved on this device. Sample prices in TRY; no reservation
              or payment is made here.
            </p>
            <div className="w-plan-fields">
              <label>
                Your celebration
                <input
                  value={plan.names}
                  maxLength={120}
                  onChange={(e) => update("names", e.target.value)}
                />
              </label>
              <label>
                The atmosphere
                <input
                  value={plan.style}
                  maxLength={200}
                  onChange={(e) => update("style", e.target.value)}
                />
              </label>
              <label>
                Total rental budget (TRY)
                <input
                  type="number"
                  min="1000"
                  max="100000000"
                  value={plan.budget}
                  onChange={(e) =>
                    update("budget", Math.max(0, Number(e.target.value)))
                  }
                />
              </label>
              <label>
                Split your estimate
                <select
                  value={plan.months}
                  onChange={(e) => update("months", Number(e.target.value))}
                >
                  {[1, 3, 6, 12].map((m) => (
                    <option key={m} value={m}>
                      {m === 1 ? "Pay in full" : `${m} monthly installments`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="w-plan-items">
              {selected.map((r) => (
                <div key={r.id}>
                  <img src={photo(r.image, 150)} alt="" />
                  <span>
                    {r.name}
                    <small>{r.category}</small>
                  </span>
                  <strong>{money(r.price)}</strong>
                  <button
                    aria-label={`Remove ${r.name}`}
                    onClick={() => toggleRental(r)}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
              {!selected.length && (
                <p>
                  Your story starts with a detail. Add rentals from the
                  collection, or build a matched sample bundle.
                </p>
              )}
            </div>
            <button className="w-link" onClick={autoBundle}>
              <Icon name="spark" size={16} /> Match a bundle to my preferences
            </button>
            <div className="w-budget-track">
              <span
                style={{
                  width: `${Math.min((total / Math.max(plan.budget, 1)) * 100, 100)}%`,
                  background: total > plan.budget ? "#ad4d36" : undefined,
                }}
              />
            </div>
            <div className="w-plan-total">
              <span>
                {money(total)} <small>of {money(plan.budget)} budget</small>
              </span>
              <strong>
                {total > plan.budget
                  ? `${money(total - plan.budget)} over budget`
                  : `${money(plan.budget - total)} to dream with`}
              </strong>
            </div>
            <div className="w-installment">
              <Icon name="calendar" />
              <span>
                {plan.months} payment{plan.months > 1 ? "s" : ""} starting at{" "}
                <strong>
                  {money(installments(total, plan.months)[0] ?? 0)}
                </strong>
                <small>
                  Estimate only, without interest or fees. Financing requires a
                  payment provider and supplier agreement.
                </small>
              </span>
            </div>
            <div className="w-modal-actions">
              <button
                className="w-button w-dark"
                onClick={() => void saveCloud()}
                disabled={busy}
              >
                Save to account
              </button>
              <button className="w-button w-outline" onClick={exportPlan}>
                Export draft
              </button>
              <button
                className="w-button w-outline"
                disabled={busy || !selected.length || total > plan.budget}
                onClick={() => void requestRentals()}
              >
                Request availability
              </button>
            </div>
            <button
              className="w-link"
              disabled={busy}
              onClick={() => {
                setCloudPlanId(undefined);
                setNotice("Your next save will create a separate celebration.");
              }}
            >
              Save next time as a new celebration
            </button>
            <AccountPanel
              onOpen={(saved, id) => {
                setPlan(saved);
                setCloudPlanId(id);
                setNotice("Your account plan is now open on this device.");
              }}
            />
          </>
        )}
        {dialog === "ai" && (
          <>
            <span className="w-eyebrow w-green">
              <Icon name="spark" size={17} /> THE WEDDING MUSE
            </span>
            <h2>
              Let’s make it <em>yours.</em>
            </h2>
            <p>
              A little inspiration, a thoughtful pairing, a fresh perspective.
            </p>
            <label className="w-model-picker">
              Your creative partner
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="auto">
                  Auto · lowest configured cost, least used on ties
                </option>
                {models.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.provider} · {m.model}
                  </option>
                ))}
              </select>
            </label>
            <div className="w-chat" aria-live="polite">
              {messages.map((m, i) => (
                <div className={`w-message ${m.role}`} key={i}>
                  <small>
                    {m.role === "user" ? "YOU" : (m.model ?? "WEDTOPIA")}
                  </small>
                  <p>{m.text}</p>
                </div>
              ))}
              {busy && (
                <p className="w-thinking">Gathering a little inspiration…</p>
              )}
            </div>
            <div className="w-prompts">
              {[
                "A romantic garden wedding within my budget",
                "Pair rentals for our celebration",
                "Ideas for a more sustainable wedding",
              ].map((prompt) => (
                <button
                  disabled={busy}
                  key={prompt}
                  onClick={() => void send(prompt)}
                >
                  {prompt} ↗
                </button>
              ))}
            </div>
            <form
              className="w-chat-input"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                aria-label="Message your wedding assistant"
                placeholder="Tell me what your dream day feels like…"
                value={input}
                maxLength={4000}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
              />
              <button
                className="w-button w-dark"
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send message"
              >
                <Icon name="arrow" />
              </button>
            </form>
            <small className="w-chat-disclaimer">
              Live models require gateway sign-in and provider configuration.
              Advice does not confirm prices or availability.
            </small>
          </>
        )}
        {dialog === "map" && (
          <>
            <span className="w-eyebrow w-green">FIND YOUR PLACE</span>
            <h2>
              Somewhere <em>special.</em>
            </h2>
            <p>
              Search real places with Google Maps. Search results are
              inspiration, not rental inventory.
            </p>
            <form
              className="w-map-search"
              onSubmit={(e) => {
                e.preventDefault();
                setBusy(true);
                void api<{ places?: Place[] }>("places", { query: placeQuery })
                  .then((result) => {
                    setPlaces(result.places ?? []);
                    if (!result.places?.length)
                      setNotice("No places found. Try another search.");
                  })
                  .catch((error) => setNotice((error as Error).message))
                  .finally(() => setBusy(false));
              }}
            >
              <input
                aria-label="Search Google Maps"
                value={placeQuery}
                maxLength={200}
                onChange={(e) => setPlaceQuery(e.target.value)}
                required
              />
              <button className="w-button w-dark" disabled={busy}>
                Search
              </button>
            </form>
            <div className="w-map-results">
              {places.map((p) => (
                <article key={p.id}>
                  <h3>{p.displayName?.text}</h3>
                  <p>{p.formattedAddress}</p>
                  {safePlaceUrl(p.googleMapsUri) && (
                    <a href={p.googleMapsUri} target="_blank" rel="noreferrer">
                      View on Google Maps ↗
                    </a>
                  )}
                  {p.attributions?.map((a, i) => (
                    <small key={i}>{a.provider}</small>
                  ))}
                </article>
              ))}
            </div>
            <h3>Explore the sample venue areas</h3>
            <div className="w-map-results">
              {rentals
                .filter((r) => r.category === "Venues")
                .map((r) => (
                  <article key={r.id}>
                    <h3>{r.name}</h3>
                    <p>
                      {r.area}, {r.city}
                    </p>
                    <a href={mapsLink(r)} target="_blank" rel="noreferrer">
                      View area on Google Maps ↗
                    </a>
                  </article>
                ))}
            </div>
            <small>
              Place search powered by Google Maps. Sample rental coordinates
              indicate general areas.
            </small>
          </>
        )}
      </dialog>
    </main>
  );
}
