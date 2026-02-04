/**
 * Loki Mode Client-Side State Management
 *
 * Provides reactive state management with localStorage persistence
 * for Loki Mode web components.
 */

/**
 * State change event type
 */
export const STATE_CHANGE_EVENT = 'loki-state-change';

/**
 * Default state structure
 */
const DEFAULT_STATE = {
  // UI State
  ui: {
    theme: 'light',
    sidebarCollapsed: false,
    activeSection: 'kanban',
    terminalAutoScroll: true,
  },

  // Session State
  session: {
    connected: false,
    lastSync: null,
    mode: 'offline',
    phase: null,
    iteration: null,
  },

  // Local Tasks (not synced to server)
  localTasks: [],

  // Cached Server Data
  cache: {
    projects: [],
    tasks: [],
    agents: [],
    memory: null,
    lastFetch: null,
  },

  // User Preferences
  preferences: {
    pollInterval: 2000,
    notifications: true,
    soundEnabled: false,
  },
};

/**
 * LokiState - Reactive state management with localStorage persistence
 */
export class LokiState extends EventTarget {
  static STORAGE_KEY = 'loki-dashboard-state';
  static _instance = null;

  /**
   * Get the singleton instance
   * @returns {LokiState}
   */
  static getInstance() {
    if (!LokiState._instance) {
      LokiState._instance = new LokiState();
    }
    return LokiState._instance;
  }

  constructor() {
    super();
    this._state = this._loadState();
    this._subscribers = new Map();
    this._batchUpdates = [];
    this._batchTimeout = null;
  }

