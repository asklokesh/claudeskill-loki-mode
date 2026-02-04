/**
 * State Notifications Service (SYN-016)
 *
 * WebSocket-based real-time state change notifications for API clients.
 * Integrates with the centralized state manager and event bus.
 */

import {
  eventBus,
  emitLogEvent,
} from "./event-bus.ts";
import type { EventFilter } from "../types/events.ts";

/**
 * State change notification message
 */
export interface StateNotification {
  type: "state_change";
  id: string;
  timestamp: string;
  filePath: string;
  changeType: "create" | "update" | "delete";
  source: string;
  diff?: {
    added: Record<string, unknown>;
    removed: Record<string, unknown>;
    changed: Record<string, unknown>;
  };
}

/**
 * Subscription request message
 */
export interface SubscriptionRequest {
  type: "subscribe" | "unsubscribe";
  files?: string[];
  changeTypes?: ("create" | "update" | "delete")[];
}

/**
 * WebSocket client connection
 */
interface WebSocketClient {
  id: string;
  socket: WebSocket;
  filter: {
    files: Set<string> | null;
    changeTypes: Set<string> | null;
  };
}

/**
 * State Notifications Manager
 *
 * Handles WebSocket connections for real-time state change notifications.
 */
class StateNotificationsManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private messageCounter = 0;
  private eventSubscriptionId: string | null = null;

  constructor() {
    this.setupEventBusListener();
  }

  /**
   * Set up listener for state events from the event bus
   */
  private setupEventBusListener(): void {
    const filter: EventFilter = {
      types: ["session:started", "session:stopped", "phase:started", "phase:completed"],
    };

    // Also listen to state events specifically - we'll filter by "state:" prefix
    this.eventSubscriptionId = eventBus.subscribe(filter, (event) => {
      // Handle state-related events
      if (event.type.startsWith("session:") || event.type.startsWith("phase:")) {
        this.broadcastToClients({
          type: "state_change",
          id: event.id,
          timestamp: event.timestamp,
          filePath: (event.data as Record<string, unknown>)?.filePath as string || "unknown",
          changeType: "update",
          source: "event-bus",
        });
      }
    });
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${++this.messageCounter}_${Date.now()}`;
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(socket: WebSocket): string {
    const clientId = this.generateClientId();

    const client: WebSocketClient = {
      id: clientId,
      socket,
      filter: {
        files: null, // null means all files
        changeTypes: null, // null means all change types
      },
    };

    this.clients.set(clientId, client);

    // Set up message handler
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SubscriptionRequest;
        this.handleMessage(clientId, message);
      } catch {
        this.sendError(clientId, "Invalid message format");
      }
    };

    // Set up close handler
    socket.onclose = () => {
      this.handleDisconnection(clientId);
    };

    // Set up error handler
    socket.onerror = () => {
      this.handleDisconnection(clientId);
    };

    // Send connection confirmation
    this.sendToClient(clientId, {
      type: "connected",
      clientId,
      timestamp: new Date().toISOString(),
    });

    emitLogEvent("info", "global", `WebSocket client connected: ${clientId}`);

    return clientId;
  }

  /**
   * Handle client message
   */
  private handleMessage(clientId: string, message: SubscriptionRequest): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    switch (message.type) {
      case "subscribe":
        this.handleSubscribe(client, message);
        break;
      case "unsubscribe":
        this.handleUnsubscribe(client);
        break;
      default:
        this.sendError(clientId, `Unknown message type: ${(message as Record<string, unknown>).type}`);
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(client: WebSocketClient, request: SubscriptionRequest): void {
    // Update file filter
    if (request.files && request.files.length > 0) {
      client.filter.files = new Set(request.files);
    } else {
      client.filter.files = null;
    }

    // Update change type filter
    if (request.changeTypes && request.changeTypes.length > 0) {
      client.filter.changeTypes = new Set(request.changeTypes);
    } else {
      client.filter.changeTypes = null;
    }

    // Send confirmation
    this.sendToClient(client.id, {
      type: "subscribed",
      files: request.files || "all",
      changeTypes: request.changeTypes || "all",
      timestamp: new Date().toISOString(),
    });

    emitLogEvent("info", "global", `Client ${client.id} subscribed to state changes`);
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(client: WebSocketClient): void {
    // Reset filters
    client.filter.files = null;
    client.filter.changeTypes = null;

    // Send confirmation
    this.sendToClient(client.id, {
      type: "unsubscribed",
      timestamp: new Date().toISOString(),
    });

    emitLogEvent("info", "global", `Client ${client.id} unsubscribed from state changes`);
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    this.clients.delete(clientId);
    emitLogEvent("info", "global", `WebSocket client disconnected: ${clientId}`);
  }

  /**
   * Check if a notification matches a client's filter
   */
  private matchesFilter(client: WebSocketClient, notification: StateNotification): boolean {
    // Check file filter
    if (client.filter.files !== null) {
      if (!client.filter.files.has(notification.filePath)) {
        return false;
      }
    }

    // Check change type filter
    if (client.filter.changeTypes !== null) {
      if (!client.filter.changeTypes.has(notification.changeType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Send a message to a specific client
   */
  private sendToClient(clientId: string, message: Record<string, unknown>): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.socket.send(JSON.stringify(message));
    } catch {
      // Client may have disconnected
      this.handleDisconnection(clientId);
    }
  }

  /**
   * Send an error message to a client
   */
  private sendError(clientId: string, error: string): void {
    this.sendToClient(clientId, {
      type: "error",
      error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast a state notification to all matching clients
   */
  broadcastStateChange(
    filePath: string,
    changeType: "create" | "update" | "delete",
    source: string,
    diff?: {
      added: Record<string, unknown>;
      removed: Record<string, unknown>;
      changed: Record<string, unknown>;
    }
  ): void {
    const notification: StateNotification = {
      type: "state_change",
      id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      filePath,
      changeType,
      source,
      diff,
    };

    this.broadcastToClients(notification);
  }

  /**
   * Broadcast a notification to all matching clients
   */
  private broadcastToClients(notification: StateNotification): void {
    for (const client of this.clients.values()) {
      if (this.matchesFilter(client, notification)) {
        try {
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(JSON.stringify(notification));
          }
        } catch {
          // Client may have disconnected
          this.handleDisconnection(client.id);
        }
      }
    }
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all connected client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Disconnect a specific client
   */
  disconnectClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.socket.close();
      } catch {
        // Ignore close errors
      }
      this.clients.delete(clientId);
    }
  }

  /**
   * Disconnect all clients
   */
  disconnectAll(): void {
    for (const client of this.clients.values()) {
      try {
        client.socket.close();
      } catch {
        // Ignore close errors
      }
    }
    this.clients.clear();
  }

  /**
   * Stop the notifications manager
   */
  stop(): void {
    this.disconnectAll();
    if (this.eventSubscriptionId) {
      eventBus.unsubscribe(this.eventSubscriptionId);
      this.eventSubscriptionId = null;
    }
  }
}

// Singleton instance
export const stateNotifications = new StateNotificationsManager();

/**
 * Handle WebSocket upgrade for state notifications
 */
export function handleStateNotificationsWebSocket(req: Request): Response {
  // Check if this is a WebSocket upgrade request
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  // Upgrade the connection
  const { socket, response } = Deno.upgradeWebSocket(req);

  // Handle the new connection
  stateNotifications.handleConnection(socket);

  return response;
}

/**
 * Emit a state change notification to all connected WebSocket clients
 *
 * This is the main function to call from the state manager when state changes.
 */
export function notifyStateChange(
  filePath: string,
  changeType: "create" | "update" | "delete",
  source: string,
  diff?: {
    added: Record<string, unknown>;
    removed: Record<string, unknown>;
    changed: Record<string, unknown>;
  }
): void {
  stateNotifications.broadcastStateChange(filePath, changeType, source, diff);
}

/**
 * Get the number of connected WebSocket clients
 */
export function getConnectedClientCount(): number {
  return stateNotifications.getClientCount();
}
