# 🔬 Benchie — From Search Bar to Research Partner

> **BenchSpark Hackathon 2026 | Challenge 7: Co-Investigator | Team: Lazy Coders**

An **agentic AI Research Assistant** that operates like a high-level research intern — decomposing complex biomedical research requests into multi-step, event-driven workflows, tracking task state in Firestore, and interacting with users via Human-in-the-Loop checkpoints before proceeding.

<div align="center">
  <iframe width="720" height="405" src="https://www.youtube.com/embed/IwU3c38XRoo" title="Benchie Demo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

> 📄 **[View Sample AI-Generated Research Report](./Benchie%20Research%20Report.pdf)**

## 🎯 Problem

Modern researchers are overwhelmed by fragmented data across PubMed, OpenAlex, BigQuery, and other databases. Current AI tools provide "one-shot" answers but fail at complex, multi-stage tasks. Benchie moves from being a **calculator** to a **co-investigator** by managing its own task-tracking and combining internal disease data with Gemini's expansive external knowledge.

## ✅ How It Works

1. **Input**: Scientist enters a natural language query
   - _"Find researchers who have published on idiopathic pulmonary fibrosis treatment in the last 3 years"_
2. **AI Planning**: Gemini 2.5 Flash decomposes the query into executable steps. For internal data, it **writes custom GoogleSQL** on the fly.
3. **Plan Review**: User reviews, edits (add/remove/rename steps), and approves
4. **Agentic Execution**: Each step runs tools + a domain-specialist AI agent analyzes the results
5. **HITL Checkpoint**: Agent pauses at least once for human confirmation
6. **Final Report**: Gemini synthesizes findings into a grounded, 7-section markdown report with Google Search Grounding.

## 🏗️ Architecture

```
                    ┌─────────────────────────────────┐
                    │      Next.js Frontend (UI)      │
                    │   PlanReview · TaskTracker ·     │
                    │   EvidenceDashboard · Brief      │
                    └──────────┬──────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌─────────────┐   ┌──────────────┐   ┌───────────────┐
    │ POST /plan  │   │ POST /execute│   │ POST /report  │
    │ Planner     │   │ Tool Runner  │   │ Synthesizer   │
    │ Agent       │   │ + Specialist │   │ Agent         │
    │ (2.5 Flash) │   │ Agents       │   │ (2.5 Flash +  │
    │             │   │ (2.0 Flash)  │   │  Google Search│
    └─────────────┘   └──────┬───────┘   │  Grounding)  │
                             │           └───────────────┘
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   ┌─────────────┐   ┌─────────────┐   ┌────────────────┐
   │  BigQuery   │   │  OpenAlex   │   │    PubMed      │
   │ Dynamic AI  │   │  Author     │   │   E-utilities  │
   │ GoogleSQL   │   │  Search/Get │   │  Search/Fetch  │
   └─────────────┘   └─────────────┘   └────────────────┘
          │                                     │
          ▼                                     ▼
   ┌──────────────────────────────────────────────────┐
   │            Firestore State Engine                 │
   │  Sessions · Step Status · Raw Data Subcollections │
   │              + GCS Artifact Backup                │
   └──────────────────────────────────────────────────┘
```

## ☁️ Google Cloud Services Used

| Service | Why We Used It |
|---------|---------------|
| **Vertex AI (Gemini 2.5 Flash)** | Planner agent and report synthesizer. 2.5 Flash chosen for its structured JSON output and Google Search Grounding capability |
| **Vertex AI (Gemini 2.0 Flash)** | Step-level specialist agents. 2.0 Flash is faster for per-step reasoning, keeping execution latency low |
| **Vertex AI Search** | Grounded retrieval against internal knowledge bases (fallback to Gemini + Google Search) |
| **BigQuery (Dynamic SQL)** | We went beyond hardcoded queries. The Planner Agent **writes real-time GoogleSQL** against the 100GiB Open Targets datasets. The execution engine runs this SQL dynamically, allowing for completely unrestricted, ad-hoc data exploration. |
| **Firestore** | Stateful session management for the agentic pipeline: sessions, step status tracking, HITL checkpoint persistence, raw data subcollections for progressive disclosure |
| **Cloud Storage (GCS)** | Artifact backup for each execution step's raw JSON output |

