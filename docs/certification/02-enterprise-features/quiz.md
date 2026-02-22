# Module 2 Quiz: Enterprise Features

Answer each question by selecting the best option (A, B, C, or D).

---

**Question 1:** What is the default state of audit logging in Loki Mode (v5.38.0+)?

A) Disabled, must be explicitly enabled
B) Enabled by default, can be disabled with `LOKI_AUDIT_DISABLED=true`
C) Only enabled when running in Docker sandbox
D) Only enabled when `LOKI_ENTERPRISE_AUDIT=true` is set

---

**Question 2:** Which environment variable enables OpenTelemetry in Loki Mode?

A) `LOKI_OTEL_ENABLED=true`
B) `LOKI_TELEMETRY=true`
C) `LOKI_OTEL_ENDPOINT=http://localhost:4318`
D) `OTEL_EXPORTER_ENDPOINT=http://localhost:4318`

---

**Question 3:** What is the default port for the Loki Mode dashboard?

A) 3000
B) 8080
C) 57374
D) 9090

---

**Question 4:** Which environment variable enables token-based API authentication?

A) `LOKI_AUTH_ENABLED=true`
B) `LOKI_ENTERPRISE_AUTH=true`
C) `LOKI_TOKEN_AUTH=true`
D) `LOKI_API_AUTH=true`

---

**Question 5:** What protocol options does Loki Mode support for syslog forwarding?

A) HTTP and HTTPS only
B) UDP and TCP
C) gRPC and HTTP
D) MQTT and AMQP

---

**Question 6:** What happens when `LOKI_OTEL_ENDPOINT` is NOT set?

A) Loki Mode refuses to start
B) OTEL uses a default localhost endpoint
C) Loki Mode uses no-op stubs with zero overhead
D) OTEL data is written to a local file

---

**Question 7:** Which command generates an API token for the dashboard?

A) `loki auth token create`
B) `loki enterprise token generate my-token`
C) `loki dashboard auth --new-token`
D) `loki config auth token`

---

**Question 8:** How do you enable TLS for the Loki Mode dashboard?

A) Set `LOKI_DASHBOARD_TLS=true`
B) Set `LOKI_TLS_CERT` and `LOKI_TLS_KEY` to PEM file paths
C) Pass `--tls` flag to `loki dashboard start`
D) TLS is always enabled by default

---

**Question 9:** What does `LOKI_PROMPT_INJECTION` control?

A) Whether agents can execute shell commands
B) Whether the `HUMAN_INPUT.md` file can inject directives into a running session
C) Whether API tokens expire automatically
D) Whether OTEL traces include prompt content

---

**Question 10:** Which command checks the status of all enterprise features?

A) `loki config show`
B) `loki enterprise status`
C) `loki doctor --enterprise`
D) `loki status --enterprise`
