/**
 * Global state for block context menu visibility
 * Used to coordinate between BlockContextMenu and FloatingToolbar
 */

let isBlockMenuOpen = false;
const listeners = new Set<(isOpen: boolean) => void>();

export const blockMenuState = {
  get isOpen() {
    return isBlockMenuOpen;
  },

  setOpen(value: boolean) {
    if (isBlockMenuOpen !== value) {
      isBlockMenuOpen = value;
      listeners.forEach(listener => listener(value));
    }
  },

  subscribe(listener: (isOpen: boolean) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
