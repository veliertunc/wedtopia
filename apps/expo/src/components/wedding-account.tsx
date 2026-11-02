import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { WeddingPlan } from "../../../../packages/api/src/weddings/domain";
import type {
  AvailabilityRequest,
  SavedPlan,
} from "../../../../packages/api/src/weddings/saved-plans";
import {
  money,
  readWeddingPlan,
} from "../../../../packages/api/src/weddings/domain";

export default function WeddingAccount({
  api,
  onOpen,
}: {
  api: <T>(path: string, body?: unknown) => Promise<T>;
  onOpen: (plan: WeddingPlan, id: string) => void;
}) {
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  async function load() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const [saved, history] = await Promise.all([
        api<{ plans: SavedPlan[] }>("plans"),
        api<{ requests: AvailabilityRequest[] }>("requests"),
      ]);
      setPlans(saved.plans);
      setRequests(history.requests);
      setLoaded(true);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.section}>
      <Text style={s.title}>Your saved celebrations</Text>
      <Text style={s.text}>
        Opening an account plan replaces the draft on this device. Sign in first
        to see your account.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={s.button}
        onPress={() => void load()}
      >
        <Text style={s.buttonText}>
          {busy ? "Opening…" : "Open account plans"}
        </Text>
      </Pressable>
      {!!status && (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {status}
        </Text>
      )}
      {loaded && !plans.length && (
        <Text style={s.text}>No saved plans yet.</Text>
      )}
      {plans.map((saved) => (
        <View key={saved.id} style={s.item}>
          <Text style={s.name}>{saved.data.names}</Text>
          <Text style={s.text}>
            {saved.data.city} · {saved.data.date}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={() => {
              const plan = readWeddingPlan(saved.data);
              if (plan) {
                onOpen(plan, saved.id);
                setStatus(
                  "Plan opened. Your next save will update this celebration.",
                );
              } else
                setStatus(
                  "This plan contains outdated or invalid rental data.",
                );
            }}
          >
            <Text style={s.buttonText}>Continue this wedding</Text>
          </Pressable>
        </View>
      ))}
      {loaded && (
        <>
          <Text style={s.title}>Availability requests</Text>
          {!requests.length && <Text style={s.text}>No requests yet.</Text>}
          {requests.map((request) => (
            <View style={s.item} key={request.id}>
              <Text style={s.name}>{request.plan.names}</Text>
              <Text style={s.text}>
                {request.plan.date} · {money(request.total)}
              </Text>
              <Text style={s.text}>
                {request.status === "pending_supplier_confirmation"
                  ? "Awaiting supplier confirmation"
                  : request.status}
              </Text>
            </View>
          ))}
          <Text style={s.text}>
            Sample requests are not confirmed reservations.
          </Text>
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  section: {
    marginTop: 30,
    borderTopWidth: 1,
    borderColor: "#dce2d1",
    paddingTop: 20,
  },
  title: { color: "#304638", fontSize: 21, marginVertical: 12 },
  text: { color: "#7c876f", fontSize: 12, lineHeight: 21, marginVertical: 5 },
  name: { color: "#304638", fontSize: 15 },
  item: { borderBottomWidth: 1, borderColor: "#dce2d1", paddingVertical: 14 },
  button: {
    borderRadius: 5,
    backgroundColor: "#eaf0df",
    padding: 13,
    marginVertical: 8,
  },
  buttonText: { color: "#304638", fontSize: 12 },
});
