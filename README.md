# AI & LLM Engineering

A hands-on, production-focused learning path covering LLM systems, agents, RAG, multi-agent orchestration, and LangChain, all built from scratch in TypeScript.

---

## Modules

### 01 — LLM Systems: Reliability, Cost & Evaluation

> **Goal:** Turn raw model access into a reliable, observable, cost-bounded LLM layer with an automated eval loop.

**Topics covered:**
- Provider abstraction (OpenAI, Gemini, Anthropic adapters)
- Request validation & structured output (Zod schemas)
- Timeouts, abort signals & retry with exponential backoff + jitter
- Typed errors & retryability classification
- Overall request deadlines
- Exact-match caching (SHA-256 keyed, TTL)
- Circuit breaker & provider fallback routing
- Tool / function calling
- Observability & metrics collection (tracing latency, tokens, cost, cache hits)
- Evaluation suite & CI regression testing (exact match, JSON-schema, LLM-as-judge)

**Challenge:** A flaky provider stub randomly 429s, times out, and returns malformed JSON. Built a client that guarantees schema-valid responses within a bounded latency/cost budget — verified with 500 simulated calls asserting success rate, p99 latency, and total cost stay within thresholds.

---

### 02 — Agent Internals: Reliability, Memory & Control

> **Goal:** Build a controllable, resumable agent runtime with real memory and hard reliability guarantees — no framework.

**Topics covered:**
- Agent state machine (IDLE → RUNNING → WAITING_TOOL → COMPLETED / FAILED)
- Loop & budget guards (max steps, tokens, cost)
- Tool validation, structured errors, timeouts & retries
- State persistence & checkpoints (memory + file stores)
- Crash resilience & resume from checkpoint
- Deterministic replay & tracing (audit logs)
- Unit testing non-deterministic agents
- Short-term memory buffer & compaction / summarization
- Vector-backed long-term memory (cosine similarity)
- Evaluation: task success, tool precision/recall/F1, trajectory scoring
- Reflection & self-critique engine

**Challenge:** A 6-step task where step 4's tool intermittently fails. The agent retries intelligently, never exceeds its step/token budget, checkpoints after every step, and resumes correctly if killed mid-task — proven with a restart test.

---

### 03 — Advanced RAG: Retrieval Quality at Scale

> **Goal:** Move from naive RAG to a measured, high-precision retrieval system with hybrid search, re-ranking, query transformation, and a retrieval eval.

**Topics covered:**
- Naive top-K & retrieval failure modes
- Chunking strategies & structure preservation
- Dense (semantic embeddings) vs sparse (BM25) search
- Hybrid search & score fusion (Reciprocal Rank Fusion)
- Metadata pre-filtering & indexing
- Two-stage retrieval & cross-encoder re-ranking
- Query rewriting, expansion & decomposition
- HyDE (Hypothetical Document Embeddings)
- Retrieval metrics: Recall@K, MRR, nDCG, Precision
- Generation metrics: faithfulness & relevance
- LLM-as-judge & RAGAS-style evaluation
- Context stuffing & "lost in the middle" problem
- Data freshness, invalidation & staleness

**Challenge:** Given a query set where naive top-K scores poorly, implemented hybrid search + re-ranking and demonstrated a measurable lift in Recall@K and MRR on a held-out labeled set — improvement shown by numbers, not vibes.

---

### 04 — Multi-Agent Orchestration at Production Quality

> **Goal:** Design multi-agent systems that actually beat a single agent — with routing, parallelism, shared state, and human-in-the-loop — and prove it.

**Topics covered:**
- When multi-agent beats single-agent (taxonomy)
- Supervisor → router → specialist workers architecture
- Sequential vs parallel fan-out / fan-in aggregation
- Shared state: blackboard vs message passing
- Idempotency & preventing duplicate/conflicting work
- Message contracts, typed schemas & protocols
- Human-in-the-loop: interrupt, approve, edit, reject
- Error propagation, cascades & circuit breakers
- Partial failure handling & graceful degradation
- Per-agent timeouts, deadlock avoidance & SLAs
- Bounded cost budgets & dynamic token throttling
- Concurrency correctness, race conditions & optimistic concurrency control
- Testing concurrency with stress harnesses
- Single-agent vs multi-agent quality/latency/cost evaluation
- Production observability, tracing & audit logs

**Challenge:** Supervisor + 3 parallel workers aggregating results under a global cost/time budget, where one worker fails. The system degrades gracefully (partial result + flag), never hangs or crashes, and stays within budget — proven with tests.