  /**
   * Load state from localStorage
   */
  _loadState() {
    try {
      const saved = localStorage.getItem(LokiState.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return this._mergeState(DEFAULT_STATE, parsed);
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage:', e);
    }
    return { ...DEFAULT_STATE };
  }

  /**
   * Deep merge two state objects
   */
  _mergeState(defaults, saved) {
    const result = { ...defaults };
    for (const key of Object.keys(saved)) {
      if (key in defaults && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
        result[key] = this._mergeState(defaults[key], saved[key]);
      } else {
        result[key] = saved[key];
      }
    }
    return result;
  }

  /**
   * Save state to localStorage
   */
  _saveState() {
    try {
      // Only persist certain parts of state
      const toSave = {
        ui: this._state.ui,
        localTasks: this._state.localTasks,
        preferences: this._state.preferences,
      };
      localStorage.setItem(LokiState.STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  }

  /**
   * Get the current state
   * @param {string} path - Optional dot-notation path (e.g., 'ui.theme')
   * @returns {any}
   */
  get(path = null) {
    if (!path) return { ...this._state };

    const parts = path.split('.');
    let value = this._state;
    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }
    return value;
  }

  /**
   * Set a state value
   * @param {string} path - Dot-notation path (e.g., 'ui.theme')
   * @param {any} value - New value
   * @param {boolean} persist - Whether to save to localStorage (default: true)
   */
  set(path, value, persist = true) {
    const parts = path.split('.');
    const lastKey = parts.pop();
    let target = this._state;

    for (const part of parts) {
      if (!(part in target)) {
        target[part] = {};
      }
      target = target[part];
    }

    const oldValue = target[lastKey];
    target[lastKey] = value;

    if (persist) {
      this._saveState();
    }

    this._notifyChange(path, value, oldValue);
  }

  /**
   * Update multiple state values at once
   * @param {object} updates - Object with path:value pairs
   * @param {boolean} persist - Whether to save to localStorage
   */
  update(updates, persist = true) {
    const changes = [];

    for (const [path, value] of Object.entries(updates)) {
      const oldValue = this.get(path);
      this.set(path, value, false);
      changes.push({ path, value, oldValue });
    }

    if (persist) {
      this._saveState();
    }

    // Batch notify
    for (const change of changes) {
      this._notifyChange(change.path, change.value, change.oldValue);
    }
  }

  /**
   * Notify subscribers of a state change
   */
  _notifyChange(path, value, oldValue) {
    // Dispatch generic event
    this.dispatchEvent(new CustomEvent(STATE_CHANGE_EVENT, {
      detail: { path, value, oldValue }
    }));

    // Notify specific path subscribers
    const subscribers = this._subscribers.get(path) || [];
    for (const callback of subscribers) {
      try {
        callback(value, oldValue, path);
      } catch (e) {
        console.error('State subscriber error:', e);
      }
    }

    // Notify parent path subscribers
    const parts = path.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parentPath = parts.join('.');
      const parentSubscribers = this._subscribers.get(parentPath) || [];
      for (const callback of parentSubscribers) {
        try {
          callback(this.get(parentPath), null, parentPath);
        } catch (e) {
          console.error('State subscriber error:', e);
        }
      }
    }
  }

  /**
   * Subscribe to state changes at a specific path
   * @param {string} path - Dot-notation path
   * @param {function} callback - Called with (newValue, oldValue, path)
   * @returns {function} Unsubscribe function
   */
  subscribe(path, callback) {
    if (!this._subscribers.has(path)) {
      this._subscribers.set(path, []);
    }
    this._subscribers.get(path).push(callback);

    // Return unsubscribe function
    return () => {
      const subs = this._subscribers.get(path);
      const index = subs.indexOf(callback);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  }

  /**
   * Reset state to defaults
   * @param {string} path - Optional path to reset (resets all if not provided)
   */
  reset(path = null) {
    if (path) {
      const parts = path.split('.');
      let defaultValue = DEFAULT_STATE;
      for (const part of parts) {
        defaultValue = defaultValue?.[part];
      }
      this.set(path, defaultValue);
    } else {
      this._state = { ...DEFAULT_STATE };
      this._saveState();
      this.dispatchEvent(new CustomEvent(STATE_CHANGE_EVENT, {
        detail: { path: null, value: this._state, oldValue: null }
      }));
    }
  }

  // ============================================
  // Convenience Methods
  // ============================================

  /**
   * Add a local task
   */
  addLocalTask(task) {
    const tasks = this.get('localTasks') || [];
    const newTask = {
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      ...task,
    };
    this.set('localTasks', [...tasks, newTask]);
    return newTask;
  }

  /**
   * Update a local task
   */
  updateLocalTask(taskId, updates) {
    const tasks = this.get('localTasks') || [];
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return null;

    const updatedTask = { ...tasks[index], ...updates, updatedAt: new Date().toISOString() };
    tasks[index] = updatedTask;
    this.set('localTasks', [...tasks]);
    return updatedTask;
  }

  /**
   * Delete a local task
   */
  deleteLocalTask(taskId) {
    const tasks = this.get('localTasks') || [];
    this.set('localTasks', tasks.filter(t => t.id !== taskId));
  }

  /**
   * Move a local task to a different status
   */
  moveLocalTask(taskId, newStatus, position = null) {
    const tasks = this.get('localTasks') || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) return null;

    return this.updateLocalTask(taskId, {
      status: newStatus,
      position: position ?? task.position,
    });
  }

  /**
   * Update session state
   */
  updateSession(updates) {
    this.update(
      Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [`session.${k}`, v])
      ),
      false // Don't persist session state
    );
  }

  /**
   * Update cache with server data
   */
  updateCache(data) {
    this.update({
      'cache.projects': data.projects ?? this.get('cache.projects'),
      'cache.tasks': data.tasks ?? this.get('cache.tasks'),
      'cache.agents': data.agents ?? this.get('cache.agents'),
      'cache.memory': data.memory ?? this.get('cache.memory'),
      'cache.lastFetch': new Date().toISOString(),
    }, false);
  }

  /**
   * Get merged tasks (local + server)
   */
  getMergedTasks() {
    const serverTasks = this.get('cache.tasks') || [];
    const localTasks = this.get('localTasks') || [];

    // Mark local tasks
    const markedLocal = localTasks.map(t => ({ ...t, isLocal: true }));

    return [...serverTasks, ...markedLocal];
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status) {
    return this.getMergedTasks().filter(t => t.status === status);
  }
}

/**
 * Get the default state instance
 * @returns {LokiState}
 */
export function getState() {
  return LokiState.getInstance();
}

/**
 * Create a reactive store bound to a specific state path
 * @param {string} path - State path to bind to
 * @returns {object} Store with get, set, and subscribe methods
 */
export function createStore(path) {
  const state = getState();

  return {
    get: () => state.get(path),
    set: (value) => state.set(path, value),
    subscribe: (callback) => state.subscribe(path, callback),
  };
}

export default LokiState;
