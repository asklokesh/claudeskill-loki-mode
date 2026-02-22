# Module 4 Quiz: Production Deployment

Answer each question by selecting the best option (A, B, C, or D).

---

**Question 1:** What base image does the Loki Mode Dockerfile use?

A) Alpine Linux 3.19
B) Node.js 20 official image
C) Ubuntu 24.04
D) Debian Bookworm

---

**Question 2:** Which volume mount in docker-compose.yml gives the container read-write access?

A) `~/.gitconfig:/home/loki/.gitconfig`
B) `.:/workspace:rw`
C) `~/.ssh:/home/loki/.ssh`
D) `~/.config/gh:/home/loki/.config/gh`

---

**Question 3:** What does `LOKI_STAGED_AUTONOMY=true` do?

A) Enables parallel agent execution in stages
B) Requires human approval before execution
C) Stages deployment across multiple environments
D) Enables incremental feature rollout

---

**Question 4:** What is the default maximum number of parallel agents?

A) 3
B) 5
C) 10
D) 20

---

**Question 5:** How do you set a cost budget limit for a Loki Mode session?

A) `loki start --max-cost 10`
B) `loki start --budget 10.00 ./prd.md`
C) `LOKI_COST_LIMIT=10 loki start`
D) `loki config set budget 10.00`

---

**Question 6:** What does the completion council do?

A) Reviews all code changes before they are committed
B) Votes on whether the project is truly complete to prevent premature termination
C) Manages the deployment pipeline approval process
D) Assigns tasks to available agents

---

**Question 7:** What is the default dashboard port?

A) 3000
B) 8080
C) 57374
D) 9090

---

**Question 8:** Which environment variables enable TLS for the dashboard?

A) `LOKI_HTTPS=true` and `LOKI_HTTPS_PORT=443`
B) `LOKI_TLS_CERT` and `LOKI_TLS_KEY`
C) `LOKI_SSL_CERT` and `LOKI_SSL_KEY`
D) `LOKI_DASHBOARD_TLS=true`

---

**Question 9:** What does `LOKI_COUNCIL_STAGNATION_LIMIT=5` mean?

A) The council can only reject completion 5 times
B) After 5 iterations with no git changes, stagnation is flagged
C) The council checks every 5 minutes
D) Maximum 5 council members can vote

---

**Question 10:** How do you restrict which directories agents can modify?

A) `LOKI_READ_ONLY_PATHS=/etc,/usr`
B) `LOKI_ALLOWED_PATHS=/workspace/src,/workspace/tests`
C) `LOKI_SANDBOX_PATHS=/safe/dir`
D) `LOKI_WRITE_DIRS=src,tests`
