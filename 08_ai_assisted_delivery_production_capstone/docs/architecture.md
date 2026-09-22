# Day 08 — Architecture Contract

## 1. System Goal

Build a production-shaped AI knowledge and research assistant.

The system should allow users to ask questions over internal knowledge and, when required, interact with authorized internal systems through MCP tools.

The system must support:

- RAG
- multiple agents
- LangGraph orchestration
- MCP tools
- human approval
- evaluation
- tracing
- cost controls
- security controls
- failure handling

---

# 2. High-Level Architecture

```text
User
  |
  v
API Gateway
  |
  |-- Authentication
  |-- Validation
  |-- Rate Limiting
  |-- Request Budget
  |-- Request Tracing
  |
  v
LangGraph Supervisor
  |
  +----------------+----------------+
  |                |                |
  v                v                v
RAG Agent     Analysis Agent    MCP Agent
  |                                 |
  v                                 v
Retrieval                       MCP Server
  |                                 |
  +-- Dense                        AuthN
  +-- Sparse                       AuthZ
  +-- Reranking                    Validation
                                  Rate Limit
                                  Audit
                                    |
                                    v
                               Service Layer
                                    |
                              +-----+-----+
                              |           |
                              v           v
                             DB       Internal APIs

                    |
                    v
                  HITL
             Approve/Edit/Reject
                    |
                    v
                 Resume
                    |
                    v
              Final Response