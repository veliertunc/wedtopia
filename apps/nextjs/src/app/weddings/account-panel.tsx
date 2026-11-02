"use client";

import { useState } from "react";

import type { WeddingPlan } from "@acme/api/weddings/domain";
import type {
  AvailabilityRequest,
  SavedPlan,
} from "@acme/api/weddings/saved-plans";
import { money, readWeddingPlan } from "@acme/api/weddings/domain";

import { authClient } from "~/auth/client";

export default function AccountPanel({
  onOpen,
}: {
  onOpen: (plan: WeddingPlan, id: string) => void;
}) {
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { data: session } = authClient.useSession();
  async function load() {
    setBusy(true);
    setStatus("");
    try {
      const results = await Promise.all([
        fetch("/api/weddings/plans"),
        fetch("/api/weddings/requests"),
      ]);
      const [saved, history] = (await Promise.all(
        results.map((r) => r.json()),
      )) as [
        { plans?: SavedPlan[]; error?: string },
        { requests?: AvailabilityRequest[]; error?: string },
      ];
      if (!results[0]!.ok)
        throw new Error(saved.error ?? "Could not load your plans.");
      if (!results[1]!.ok)
        throw new Error(history.error ?? "Could not load your requests.");
      setPlans(saved.plans ?? []);
      setRequests(history.requests ?? []);
      setLoaded(true);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="w-account" aria-label="Wedding account">
      <div className="w-account-head">
        <h3>Your saved celebrations</h3>
        <button className="w-link" disabled={busy} onClick={() => void load()}>
          {busy
            ? "Opening…"
            : loaded
              ? "Refresh account"
              : "Open account plans"}
        </button>
      </div>
      <p>
        {session
          ? `Signed in as ${session.user.name}. Choose a saved celebration to continue on this device.`
          : "Sign in to reopen your saved plans and see availability requests. Your current draft stays on this device."}
      </p>
      {!session && (
        <button
          className="w-button w-outline"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void authClient.signIn
              .social({ provider: "discord", callbackURL: "/weddings" })
              .then((result) => {
                if (result.error)
                  setStatus(result.error.message ?? "Sign-in is unavailable.");
              })
              .catch(() =>
                setStatus(
                  "Sign-in is unavailable. Check the authentication configuration.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          Sign in with Discord
        </button>
      )}
      {status && <p role="status">{status}</p>}
      {loaded && !plans.length && (
        <p>No account plans yet. Save your current wedding to start.</p>
      )}
      {plans.map((saved) => (
        <article className="w-account-item" key={saved.id}>
          <div>
            <strong>{saved.data.names}</strong>
            <small>
              {saved.data.city} · {saved.data.date} · {saved.data.guests} guests
            </small>
          </div>
          <button
            className="w-button w-outline"
            onClick={() => {
              const plan = readWeddingPlan(saved.data);
              if (!plan) {
                setStatus(
                  "This plan contains invalid or outdated rental data and could not be opened.",
                );
                return;
              }
              onOpen(plan, saved.id);
              setStatus(
                "Saved wedding opened. Future saves will update this celebration.",
              );
            }}
          >
            Continue this wedding
          </button>
        </article>
      ))}
      {loaded && (
        <>
          <h3>Availability requests</h3>
          <p>
            Sample requests are planning records, not confirmed reservations.
          </p>
          {!requests.length && <p>No availability requests yet.</p>}
          {requests.map((request) => (
            <article className="w-account-item" key={request.id}>
              <div>
                <strong>{request.plan.names}</strong>
                <small>
                  {request.plan.date} · {money(request.total)} ·{" "}
                  {request.id.slice(0, 8)}
                </small>
                <small>
                  {request.status === "pending_supplier_confirmation"
                    ? "Awaiting supplier confirmation"
                    : request.status}
                </small>
              </div>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
