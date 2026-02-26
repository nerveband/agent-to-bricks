/** Platform-aware modifier key label ("Cmd" on macOS, "Ctrl" elsewhere). */
export const MOD_KEY = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "Cmd" : "Ctrl";