---

### 05 — LangChain In Depth (and Its Limits)

> **Goal:** Use LangChain where it earns its keep, know exactly what its abstractions do, and know when to drop to raw code.

**Topics covered:**
- LCEL execution engine & Runnable protocol
- Composition patterns: pipe, parallel, passthrough
- Streaming internals: token chunking & generators
- Batching & concurrency throughput optimization
- Configurable fallbacks & dynamic routing
- Custom runnables with `RunnableLambda`
- Typed I/O & schema enforcement (Zod)
- Structured output parsers & auto-repair retries
- Custom tools & dynamic dispatch
- LangSmith tracing, observability & spans
- Evaluation datasets & CI regression testing
- Debugging slow & opaque chains
- When LangChain helps vs when to rip it out (decision matrix)
- Retrieval chain with re-ranker & source citations
- Cost, latency & memory benchmarking: raw TypeScript vs LCEL

**Challenge:** Re-implemented the Day 03 hybrid RAG as a streaming LangChain chain with a fallback model and LangSmith tracing, then verified retrieval metrics match the raw version within tolerance and reported the latency/cost delta.

---

### 06 — LangGraph: Stateful, Durable, Human-in-the-Loop Graphs

> **Goal:** Model complex agent control flow as durable graphs with persistence, interrupts, and time-travel — production-grade.

**Topics covered:**
- LangGraph core model: StateGraph, nodes, edges, compilation
- Typed state with Annotation API & reducers (append, additive, last-write-wins)
- Conditional edges & dynamic routing
- Cycles, loops & recursion limits
- Subgraphs & nested composition
- Map-reduce fan-out with Send API & fan-in via reducers
- Checkpointers & durable execution (MemorySaver, thread persistence)
- Time-travel: state history, fork from past checkpoint, replay
- Human-in-the-loop: interrupt(), Command({ resume }), approval gates
- Streaming state updates & token streaming
- Resume-after-crash & fault tolerance
- Testing cyclic graphs deterministically (checkpoint replay)
- State reducers deep dive (parallel safety, composition)
- Error handling & retry patterns
- Multi-agent graph architecture (supervisor-as-router, agent-as-node)
- Cost budget enforcement & guard nodes

**Challenge:** Built a LangGraph workflow with a human-approval interrupt and a retry cycle that survives a simulated process kill mid-run and resumes from the last checkpoint to the correct next node — proven with a test that asserts interrupt, resume, crash recovery, and bounded retries.

---

### 07 — MCP: Building Secure, Production Servers

> **Goal:** Build hardened MCP servers exposing real systems, and integrate them into your agents with proper auth and safety.

**Topics covered:**
- MCP architecture in depth: tools, resources, prompts; transports; capability negotiation
- Production SQLite engine via native `node:sqlite` (`DatabaseSync`)
- Multi-layer input validation & strict schema enforcement (Zod)
- SQL injection defense: AST analysis, comment masking rejection, stacked query prevention
- Authentication & Role-Based Access Control (RBAC) with least-privilege tool scopes
- Sliding window rate limiting & backpressure telemetry
- Append-only, tamper-evident cryptographic audit logs (SHA-256 hash chains)
- MCP vs bespoke tool integration trade-offs
- LangGraph agent client integration & graceful tool error recovery
- Threat-modeling trust boundaries: prompt-injection-driven tool abuse containment
- Model-independent contract testing for MCP tools and resources

**Challenge:** Built an MCP server exposing a SQL database with read scopes only, that rejects injection and out-of-scope requests, rate-limits, and audit-logs every call — then had a LangGraph agent use it and proved safety guarantees with adversarial and contract tests.

---

## Tech Stack

- **Language:** TypeScript (ESM)
- **Runtime:** Node.js (v22+) + tsx
- **Database:** Native `node:sqlite` (`DatabaseSync`)
- **Protocol:** `@modelcontextprotocol/sdk` (Model Context Protocol)
- **Validation:** Zod
- **LLM SDKs:** `@langchain/core`, `@langchain/openai`, `@langchain/langgraph`
- **Testing:** Custom contract & adversarial test suites per module

## Getting Started

```bash
# Pick any module and install
cd 01_llm_systems_reliability_cost_evaluation
npm install

# Run the main demo
npm run dev

# Run the coding challenge
npm run challenge

# Run the eval suite
npm test
```
