// Views and tools beyond the core Studio: Storyboard, Story line, Compare, the command bar and
// picture suggestions. Each part registers itself here; index.ts calls initExtras() once.
import "./views.css";
import { initCompare } from "./compare";
import { initPalette } from "./palette";
import { hooks } from "./session";
import { initRemoved, trackRemoved } from "./removed";
import { initStoryboard } from "./storyboard";
import { initStoryline } from "./storyline";
import { refreshSuggestions, initSuggestions } from "./suggestions";

export function initExtras(): void {
  initStoryboard();
  initStoryline();
  initCompare();
  initPalette();
  initRemoved();
  initSuggestions();
}
/** Called at the end of every Studio refresh. */
export function refreshExtras(): void {
  if (trackRemoved()) hooks.renderScenes();
  refreshSuggestions();
}
