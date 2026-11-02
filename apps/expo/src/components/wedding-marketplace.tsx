import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { LiveBooking, LiveRental } from "@acme/api/weddings/marketplace";
import { initialPlan, money } from "@acme/api/weddings/domain";
import { bookingLabels } from "@acme/api/weddings/marketplace";

export default function WeddingMarketplace({
  api,
}: {
  api: <T>(path: string, body?: unknown) => Promise<T>;
}) {
  const [day, setDay] = useState(initialPlan.date);
  const [city, setCity] = useState("");
  const [listings, setListings] = useState<LiveRental[]>([]);
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [selected, setSelected] = useState<LiveRental | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [service, setService] = useState<{
    ready: boolean;
    message: string;
  } | null>(null);
  const key = useRef("");
  async function checkService() {
    try {
      setService(await api<{ ready: boolean; message: string }>("readiness"));
    } catch (error) {
      setService({ ready: false, message: (error as Error).message });
    }
  }
  useEffect(() => {
    void checkService();
  }, []);
  async function search() {
    if (busy) return;
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
    } finally {
      setBusy(false);
    }
  }
  async function history() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await api<{ bookings: LiveBooking[] }>("bookings");
      setBookings(result.bookings);
      if (!result.bookings.length)
        setStatus("You have no rental requests yet.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function request() {
    if (!selected || busy) return;
    setBusy(true);
    setStatus("");
    // Correlation key only: no authentication or authorization relies on this value.
    key.current ||= "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      (c) => {
        const r = Math.floor(Math.random() * 16);
        return (c === "x" ? r : (r & 3) | 8).toString(16);
      },
    );
    try {
      await api("reservation", {
        listingId: selected.id,
        day,
        quantity: Number(quantity),
        note,
        idempotencyKey: key.current,
      });
      const result = await api<{ bookings: LiveBooking[] }>("bookings");
      setBookings(result.bookings);
      setSelected(null);
      setStatus(
        "Request sent. Stock is held only after supplier confirmation. No payment was collected.",
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api("booking-decision", { id, decision: "cancelled" });
      const result = await api<{ bookings: LiveBooking[] }>("bookings");
      setBookings(result.bookings);
      setStatus("Pending request cancelled.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function button(title: string, onPress: () => void, disabled = false) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={busy || disabled}
        style={[s.button, (busy || disabled) && { opacity: 0.5 }]}
        onPress={onPress}
      >
        <Text style={s.buttonText}>{title}</Text>
      </Pressable>
    );
  }
  return (
    <View>
      <Text style={s.heading}>Real connections.</Text>
      {service && !service.ready && (
        <View>
          <Text style={s.status} accessibilityLiveRegion="polite">
            {service.message}
          </Text>
          {button("Try live service again", () => void checkService())}
          <Text style={s.text}>
            You can keep planning with the inspiration collection while live
            rentals are unavailable.
          </Text>
        </View>
      )}
      <Text style={s.text}>
        Browse supplier-published rentals. Listings are supplier-entered and not
        independently verified. Sign in from My wedding to send requests.
      </Text>
      <Text style={s.label}>Wedding date · YYYY-MM-DD</Text>
      <TextInput
        style={s.input}
        accessibilityLabel="Rental date"
        value={day}
        maxLength={10}
        onChangeText={(v) => {
          setDay(v);
          key.current = "";
          setListings([]);
          setLoaded(false);
          setSelected(null);
        }}
      />
      <Text style={s.label}>City · leave blank for all cities</Text>
      <TextInput
        style={s.input}
        accessibilityLabel="Rental city"
        value={city}
        maxLength={100}
        onChangeText={setCity}
      />
      {button(busy ? "Working…" : "Find supplier rentals", () => void search())}
      {!!status && (
        <Text style={s.status} accessibilityLiveRegion="polite">
          {status}
        </Text>
      )}
      {loaded && !listings.length && (
        <Text style={s.text}>
          No published rentals match yet. Try another city.
        </Text>
      )}
      {listings.map((listing) => (
        <View style={s.card} key={listing.id}>
          <Text style={s.label}>
            {listing.category} · {listing.city}
          </Text>
          <Text style={s.name}>{listing.title}</Text>
          <Text style={s.text}>
            {listing.businessName} · {listing.contact}
          </Text>
          <Text style={s.text}>{listing.description}</Text>
          <Text style={s.text}>
            {listing.available} of {listing.stock} units available for {day}
          </Text>
          <Text style={s.price}>{money(listing.price)} / unit / day</Text>
          {button(
            "Request this date",
            () => {
              setSelected(listing);
              setQuantity("1");
              setNote("");
              key.current = "";
            },
            !listing.available,
          )}
        </View>
      ))}
      {selected && (
        <View style={s.card}>
          <Text style={s.name}>{selected.title}</Text>
          <Text style={s.text}>
            A single rental day on {day}. Availability can change before
            confirmation.
          </Text>
          <Text style={s.label}>Quantity</Text>
          <TextInput
            accessibilityLabel="Requested rental quantity"
            style={s.input}
            value={quantity}
            keyboardType="number-pad"
            onChangeText={(v) => {
              setQuantity(v);
              key.current = "";
            }}
          />
          <Text style={s.label}>A note for your supplier</Text>
          <TextInput
            accessibilityLabel="Supplier note"
            style={[s.input, { minHeight: 90 }]}
            multiline
            value={note}
            maxLength={1000}
            onChangeText={(v) => {
              setNote(v);
              key.current = "";
            }}
          />
          <Text style={s.price}>
            {money(selected.price * (Number(quantity) || 0))} estimated total
          </Text>
          {button("Send request", () => void request())}
          {button("Keep browsing", () => setSelected(null))}
        </View>
      )}
      <Text style={s.heading}>Your rental requests</Text>
      {button("Refresh my requests", () => void history())}
      {bookings.map((booking) => (
        <View style={s.card} key={booking.id}>
          <Text style={s.label}>{bookingLabels[booking.status]}</Text>
          <Text style={s.name}>{booking.title}</Text>
          <Text style={s.text}>
            {booking.businessName} · {booking.contact} · {booking.day} ·{" "}
            {booking.quantity} units
          </Text>
          <Text style={s.price}>{money(booking.total)}</Text>
          {booking.note && <Text style={s.text}>{booking.note}</Text>}
          {booking.status === "pending" &&
            button("Cancel pending request", () => void cancel(booking.id))}
          {booking.status === "confirmed" && (
            <Text style={s.text}>
              Supplier-confirmed. Arrange payment, fulfillment and cancellation
              terms directly with the supplier.
            </Text>
          )}
        </View>
      ))}
      <Text style={s.text}>
        Publish and manage supplier listings in the web app’s Supplier studio.
        This app does not collect payments.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  heading: { fontSize: 29, color: "#304638", marginVertical: 18 },
  text: { color: "#7c876f", fontSize: 12, lineHeight: 21, marginVertical: 7 },
  label: { color: "#7c876f", fontSize: 10, marginTop: 12, marginBottom: 5 },
  input: {
    color: "#304638",
    padding: 13,
    borderWidth: 1,
    borderColor: "#dce2d1",
    borderRadius: 5,
    backgroundColor: "#fffdf8",
  },
  button: {
    backgroundColor: "#304638",
    padding: 14,
    borderRadius: 5,
    marginVertical: 8,
  },
  buttonText: { color: "white", fontSize: 12 },
  card: {
    backgroundColor: "#fffdf8",
    padding: 18,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#dce2d1",
    marginVertical: 12,
  },
  name: { color: "#304638", fontSize: 23, marginVertical: 10 },
  price: { color: "#304638", fontSize: 15, marginVertical: 10 },
  status: {
    color: "#304638",
    backgroundColor: "#eaf0df",
    padding: 15,
    borderRadius: 5,
    fontSize: 12,
    lineHeight: 21,
  },
});
