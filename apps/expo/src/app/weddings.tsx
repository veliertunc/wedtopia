import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";

import type { Category, WeddingPlan } from "@acme/api/weddings/domain";
import {
  categories,
  initialPlan,
  installments,
  mapsLink,
  money,
  photo,
  readWeddingPlan,
  rentals,
  suggestBundle,
  totalFor,
  uberLink,
} from "@acme/api/weddings/domain";

import WeddingAccount from "../components/wedding-account";
import WeddingMarketplace from "../components/wedding-marketplace";
import WeddingPlaces from "../components/wedding-places";

const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
const gatewayUrl =
  process.env.EXPO_PUBLIC_WEDDINGS_GATEWAY_URL ?? `http://${host}:3001`;
const weddingAuth = createAuthClient({
  baseURL: gatewayUrl,
  plugins: [
    expoClient({
      scheme: "expo",
      storagePrefix: "wedtopia",
      storage: SecureStore,
    }),
  ],
});
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${gatewayUrl}/api/weddings/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: weddingAuth.getCookie(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = (await response.json()) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok)
    throw new Error(result.error ?? result.message ?? "Please try again.");
  return result;
}
export default function WeddingsScreen() {
  const [plan, setPlan] = useState<WeddingPlan>(initialPlan);
  const [cloudPlanId, setCloudPlanId] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("Discover");
  const [category, setCategory] = useState<Category>("All rentals");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const requestKey = useRef("");
  const [models, setModels] = useState<{ id: string; model: string }[]>([]);
  const [model, setModel] = useState("auto");
  const [chat, setChat] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  useEffect(() => {
    const read = Promise.resolve().then(() =>
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem("wedtopia-mobile")
        : SecureStore.getItemAsync("wedtopia-mobile"),
    );
    void read
      .then((raw) => {
        if (raw) {
          const value = readWeddingPlan(JSON.parse(raw));
          if (value) setPlan(value);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    void api<{ models: typeof models }>("models")
      .then((result) => setModels(result.models))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (loaded) {
      if (Platform.OS === "web") {
        try {
          globalThis.localStorage?.setItem(
            "wedtopia-mobile",
            JSON.stringify(plan),
          );
        } catch {
          setStatus("Device storage is unavailable.");
        }
      } else
        void SecureStore.setItemAsync(
          "wedtopia-mobile",
          JSON.stringify(plan),
        ).catch(() =>
          setStatus("Device storage is unavailable. Save to your account."),
        );
    }
  }, [plan, loaded]);
  const update = <K extends keyof WeddingPlan>(key: K, value: WeddingPlan[K]) =>
    setPlan((p) => ({ ...p, [key]: value }));
  const selected = rentals.filter((r) => plan.rentalIds.includes(r.id));
  const total = totalFor(plan.rentalIds);
  useEffect(() => {
    requestKey.current = "";
  }, [plan]);
  async function requestAvailability() {
    if (busy || !selected.length) return;
    setBusy(true);
    requestKey.current ||= "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      (c) => {
        const r = Math.floor(Math.random() * 16);
        return (c === "x" ? r : (r & 3) | 8).toString(16);
      },
    );
    try {
      const result = await api<{ request: { id: string } }>("requests", {
        plan,
        idempotencyKey: requestKey.current,
      });
      setStatus(
        `Sample request ${result.request.id.slice(0, 8)} received. Awaiting supplier confirmation. No payment was taken.`,
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!message.trim() || busy) return;
    const text = message;
    setMessage("");
    setBusy(true);
    setChat((c) => [...c, { role: "user", text }]);
    try {
      const answer = await api<{ text: string; model: string }>("ai", {
        message: text,
        plan,
        model,
        history: chat.slice(-10),
      });
      setChat((c) => [
        ...c,
        { role: "assistant", text: `${answer.text}\n\n— ${answer.model}` },
      ]);
    } catch (error) {
      setChat((c) => [
        ...c,
        { role: "assistant", text: (error as Error).message },
      ]);
    } finally {
      setBusy(false);
    }
  }
  function add(id: string) {
    const rental = rentals.find((r) => r.id === id)!;
    if (
      !plan.rentalIds.includes(id) &&
      (rental.city !== plan.city ||
        (rental.category === "Venues" && rental.capacity < plan.guests))
    ) {
      Alert.alert(
        "Check your preferences",
        "Choose a rental in your city with enough space for your guests.",
      );
      return;
    }
    update(
      "rentalIds",
      plan.rentalIds.includes(id)
        ? plan.rentalIds.filter((x) => x !== id)
        : [...plan.rentalIds, id],
    );
  }
  const Button = ({
    title,
    onPress,
    quiet = false,
  }: {
    title: string;
    onPress: () => void;
    quiet?: boolean;
  }) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={[s.button, quiet && s.quiet]}
    >
      <Text style={[s.buttonText, quiet && { color: "#304638" }]}>{title}</Text>
    </Pressable>
  );
  return (
    <View style={s.root}>
      <Stack.Screen
        options={{
          title: "Wedtopia",
          headerStyle: { backgroundColor: "#fcfaf6" },
          headerTintColor: "#304638",
        }}
      />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <Text style={s.logo}>wedtopia.</Text>
          <Text style={s.small}>YOUR DAY, BEAUTIFULLY TOGETHER</Text>
        </View>
        <View style={s.tabs}>
          {["Discover", "My wedding", "Places", "Wedding muse"].map((t) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              onPress={() => setTab(t)}
              style={[s.tab, tab === t && s.activeTab]}
            >
              <Text
                style={{ color: tab === t ? "white" : "#65755b", fontSize: 12 }}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
        {!!status && (
          <Pressable
            onPress={() => setStatus("")}
            accessibilityLabel="Dismiss status"
          >
            <Text style={s.status}>{status}</Text>
          </Pressable>
        )}
        {tab === "Discover" && (
          <>
            <Button
              title="Browse supplier rentals"
              onPress={() => setTab("Live rentals")}
            />
            <View style={s.hero}>
              <Image
                source={{ uri: photo("photo-1519741497674-611481863552", 900) }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={s.shade} />
              <View style={s.heroCopy}>
                <Text style={s.eyebrow}>FOR YOUR ONCE-IN-A-LIFETIME</Text>
                <Text style={s.heroTitle}>
                  A day that’s{"\n"}entirely yours.
                </Text>
                <Text style={s.heroText}>
                  Beautifully borrowed. Unforgettable forever.
                </Text>
              </View>
            </View>
            <Text style={s.heading}>Fall in love with the possibilities.</Text>
            <Text style={s.body}>
              A curated sample collection. Prices and availability require
              supplier confirmation.
            </Text>
            <TextInput
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search rentals, places, details…"
              placeholderTextColor="#8b9582"
              accessibilityLabel="Search rentals"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: 15 }}
            >
              {categories.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    s.chip,
                    category === c && { backgroundColor: "#e3e9d8" },
                  ]}
                >
                  <Text style={s.chipText}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {rentals
              .filter(
                (r) =>
                  (category === "All rentals" || r.category === category) &&
                  `${r.name} ${r.city} ${r.category}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((r) => (
                <View key={r.id} style={s.card}>
                  <Image
                    source={{ uri: photo(r.image, 800) }}
                    style={s.cardImage}
                    accessibilityLabel={r.name}
                  />
                  <View style={s.cardBody}>
                    <Text style={s.small}>
                      {r.category.toUpperCase()} · {r.area}, {r.city}
                    </Text>
                    <Text style={s.cardTitle}>{r.name}</Text>
                    <Text style={s.body}>{r.description}</Text>
                    <View style={s.row}>
                      <Text style={s.price}>{money(r.price)} / day</Text>
                      <Button
                        title={
                          plan.rentalIds.includes(r.id)
                            ? "Added ✓"
                            : "+ My wedding"
                        }
                        onPress={() => add(r.id)}
                      />
                    </View>
                    <View style={s.row}>
                      <Button
                        title="View area on Maps ↗"
                        quiet
                        onPress={() => void Linking.openURL(mapsLink(r))}
                      />
                      {r.category === "Venues" && (
                        <Button
                          title="Visit with Uber ↗"
                          quiet
                          onPress={() => void Linking.openURL(uberLink(r))}
                        />
                      )}
                    </View>
                  </View>
                </View>
              ))}
          </>
        )}
        {tab === "My wedding" && (
          <>
            <Text style={s.heading}>A beautiful beginning.</Text>
            <Text style={s.body}>
              Your draft is saved on this device. Sign in to the gateway to save
              it to your account.
            </Text>
            <Text style={s.label}>Your celebration</Text>
            <TextInput
              accessibilityLabel="Celebration name"
              style={s.input}
              value={plan.names}
              onChangeText={(v) => update("names", v)}
              maxLength={120}
            />
            <Text style={s.label}>Wedding date · YYYY-MM-DD</Text>
            <TextInput
              accessibilityLabel="Wedding date"
              style={s.input}
              value={plan.date}
              onChangeText={(v) => update("date", v)}
              maxLength={10}
            />
            <Text style={s.label}>City</Text>
            <View style={s.row}>
              {["Istanbul", "Izmir"].map((city) => (
                <Button
                  key={city}
                  quiet={plan.city !== city}
                  title={city}
                  onPress={() => update("city", city)}
                />
              ))}
            </View>
            <Text style={s.label}>Guests</Text>
            <TextInput
              accessibilityLabel="Guest count"
              style={s.input}
              keyboardType="number-pad"
              value={String(plan.guests)}
              onChangeText={(v) => update("guests", Number(v) || 0)}
            />
            <Text style={s.label}>Rental budget · TRY</Text>
            <TextInput
              accessibilityLabel="Rental budget"
              style={s.input}
              keyboardType="number-pad"
              value={String(plan.budget)}
              onChangeText={(v) => update("budget", Number(v) || 0)}
            />
            <Text style={s.label}>Your style</Text>
            <TextInput
              accessibilityLabel="Wedding style"
              style={s.input}
              value={plan.style}
              onChangeText={(v) => update("style", v)}
              maxLength={200}
            />
            <Button
              title="Match a sample bundle ✧"
              onPress={() =>
                update(
                  "rentalIds",
                  suggestBundle(plan).map((r) => r.id),
                )
              }
            />
            {selected.map((r) => (
              <View style={s.planRow} key={r.id}>
                <View style={{ flex: 1 }}>
                  <Text style={s.body}>{r.name}</Text>
                  <Text style={s.small}>{money(r.price)}</Text>
                </View>
                <Button quiet title="Remove" onPress={() => add(r.id)} />
              </View>
            ))}
            <Text style={s.cardTitle}>Estimated total: {money(total)}</Text>
            <Text style={s.body}>
              {total > plan.budget
                ? `${money(total - plan.budget)} over budget`
                : `${money(plan.budget - total)} remaining`}
            </Text>
            <Text style={s.label}>Split your estimate</Text>
            <View style={s.row}>
              {[1, 3, 6, 12].map((months) => (
                <Button
                  key={months}
                  quiet={months !== plan.months}
                  title={`${months} mo`}
                  onPress={() => update("months", months)}
                />
              ))}
            </View>
            <Text style={s.price}>
              {money(installments(total, plan.months)[0] ?? 0)} / installment
            </Text>
            <Text style={s.body}>
              Estimate only. No payment is collected. Financing and supplier
              confirmation are required.
            </Text>
            <Button
              title="Save to account"
              onPress={() => {
                setBusy(true);
                void api<{ plan: { id: string } }>("plans", {
                  ...plan,
                  id: cloudPlanId,
                })
                  .then((result) => {
                    setCloudPlanId(result.plan.id);
                    setStatus("Plan saved to your account.");
                  })
                  .catch((error) => setStatus((error as Error).message))
                  .finally(() => setBusy(false));
              }}
            />
            <Button
              title="Request sample availability"
              onPress={() => void requestAvailability()}
            />
            <Button
              quiet
              title="Save next time as a new celebration"
              onPress={() => {
                setCloudPlanId(undefined);
                setStatus("Your next save will create a separate celebration.");
              }}
            />
            <WeddingAccount
              api={api}
              onOpen={(saved, id) => {
                setPlan(saved);
                setCloudPlanId(id);
              }}
            />
            <Button
              quiet
              title="Sign in to gateway"
              onPress={() => {
                void weddingAuth.signIn
                  .social({ provider: "discord", callbackURL: "/weddings" })
                  .catch((error) => setStatus((error as Error).message));
              }}
            />
          </>
        )}
        {tab === "Live rentals" && (
          <>
            <Button
              title="← Back to inspiration"
              quiet
              onPress={() => setTab("Discover")}
            />
            <WeddingMarketplace api={api} />
          </>
        )}
        {tab === "Places" && <WeddingPlaces api={api} city={plan.city} />}
        {tab === "Wedding muse" && (
          <>
            <Text style={s.heading}>Let’s make it yours.</Text>
            <Text style={s.body}>
              Tell me the atmosphere, the people, and the little things you
              love. Live AI needs a gateway session and configured provider
              keys.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: 15 }}
            >
              {[
                { id: "auto", model: "Auto · cost, then least used" },
                ...models,
              ].map((m) => (
                <Pressable
                  key={m.id}
                  style={[
                    s.chip,
                    m.id === model && { backgroundColor: "#e3e9d8" },
                  ]}
                  onPress={() => setModel(m.id)}
                >
                  <Text style={s.chipText}>{m.model}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {chat.map((m, i) => (
              <View
                key={i}
                style={[s.message, m.role === "user" && s.userMessage]}
              >
                <Text style={[s.body, m.role === "user" && { color: "white" }]}>
                  {m.text}
                </Text>
              </View>
            ))}
            <TextInput
              style={[s.input, { minHeight: 95, textAlignVertical: "top" }]}
              accessibilityLabel="Message the wedding muse"
              placeholder="A romantic garden wedding for 150 guests…"
              placeholderTextColor="#8b9582"
              multiline
              value={message}
              maxLength={4000}
              onChangeText={setMessage}
            />
            <Button
              title={busy ? "Finding inspiration…" : "Send to wedding muse ✧"}
              onPress={() => void send()}
            />
            <Button
              quiet
              title="Sign in to gateway"
              onPress={() => {
                void weddingAuth.signIn
                  .social({ provider: "discord", callbackURL: "/weddings" })
                  .catch((error) => setStatus((error as Error).message));
              }}
            />
          </>
        )}
        {busy && <ActivityIndicator color="#304638" style={{ margin: 20 }} />}
        <Text style={s.foot}>Borrow the details. Keep the memories.</Text>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fcfaf6" },
  content: { padding: 20, paddingBottom: 60 },
  header: { marginBottom: 20 },
  logo: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 37,
    color: "#304638",
    letterSpacing: -1.5,
  },
  small: { fontSize: 9, color: "#7d896f", letterSpacing: 1, marginTop: 5 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#eef0e6",
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 5 },
  activeTab: { backgroundColor: "#304638" },
  hero: { height: 310, borderRadius: 10, overflow: "hidden", marginBottom: 26 },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "#10291b66" },
  heroCopy: { padding: 25, marginTop: 40 },
  eyebrow: { fontSize: 8, letterSpacing: 2, color: "#e8eddc" },
  heroTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 45,
    lineHeight: 49,
    color: "white",
    marginTop: 20,
  },
  heroText: { fontSize: 11, color: "#e8eddc", marginTop: 20 },
  heading: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 32,
    color: "#304638",
    lineHeight: 37,
    marginBottom: 15,
  },
  body: { fontSize: 12, lineHeight: 21, color: "#7c876f", marginBottom: 10 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#dce2d1",
    borderRadius: 5,
    marginRight: 8,
  },
  chipText: { color: "#61744e", fontSize: 11 },
  card: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#e4e7dc",
    marginBottom: 23,
  },
  cardImage: { height: 230, width: "100%" },
  cardBody: { padding: 16 },
  cardTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 25,
    color: "#304638",
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  price: { color: "#304638", fontSize: 15, marginVertical: 10 },
  button: {
    backgroundColor: "#304638",
    paddingVertical: 13,
    paddingHorizontal: 17,
    borderRadius: 5,
    marginVertical: 6,
  },
  quiet: { backgroundColor: "#eaf0df" },
  buttonText: { color: "white", fontSize: 11 },
  input: {
    padding: 13,
    borderWidth: 1,
    borderColor: "#dce2d1",
    borderRadius: 5,
    backgroundColor: "#fffdf8",
    color: "#304638",
    fontSize: 13,
    marginVertical: 5,
  },
  label: { fontSize: 11, color: "#7c876f", marginTop: 17, marginBottom: 5 },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#e2e6d7",
    paddingVertical: 10,
  },
  message: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#eaf0df",
    marginBottom: 13,
    maxWidth: "95%",
  },
  userMessage: { backgroundColor: "#304638", alignSelf: "flex-end" },
  status: {
    color: "#304638",
    backgroundColor: "#eaf0df",
    fontSize: 12,
    lineHeight: 20,
    padding: 15,
    marginBottom: 20,
    borderRadius: 5,
  },
  foot: { textAlign: "center", fontSize: 10, color: "#929a86", marginTop: 30 },
});
