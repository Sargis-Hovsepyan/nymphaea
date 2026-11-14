// What the Studio remembers about its own layout between visits: the device size and which
// sections are open. Studio-only, in localStorage; the book and the look are saved elsewhere.
import { load, store } from "../store";
import { $ } from "./session";

const KEY = "nymphaea-studio-ui";
type Device = "desk" | "tablet" | "phone";
interface Ui { device?: Device; open?: Record<string, boolean>; dz?: string }

/** Show one tab of the design panel. */
function showDz(k: string, focus = false): void {
  const tabs = Array.from($("mkDzTabs").querySelectorAll<HTMLButtonElement>("[data-dz]"));
  const t = tabs.find((b) => b.dataset.dz === k) || tabs[0];
  tabs.forEach((b) => { const on = b === t; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; $("dz-" + b.dataset.dz).hidden = !on; });
  if (focus) t.focus();
}

function read(): Ui { const u = load<Ui>(KEY); return u && typeof u === "object" ? u : {}; }
function patch(p: Partial<Ui>): void { store(KEY, { ...read(), ...p }); }

export function setDevice(d: Device): void {
  $("mkStage").classList.toggle("phone", d === "phone");
  $("mkStage").classList.toggle("tablet", d === "tablet");
  $("mkDevice").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.getAttribute("data-d") === d)));
}

/** Restore the device size and the open sections, and start remembering changes. */
export function initUiState(): void {
  const u = read();
  if (u.device === "phone" || u.device === "tablet") setDevice(u.device);
  $("mkDevice").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button"); if (!b) return;
    const d = (b.getAttribute("data-d") as Device) || "desk";
    setDevice(d); patch({ device: d });
  });
  showDz(u.dz || "edition");
  const dz = $("mkDzTabs");
  dz.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-dz]"); if (!b) return;
    showDz(b.dataset.dz!); patch({ dz: b.dataset.dz });
  });
  dz.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tabs = Array.from(dz.querySelectorAll<HTMLElement>("[data-dz]")), i = tabs.findIndex((b) => b.getAttribute("aria-selected") === "true");
    const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].dataset.dz!;
    showDz(n, true); patch({ dz: n });
  });
  document.querySelectorAll<HTMLDetailsElement>("#maker details.acc, #maker details.fold").forEach((d) => {
    const s = d.querySelector("summary"), key = s ? (s.textContent || "").trim() : "";
    if (!key) return;
    if (u.open && key in u.open) d.open = u.open[key];
    d.addEventListener("toggle", () => patch({ open: { ...(read().open || {}), [key]: d.open } }));
  });
}
