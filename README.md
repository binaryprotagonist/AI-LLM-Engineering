# AI & LLM Engineering

A hands-on, production-focused learning path covering LLM systems, agents, RAG, multi-agent orchestration, and LangChain, all built from scratch in TypeScript.

---

## Modules

### 01 — LLM Systems: Reliability, Cost & Evaluation

> Building a production-grade LLM gateway from the ground up.

**Topics covered:**
- Provider abstraction (OpenAI, Gemini, Anthropic adapters)
- Request validation & structured output (Zod schemas)
- Timeouts, abort signals & retry with exponential backoff + jitter
- Typed errors & retryability classification
- Overall request deadlines
- Exact-match caching (SHA-256 keyed, TTL)
- Circuit breaker & provider fallback routing
- Tool / function calling
- Observability & metrics collection
- Evaluation suite & CI regression testing
- **Challenge:** 500-call reliability benchmark against a chaotic provider

---

### 02 — Agent Internals: Reliability, Memory & Control

> Building a controllable, resumable agent runtime with memory and evaluation.

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
- **Challenge:** 6-step resumable agent

---

### 03 — Advanced RAG: Retrieval Quality at Scale

> High-precision retrieval with hybrid search, re-ranking, and hardening.

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
- **Challenge:** Hybrid retrieval + re-ranking + eval pipeline

---

### 04 — Multi-Agent Orchestration at Production Quality

> Supervisor/router topology with parallel execution, shared state, and fault tolerance.

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
- **Challenge:** Fault-tolerant supervisor orchestrator

---

### 05 — LangChain In Depth (and Its Limits)

> Deep dive into LCEL internals, then benchmarking LangChain vs raw code.

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
- **Challenge:** Streaming RAG with fallbacks & eval

---

## Tech Stack

- **Language:** TypeScript (ESM)
- **Runtime:** Node.js + tsx
- **Validation:** Zod
- **LLM SDKs:** `@langchain/core`, `@langchain/openai`
- **Testing:** Custom eval suites per module

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