## 🧬 Multi-Agent Architecture

Not a single-prompt system. Each step in the pipeline has a **domain-specialist agent**:

- **Disease Grounding Specialist** — Analyzes BigQuery/Vertex Search output to identify top targets
- **Research Impact Analyst** — Ranks OpenAlex researchers by relevance, not just h-index
- **Activity Verification Agent** — Cross-references publication timelines to flag rising stars
- **Contact Extraction Agent** — Extracts emails and affiliations from PubMed metadata
- **Cross-Reference Synthesis Agent** — Combines all upstream analyses into target–researcher maps

Each agent passes structured context to the next via a **context chain**, enabling multi-hop reasoning.

## 🛡️ Hallucination Guardrails

- **Google Search Grounding** on the final report synthesis step
- **Data provenance badges** on every evidence card (BigQuery / OpenAlex / PubMed / AI Analysis)
- **Confidence scores** per agent step (HIGH / MEDIUM / LOW)
- **Strict citation rules** — the report prompt forbids fabricating DOIs, PMIDs, emails, or affiliations
- **Source separation** — raw tool data vs. AI-generated analyses are visually distinguished

## ⚡ Performance Impact

By leveraging dynamic BigQuery SQL generation and parallel domain-specialist agents directly inside the data layer, Benchie reduces research time by an order of magnitude. 

In side-by-side testing for a complex deep research task (aggregating authors, publications, and cross-referencing relevant biomedical targets):
- **Standard Deep Research Tools:** ~24 minutes (limited by slow, iterative API pagination)
- **Benchie:** **< 2 minutes** (achieved by pushing compute directly to the database via dynamically generated SQL and parallel agentic processing)

## 🧪 Acceptance Criteria (Challenge 7)

| Requirement | Status |
|---|---|
| Accepts natural language research requests | ✅ |
| Decomposes into 2–3+ executable sub-tasks | ✅ (3–6 steps) |
| Queries pre-loaded BigQuery disease datasets | ✅ (Open Targets + PrimeKG) |
| Maintains basic task state | ✅ (Firestore state engine) |
| HITL checkpoint (pause for user confirmation) | ✅ |
| Structured summary of findings | ✅ (7-section markdown report) |

### Stretch Goals

| Goal | Status |
|---|---|
| Integrate OpenAlex + PubMed APIs | ✅ |
| Session history with full audit trail | ✅ |
| Formatted markdown + PDF export | ✅ |

## 🚀 Quick Start

```bash
# Install
npm install

# Set environment variables
cp .env.local.example .env.local
# Edit .env.local with your GCP project ID

# Authenticate with GCP
gcloud auth application-default login

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter a research query.

## 📂 Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main UI (3-panel layout)
│   └── api/agent/
│       ├── plan/route.ts           # Planner agent
│       ├── execute/route.ts        # Tool executor + specialist agents
│       ├── report/route.ts         # Synthesis agent
│       ├── session/route.ts        # Session retrieval
│       └── sessions/route.ts       # Session history
├── components/
│   ├── PlanReview.tsx              # Editable plan approval UI
│   ├── TaskTracker.tsx             # Live execution tracking
│   ├── EvidenceDashboard.tsx       # Auto-populating evidence cards
│   ├── ResearchBrief.tsx           # Final report with PDF export
│   └── panels/                    # Domain-specific data panels
├── lib/
│   ├── bigquery.ts                # BigQuery query engine
│   ├── openalex.ts                # OpenAlex integration
│   ├── pubmed.ts                  # PubMed E-utilities
│   ├── vertexSearch.ts            # Vertex AI Search
│   ├── vertex/stepAgent.ts        # Specialist agent framework
│   ├── vertex/retry.ts            # Rate limit handling
│   └── firestore/stateEngine.ts   # Session persistence
└── types.ts                       # Shared TypeScript interfaces
```

## 👥 Team

**Lazy Coders** — BenchSpark Hackathon 2026

## 📜 License

MIT
