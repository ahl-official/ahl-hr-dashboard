"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AddEmployeeWizard, type JoinerPrefill } from "@/components/onboarding/AddEmployeeWizard";
import { GROUP_LOGOS } from "@/lib/brand";
import { DASHBOARD_CHANNEL } from "@/lib/channel";

// The employee's form. Public page, reached through a personal single-use link.
// It shows nothing except what HR pre-filled for this person.
export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [prefill, setPrefill] = useState<(JoinerPrefill & { mode: string }) | null>(null);
  const [problem, setProblem] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/join/${token}`)
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => (ok && body.success ? setPrefill(body.data) : setProblem(body.error || "This link is not valid.")))
      .catch(() => setProblem("Could not load the form. Please check your connection and try again."));
  }, [token]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-white border-b border-borderline">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 grid grid-cols-3 items-center gap-4 sm:gap-10">
          {GROUP_LOGOS.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={l.src} src={l.src} alt={l.alt} className="mx-auto max-h-10 sm:max-h-16 w-auto max-w-full object-contain" />
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8">
        {problem ? (
          <div className="bg-surface border border-borderline rounded-card p-10 text-center max-w-xl mx-auto mt-8">
            <h1 className="text-lg font-semibold text-navy-DEFAULT">We could not open this form</h1>
            <p className="text-sm text-muted mt-2">{problem}</p>
          </div>
        ) : !prefill ? (
          <p className="py-20 text-center text-sm text-muted">Loading your form...</p>
        ) : (
          <AddEmployeeWizard
            prefill={prefill}
            submitUrl={`/api/join/${token}`}
            onSubmitted={() => {
              setSubmitted(true);
              try {
                const ch = new BroadcastChannel(DASHBOARD_CHANNEL);
                ch.postMessage({ type: "employee-created" });
                ch.close();
              } catch {}
            }}
          />
        )}
        {submitted && prefill?.mode === "device" && (
          <p className="text-center text-sm font-medium text-slate-600 mt-2">Please hand the device back to HR.</p>
        )}
      </main>
    </div>
  );
}
