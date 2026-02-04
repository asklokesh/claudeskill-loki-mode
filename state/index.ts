/**
 * Loki Mode State Manager - TypeScript Entry Point
 *
 * Centralized state management with file-based caching,
 * file watching, and event bus integration.
 */

export {
  StateManager,
  StateChange,
  ManagedFile,
  ManagedFileType,
  StateCallback,
  Disposable,
  getStateDiff,
  getStateManager,
  resetStateManager,
} from "./manager";
