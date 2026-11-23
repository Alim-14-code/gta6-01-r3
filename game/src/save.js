// Port Aurora — save and load.
// One job: persist cash and mission progress in the browser, nothing else.
const SAVE_KEY = 'port-aurora-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 120,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      completed: Array.isArray(data.completed) ? data.completed : [],
      muted: data.muted === true,
    };
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.round(game.cash),
      missionIndex: game.missionIndex,
      completed: game.completedMissions,
      muted: game.muted,
    }));
  } catch {
    // Storage may be unavailable (private mode, file://); the game plays on.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do: no save, no problem.
  }
}
