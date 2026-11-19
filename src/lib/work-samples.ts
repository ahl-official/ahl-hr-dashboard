// Work samples for creative and skill-based positions (recruitment SOP, step 4): 2–3 pieces of the candidate's
// actual work, and what they personally did on each. Pure, so the rules are unit-tested.
import type { FmsCandidate } from "../types/fms.ts";

/** The SOP's contribution questions. */
export const CONTRIBUTION_AREAS = [
  { key: "idea", label: "Developed the idea" },
  { key: "script", label: "Wrote the script" },
  { key: "shoot", label: "Shot it" },
  { key: "edit", label: "Edited it" },
  { key: "design", label: "Designed it" },
  { key: "distribution", label: "Managed distribution" },
  { key: "results", label: "Analysed the results" },
] as const;

export type ContributionArea = (typeof CONTRIBUTION_AREAS)[number]["key"];
export const CONTRIBUTION_LEVELS = ["Self", "Shared", "No"] as const;
export type ContributionLevel = (typeof CONTRIBUTION_LEVELS)[number];

export const SAMPLE_VERDICTS = ["Own work", "Mostly team work", "Unclear – verify"] as const;

export const MIN_SAMPLES = 2;
export const MAX_SAMPLES = 5;

export type WorkSample = {
  id: string;
  title: string;
  link: string;
  /** Contribution per area; areas that do not apply to the sample are left out. */
  contribution: Partial<Record<ContributionArea, ContributionLevel>>;
  candidateRole: string; // "What exactly did you do?" in the candidate's words
  verdict: string;
  hrNotes: string;
  addedAt: string;
};

export function getWorkSamples(candidate: Pick<FmsCandidate, "stageData">): WorkSample[] {
  const list = candidate.stageData?.ps?.workSamples;
  return Array.isArray(list) ? (list as WorkSample[]) : [];
}

/** A Position Kit's "work samples required" switch is stored as the text "yes". */
export const samplesRequired = (kit: { workSamplesRequired?: string } | null | undefined) =>
  (kit?.workSamplesRequired || "").toLowerCase() === "yes";

export function workSampleProgress(samples: WorkSample[], required: boolean) {
  const count = samples.length;
  return { count, required, min: MIN_SAMPLES, complete: !required || count >= MIN_SAMPLES };
}

/** Checks one sample. Returns an error message, or null when valid. */
export function validateWorkSample(s: Pick<WorkSample, "title" | "link" | "contribution" | "candidateRole" | "verdict">): string | null {
  if (!s.title.trim()) return "Give the sample a title.";
  if (!/^https?:\/\/\S+\.\S+/i.test(s.link.trim())) return "Add a link to the work (Drive, YouTube, Instagram, Behance…).";
  if (!Object.values(s.contribution).some(Boolean)) return "Mark what the candidate did for at least one area.";
  if (!s.candidateRole.trim()) return "Note what the candidate says they did.";
  if (!SAMPLE_VERDICTS.includes(s.verdict as (typeof SAMPLE_VERDICTS)[number])) return "Choose your verdict on their contribution.";
  return null;
}

/** "Idea: Self · Edit: Shared" — areas marked No are left out. */
export function contributionSummary(c: WorkSample["contribution"]): string {
  return CONTRIBUTION_AREAS.filter((a) => c[a.key] && c[a.key] !== "No")
    .map((a) => `${a.label}: ${c[a.key] === "Self" ? "themselves" : "with a team"}`)
    .join(" · ");
}

/** The candidate update that saves the sample list (in Interview Updates' stage data). */
export function workSamplesUpdate(candidate: Pick<FmsCandidate, "stageData">, samples: WorkSample[]): Partial<FmsCandidate> {
  return {
    stageData: {
      ...candidate.stageData,
      ps: { ...(candidate.stageData?.ps || {}), workSamples: samples.slice(0, MAX_SAMPLES) },
    },
  };
}
