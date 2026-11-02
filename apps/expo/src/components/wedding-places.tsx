import { useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { PlaceResult } from "../../../../packages/api/src/weddings/saved-plans";
import { safePlaceUrl } from "../../../../packages/api/src/weddings/domain";

export default function WeddingPlaces({
  api,
  city,
}: {
  api: <T>(path: string, body?: unknown) => Promise<T>;
  city: string;
}) {
  const [query, setQuery] = useState(`Wedding venues in ${city}`);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function search() {
    if (busy || query.trim().length < 2) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await api<{ places?: PlaceResult[] }>("places", { query });
      setPlaces(result.places ?? []);
      if (!result.places?.length)
        setStatus("No places found. Try another city or description.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={s.heading}>Somewhere special.</Text>
      <Text style={s.text}>
        Search real places with Google Maps. Results are inspiration, not rental
        inventory. Sign in to use live search.
      </Text>
      <TextInput
        accessibilityLabel="Search Google Maps"
        style={s.input}
        placeholder="Wedding venues in Istanbul"
        placeholderTextColor="#8b9582"
        maxLength={200}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        onSubmitEditing={() => void search()}
      />
      <Pressable
        accessibilityRole="button"
        disabled={busy || query.trim().length < 2}
        style={s.button}
        onPress={() => void search()}
      >
        <Text style={s.buttonText}>
          {busy ? "Finding places…" : "Search places"}
        </Text>
      </Pressable>
      {!!status && (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {status}
        </Text>
      )}
      {places.map((place) => {
        const link = safePlaceUrl(place.googleMapsUri);
        return (
          <View key={place.id} style={s.card}>
            <Text style={s.name}>{place.displayName?.text}</Text>
            <Text style={s.text}>{place.formattedAddress}</Text>
            {link && (
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(link).catch(() =>
                    setStatus("Could not open Google Maps."),
                  )
                }
              >
                <Text style={s.link}>View on Google Maps ↗</Text>
              </Pressable>
            )}
            {place.attributions?.map((a, i) => (
              <Text style={s.text} key={i}>
                {a.provider}
              </Text>
            ))}
          </View>
        );
      })}
      <Text style={s.text}>Place search powered by Google Maps.</Text>
    </View>
  );
}
const s = StyleSheet.create({
  heading: { fontSize: 31, color: "#304638", marginBottom: 15 },
  text: { color: "#7c876f", fontSize: 12, lineHeight: 21, marginVertical: 7 },
  input: {
    color: "#304638",
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#dce2d1",
    padding: 13,
    borderRadius: 5,
    marginVertical: 15,
  },
  button: {
    backgroundColor: "#304638",
    borderRadius: 5,
    padding: 15,
    marginBottom: 15,
  },
  buttonText: { color: "white", fontSize: 12 },
  card: {
    borderWidth: 1,
    borderColor: "#dce2d1",
    borderRadius: 6,
    padding: 16,
    marginVertical: 10,
  },
  name: { fontSize: 20, color: "#304638" },
  link: {
    color: "#304638",
    fontSize: 12,
    paddingVertical: 10,
    textDecorationLine: "underline",
  },
});
