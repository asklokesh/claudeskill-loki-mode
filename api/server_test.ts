/**
 * API Server Tests
 *
 * Run with: deno test --allow-all api/server_test.ts
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

import { createHandler, routeRequest } from "./server.ts";
import { eventBus } from "./services/event-bus.ts";

// Test utilities
function createRequest(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Request {
  const url = `http://localhost:8420${path}`;
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

// ============================================================
// Health Endpoint Tests
// ============================================================

Deno.test("GET /health returns health status", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/health");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.status);
  assertExists(data.version);
  assertExists(data.uptime);
  assertExists(data.providers);
});

Deno.test("GET /health/live returns alive status", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/health/live");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.alive, true);
});

// ============================================================
// Session Endpoint Tests
// ============================================================

Deno.test("GET /api/sessions returns empty list initially", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/sessions");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.sessions);
  assertEquals(Array.isArray(data.sessions), true);
});

Deno.test("POST /api/sessions validates provider", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("POST", "/api/sessions", { provider: "invalid" });
  const res = await handler(req);

  assertEquals(res.status, 422);
  const data = await res.json();
  assertStringIncludes(data.error, "Invalid provider");
});

Deno.test("GET /api/sessions/:id returns 404 for unknown session", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/sessions/unknown-id");
  const res = await handler(req);

  assertEquals(res.status, 404);
  const data = await res.json();
  assertEquals(data.code, "SESSION_NOT_FOUND");
});

// ============================================================
// Task Endpoint Tests
// ============================================================

Deno.test("GET /api/tasks returns empty list initially", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/tasks");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.tasks);
  assertEquals(Array.isArray(data.tasks), true);
});

Deno.test("GET /api/tasks/active returns active tasks", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/tasks/active");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.tasks);
  assertExists(data.count);
});

// ============================================================
// Event Endpoint Tests
// ============================================================

Deno.test("GET /api/events/stats returns event statistics", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/events/stats");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.subscribers);
  assertExists(data.historySize);
});

Deno.test("GET /api/events/history returns event history", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/events/history");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.events);
  assertEquals(Array.isArray(data.events), true);
});

// ============================================================
// Event Bus Tests
// ============================================================

Deno.test("EventBus publishes and receives events", () => {
  const received: unknown[] = [];

  const subId = eventBus.subscribe({}, (event) => {
    received.push(event);
  });

  eventBus.publish("log:info", "test-session", { message: "test" });

  assertEquals(received.length, 1);
  assertEquals((received[0] as { type: string }).type, "log:info");

  eventBus.unsubscribe(subId);
});

Deno.test("EventBus filters by session ID", () => {
  const received: unknown[] = [];

  const subId = eventBus.subscribe({ sessionId: "session-1" }, (event) => {
    received.push(event);
  });

  eventBus.publish("log:info", "session-1", { message: "included" });
  eventBus.publish("log:info", "session-2", { message: "excluded" });

  assertEquals(received.length, 1);
  assertEquals((received[0] as { sessionId: string }).sessionId, "session-1");

  eventBus.unsubscribe(subId);
});

Deno.test("EventBus filters by event type", () => {
  const received: unknown[] = [];

  const subId = eventBus.subscribe({ types: ["log:error"] }, (event) => {
    received.push(event);
  });

  eventBus.publish("log:info", "test", { message: "info" });
  eventBus.publish("log:error", "test", { message: "error" });
  eventBus.publish("log:warn", "test", { message: "warn" });

  assertEquals(received.length, 1);
  assertEquals((received[0] as { type: string }).type, "log:error");

  eventBus.unsubscribe(subId);
});

// ============================================================
// CORS Tests
// ============================================================

Deno.test("OPTIONS request returns CORS headers", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = new Request("http://localhost:8420/api/sessions", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
    },
  });
  const res = await handler(req);

  assertEquals(res.status, 204);
  assertExists(res.headers.get("Access-Control-Allow-Origin"));
  assertExists(res.headers.get("Access-Control-Allow-Methods"));
});

// ============================================================
// Error Handling Tests
// ============================================================

Deno.test("Unknown route returns 404", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/unknown");
  const res = await handler(req);

  assertEquals(res.status, 404);
  const data = await res.json();
  assertEquals(data.code, "NOT_FOUND");
});

Deno.test("Invalid JSON returns 400", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = new Request("http://localhost:8420/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not valid json",
  });
  const res = await handler(req);

  assertEquals(res.status, 400);
});

// ============================================================
// Status Endpoint Tests
// ============================================================

Deno.test("GET /api/status returns detailed status", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/status");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.version);
  assertExists(data.uptime);
  assertExists(data.providers);
  assertExists(data.sessions);
  assertExists(data.events);
  assertExists(data.system);
});

Deno.test("GET /api/status includes memory context", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/status");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();

  // Verify memoryContext structure exists
  assertExists(data.memoryContext);
  assertEquals(typeof data.memoryContext.available, "boolean");
  assertEquals(Array.isArray(data.memoryContext.relevantPatterns), true);
  assertEquals(typeof data.memoryContext.patternCount, "number");

  // Patterns array should be limited to max 3
  assertEquals(data.memoryContext.relevantPatterns.length <= 3, true);

  // Each pattern should have required fields if there are any
  for (const pattern of data.memoryContext.relevantPatterns) {
    assertExists(pattern.id);
    assertExists(pattern.pattern);
    assertExists(pattern.category);
    assertExists(pattern.confidence);
  }
});

// ============================================================
// Suggestions Endpoint Tests
// ============================================================

Deno.test("GET /api/suggestions requires context parameter", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/suggestions");
  const res = await handler(req);

  assertEquals(res.status, 422);
  const data = await res.json();
  assertStringIncludes(data.error, "context");
});

Deno.test("GET /api/suggestions returns suggestions with valid context", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/suggestions?context=implement%20a%20new%20feature");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.suggestions);
  assertEquals(Array.isArray(data.suggestions), true);
  assertExists(data.context);
  assertExists(data.taskType);
});

Deno.test("GET /api/suggestions respects limit parameter", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/suggestions?context=debug%20an%20error&limit=3");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.suggestions);
  assertEquals(data.suggestions.length <= 3, true);
});

Deno.test("GET /api/suggestions accepts taskType parameter", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/suggestions?context=fix%20bug&taskType=debugging");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.taskType);
  assertEquals(data.taskType, "debugging");
});

Deno.test("GET /api/suggestions returns proper suggestion structure", async () => {
  const handler = createHandler({ port: 8420, host: "localhost", cors: true, auth: false });
  const req = createRequest("GET", "/api/suggestions?context=review%20code");
  const res = await handler(req);

  assertEquals(res.status, 200);
  const data = await res.json();

  // Each suggestion should have required fields if there are any
  for (const suggestion of data.suggestions) {
    assertExists(suggestion.id);
    assertExists(suggestion.type);
    assertEquals(typeof suggestion.confidence, "number");
    assertExists(suggestion.content);
    assertExists(suggestion.action);
  }
});
