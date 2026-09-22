# Day 08 AI Engineering Rules

## Project Goal

This project is a production-shaped agentic AI capstone.

The system combines:

- API Gateway
- LangGraph orchestration
- Advanced RAG
- Multiple specialized agents
- MCP tools
- Human-in-the-loop
- Evaluation
- Observability
- Cost controls
- Security controls

The goal is not to build a toy chatbot.

---

## Architecture Rules

1. Keep clear boundaries between layers.

2. Gateway responsibilities:
   - Authentication
   - Request validation
   - Rate limiting
   - Request identity
   - Global request budgets
   - Request tracing

3. LangGraph/orchestration responsibilities:
   - Workflow state
   - Agent routing
   - Conditional execution
   - Cycles
   - Interrupt/resume
   - Workflow-level budgets

4. RAG responsibilities:
   - Query processing
   - Retrieval
   - Ranking/reranking
   - Context construction
   - Retrieval evaluation

5. MCP responsibilities:
   - Expose narrowly scoped capabilities
   - Validate tool input
   - Authenticate requests
   - Authorize tool access
   - Enforce least privilege
   - Rate limit
   - Audit tool calls

6. MCP must not expose arbitrary SQL execution.

7. MCP tools must use business-level operations rather than generic database access.

8. Sensitive operations must support human approval.

9. Evaluation must remain independent from production execution.

10. Observability must not change business behavior.

---

## Security Rules

1. Treat all model-generated tool calls as untrusted input.

2. Never trust the LLM to enforce authorization.

3. Authorization must be enforced server-side.

4. Deny by default.

5. Validate all external input.

6. Never concatenate untrusted input into SQL.

7. Never expose secrets to models.

8. Never log API keys, tokens, passwords or credentials.

9. Do not log sensitive user data unless explicitly required.

10. Every MCP tool call must produce an audit event.

---

## Reliability Rules

1. Every external call must have a timeout.

2. Retry only retryable failures.

3. Never retry authorization or validation failures blindly.

4. Use bounded retries.

5. Use exponential backoff with jitter where appropriate.

6. Workflows must have maximum step limits.

7. Workflows must have maximum cost/token limits.

8. Workflows must have a deadline.

9. Tool failures must be represented as structured errors.

10. Partial failure must not corrupt workflow state.

---

## AI Coding Rules

When modifying this project:

1. Understand existing architecture before changing files.

2. Do not rewrite unrelated files.

3. Do not introduce dependencies without justification.

4. Prefer small, reviewable changes.

5. Add tests for behavior changes.

6. Preserve existing public interfaces unless explicitly requested.

7. Do not silently change architecture.

8. Do not remove security controls to make tests pass.

9. Do not hardcode secrets.

10. Do not claim tests pass unless they were actually executed.

11. Do not invent APIs or SDK behavior.

12. If requirements are ambiguous, explain the ambiguity before making a major architectural decision.

---

## TypeScript Rules

1. Use strict TypeScript.

2. Avoid `any`.

3. Prefer explicit types at system boundaries.

4. Validate runtime input using schemas.

5. Do not trust TypeScript types as runtime validation.

6. Use discriminated unions for important state/error types.

7. Keep domain types separate from infrastructure types.

---

## Testing Rules

Every important feature should have:

- happy-path test
- invalid-input test
- failure-path test
- security test where applicable

Tests should prove behavior rather than implementation details.

---

## Agent Rules

Agents should have:

- explicit responsibilities
- explicit inputs
- explicit outputs
- bounded execution
- structured errors

Avoid creating agents simply because "multi-agent" sounds better.

---

## MCP Tool Rules

Every MCP tool must define:

- name
- description
- input schema
- authorization requirement
- allowed scope
- timeout
- audit behavior
- error behavior

Never expose:

- arbitrary SQL
- arbitrary HTTP requests
- unrestricted filesystem access
- unrestricted database access

---

## Cost Rules

Every LLM workflow must be bounded by:

- maximum steps
- maximum tokens
- maximum estimated cost
- maximum runtime

Cost limits must be enforced in code, not only documented.

---

## Observability Rules

Important operations should expose:

- request ID
- trace ID
- operation name
- duration
- status
- error
- token usage when available
- estimated cost when available

Never expose secrets through logs or traces.

---

## Definition of Done

A feature is not complete merely because the code works.

A production-shaped feature should include:

1. implementation
2. validation
3. tests
4. failure handling
5. observability
6. security considerations
7. documentation where appropriate