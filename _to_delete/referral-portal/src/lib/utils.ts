/** Short, time-prefixed unique id. Safe to import from client components. */
export function newId(): string {
  const rand = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join("");
  return `${Date.now().toString(36)}${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function splitList(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "2 days ago", "just now", ... */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "₹18–28 LPA" style salary label. */
export function salaryLabel(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (!min && !max) return null;
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₹";
  const unit = currency === "INR" || !currency ? " LPA" : "/yr";
  const fmt = (n: number) =>
    currency === "INR" || !currency
      ? String(n)
      : n >= 1000
        ? `${Math.round(n / 1000)}k`
        : String(n);
  if (min && max) return `${sym}${fmt(min)}–${fmt(max)}${unit}`;
  return `${sym}${fmt((min ?? max)!)}${unit}${min ? "+" : ""}`;
}

export function expLabel(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return `${min}–${max} yrs`;
  if (min !== null) return `${min}+ yrs`;
  return `up to ${max} yrs`;
}

/** Deterministic pleasant colour from a string — used for avatars/logos. */
export function colorFor(seed: string): string {
  const palette = [
    "#2547eb", "#0d9488", "#c2410c", "#7c3aed", "#be123c",
    "#0369a1", "#4d7c0f", "#a16207", "#9333ea", "#0f766e",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}
