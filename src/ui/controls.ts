// Settings controls, shared by the Studio and a book's Reading drawer. Markup convention:
//   any element with data-key holding buttons with data-v (segments, swatches, specimen cards)
//   <select data-key="pairing">, <input type="checkbox" data-key="motion">,
//   <input type="range" data-key="fontSize"> with <b data-out="fontSize"></b>
import type { Settings } from "../types";

type Change = <K extends keyof Settings>(k: K, v: Settings[K]) => void;

const GROUPS = "[data-key]:not(input):not(select)";

export function bindControls(root: ParentNode, onChange: Change): void {
  root.querySelectorAll<HTMLElement>(GROUPS).forEach((sg) => sg.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (b && sg.contains(b) && b.hasAttribute("data-v")) onChange(sg.getAttribute("data-key") as keyof Settings, b.getAttribute("data-v") as never);
  }));
  root.querySelectorAll<HTMLSelectElement>("select[data-key]").forEach((s) =>
    s.addEventListener("change", () => onChange(s.getAttribute("data-key") as keyof Settings, s.value as never)));
  root.querySelectorAll<HTMLInputElement>("input[type=checkbox][data-key]").forEach((c) =>
    c.addEventListener("change", () => onChange(c.getAttribute("data-key") as keyof Settings, c.checked as never)));
  root.querySelectorAll<HTMLInputElement>("input[type=range][data-key]").forEach((r) =>
    r.addEventListener("input", () => onChange(r.getAttribute("data-key") as keyof Settings, +r.value as never)));
}

export function syncControls(root: ParentNode, S: Settings, opts: { finePointer?: boolean } = {}): void {
  root.querySelectorAll<HTMLElement>(GROUPS).forEach((sg) => {
    const k = sg.getAttribute("data-key") as keyof Settings;
    sg.querySelectorAll("button[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === String(S[k]))));
  });
  root.querySelectorAll<HTMLSelectElement>("select[data-key]").forEach((s) => { s.value = String(S[s.getAttribute("data-key") as keyof Settings]); });
  root.querySelectorAll<HTMLInputElement>("input[type=checkbox][data-key]").forEach((c) => {
    const k = c.getAttribute("data-key") as keyof Settings;
    c.checked = !!S[k];
    if (k === "follow") c.disabled = S.light === "off" || opts.finePointer === false;
    if (k === "flicker") c.disabled = S.light === "off" && S.style === "none";
  });
  root.querySelectorAll<HTMLInputElement>("input[type=range][data-key]").forEach((r) => { r.value = String(S[r.getAttribute("data-key") as keyof Settings]); });
  root.querySelectorAll<HTMLElement>("[data-out]").forEach((o) => { o.textContent = String(S[o.getAttribute("data-out") as keyof Settings]) + "px"; });
}
