# Co-Investigator Plan to Win Challenge 7 at BenchSpark

## Challenge framing and what “winning” looks like in this room

Challenge 7 asks you to build an **agentic AI research assistant** that behaves like a **high-level research intern**: it should break a complex request into **2–3 executable sub-tasks**, call **BigQuery** disease/research datasets, maintain **task state**, and include at least one **human-in-the-loop (HITL)** checkpoint before continuing; the assistant must end with a **structured summary** of what it found and what it did. citeturn7view0

BenchSpark’s published constraints strongly shape what judges will consider “real” (and therefore feasible/scalable):

- Use **public datasets and sources** (curated datasets are provided; teams can also bring public data). citeturn7view0  
- Run in a **cost-capped ephemeral GCP environment** and **save/export before it expires**. citeturn7view0  
- There is an explicit architectural preference: **“Architect your solution with MCP servers (one or more) to encapsulate task-specific functionality.”** citeturn7view0  

To win, your demo has to communicate (quickly and convincingly) that you built something aligned with how entity["company","BenchSci","life science ai company"] thinks about product value: evidence-backed, multi-hop, grounded, and usable by preclinical scientists. BenchSci positions itself around unraveling disease biology and building a “co-pilot” experience powered by an evidence knowledge graph, emphasizing traceability and reducing hallucinations via an “evidence backbone.” citeturn4search0turn4search1  

A winning submission therefore needs three things simultaneously:
1. **Agentic behavior you can see** (visible planning, state, checkpoints, tool calls).
2. **Evidence trust** (citations/links, grounded claims, and a “why this is true” UI).
3. **BenchSci relevance** (feels like an “ASCEND-style workflow,” even if you only use public data). citeturn4search0turn4search1  

## The winning product concept: a “Research Brief + Expert Map” that feels like a real intern

### Core user promise
**From one natural-language prompt → to a reusable, stateful “Research Brief” artifact.** The output is not “an answer,” it’s a **work product** with:
- A traceable disease context snapshot (from knowledge graph / disease dataset),
- A ranked list of active experts with clear criteria (“activity level”),
- A next-step menu where the user explicitly approves deeper dives (HITL). citeturn7view0  

### Your USP (make this your headline)
**“Evidence-first, stateful, multi-source co-investigation—measured with grounding scores.”**

What makes that novel (and judge-friendly) is that you can **prove quality** rather than asserting it:
- Use a grounding/evidence check to show the report is actually supported by retrieved facts (see “Benchmarking” section). citeturn12search4turn4search1

### The “intern-like” interaction loop you should demo
Use a strict 2–3 step “planner pattern” that is visible to the user (on screen), and then combine it with a ReAct-style tool loop internally:

1) **Understand & plan (visible)**  
   - The agent restates the request, proposes 2–3 sub-tasks, and asks the user to confirm or edit.  
   - This matches how ReAct interleaves reasoning and tool actions for better interpretability and robustness. citeturn2search2  

2) **Execute step 1: internal dataset query (BigQuery / KG)**  
   - Example: “Pull IPF progression concepts, key mechanisms, target/disease associations, and any evidence counts.”  
   - This immediately ties you to BenchSci’s “map of disease biology” narrative (but using public data). citeturn4search1turn5search2  

3) **HITL checkpoint (mandatory, make it feel powerful)**  
   - “I found 12 candidate researchers and 3 mechanistic clusters. Do you want me to:  
     (a) rank experts by activity + influence,  
     (b) map collaborator networks,  
     (c) draft outreach-ready notes + links to profiles?” citeturn7view0  

4) **Execute step 2: external bibliometrics + recency**
   - Pull publications and author metrics from entity["organization","OpenAlex","open scholarly metadata"] and recency/biomed indexing from entity["organization","PubMed","biomedical literature database"]. citeturn13search3turn14search0turn0search2  

5) **Deliver an artifact**
   - A structured “Research Brief” with citations and a task trail (“what steps the agent took”).  
   - This mirrors how serious tools emphasize traceability (a BenchSci differentiator). citeturn4search1  

## Architecture on Google Cloud that hits the rubric and the MCP requirement

You’re already committed to entity["company","Google Cloud","cloud computing platform"] and Vertex AI Agent Builder; the winning move is to design it so judges can see you built something scalable—not a notebook demo.

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["Vertex AI Agent Builder overview diagram","Vertex AI Agent Engine diagram","Model Context Protocol MCP architecture diagram","Cloud Firestore logo"],"num_per_query":1}

### Recommended “minimum impressive” architecture
**Agent layer**
- Use **Vertex AI Agent Builder** to build/deploy agents via the workflow: Agent Garden → Agent Development Kit (ADK) → Agent Engine deployment. citeturn1search1turn2search7turn2search6  
- Use **Agent Engine tracing** so you can show spans/timelines of tool calls in your demo (this looks very “production-grade”). citeturn12search1  

**Tooling layer (this is where you satisfy MCP)**
- Implement **MCP servers** as small, single-responsibility services (Cloud Run is the fastest option). BenchSpark explicitly calls for encapsulating functionality in MCP servers. citeturn7view0  
- MCP is an open protocol designed to standardize how apps connect LLMs to tools/data sources (client-server model; servers can be remote services). citeturn8search0turn8search2turn8search1  

A simple MCP breakdown that fits Challenge 7 perfectly:
- **mcp-bigquery**: executes parameterized SQL templates and returns structured JSON + provenance.  
- **mcp-kg**: graph expansion/multi-hop traversals (even if your “graph” is a small subset).  
- **mcp-openalex**: fetches works/authors + counts_by_year + cited_by_count (for “activity level”). citeturn13search3turn13search0turn0search2  
- **mcp-pubmed**: E-utilities queries constrained to date ranges for “last 3 years.” citeturn14search0turn14search3  
- **mcp-report**: renders a markdown brief and (stretch) exports PDF.

**Retrieval / grounding layer**
- Use **Vertex AI Search** as your retrieval layer over BigQuery (structured) or Cloud Storage (unstructured). Google’s docs describe creating data stores and connectors, including BigQuery connectors and operational tradeoffs (sync frequency, connector behavior). citeturn1search0turn1search6  
- Add a measurable trust signal by using **Vertex AI Search “check grounding”**: it outputs an overall support score (0–1) and citations to facts supporting claims. citeturn12search4turn12search5  

**State layer**
- Use **Firestore** for explicit task state: it supports transactions with “all-or-nothing” semantics and consistent reads, which is ideal for avoiding partial task updates (especially if the user edits the plan mid-run). citeturn1search7  
- Optionally combine with Agent Engine Sessions/Memory Bank:
  - Sessions are designed to store interaction history/events and state for longer context. citeturn15search4turn15search6  
  - Memory Bank can store/retrieve longer-term memories after deployment. citeturn2search0turn2search1  
  For the hackathon, Firestore alone is enough, but referencing Sessions/Memory Bank in your “future scalability” slide can score feasibility points. citeturn15search4turn2search0  

**Safety layer (quietly wins points)**
- Add **Model Armor** screening on prompts/responses to reduce sensitive data leakage and prompt injection risks—this is a strong “production hygiene” signal, especially in biomedical contexts. citeturn2search3turn2search4  

### Public data strategy for disease/KG queries in BigQuery
You will likely have curated datasets from the event, but it’s powerful to show you can integrate a well-known public biomedical KG quickly.

A practical option: entity["organization","Open Targets Platform","target-disease evidence portal"] provides a **BigQuery public dataset** and explicitly supports advanced queries in BigQuery for systematic workflows. citeturn5search2turn5search0  

This gives you a clean story: “Internal disease snapshot comes from KG evidence tables; external recency and influence comes from literature APIs.”

### External API gotchas you must design around
These aren’t details—they are “gotchas that break demos,” so handling them gracefully is a competitive advantage:

- **OpenAlex now requires an API key (effective Feb 13, 2026)**; without a key you’re limited to 100 credits/day (demo-only), while a free key provides 100,000 credits/day (and max 100 req/s). Because your hackathon occurs Feb 26–27, 2026, you should treat an API key as mandatory. citeturn0search2  
- **OpenAlex author fields are partially precomputed** (works_count, cited_by_count, counts_by_year), and OpenAlex notes these can be stale; for “most up to date” counts, you should run a works search filtered by author. That nuance lets you build a more credible “activity level” calculation. citeturn13search2  
- **NCBI E-utilities rate etiquette** is commonly referenced (e.g., limiting requests per second); building a throttling/retry wrapper helps ensure you don’t get blocked during your demo. citeturn0search6turn14search1  

## Fast-paced development flow for a team of four

BenchSpark’s public timeline says the hackathon runs **Feb 26–27** with submissions due **Feb 27 at 1pm EST**, and the ephemeral environment expires **Mar 6 at 9pm EST**. citeturn7view0  
Given today is Feb 26 (Toronto), you must optimize for “demo robustness” by tomorrow early afternoon.

### Team roles that maximize parallelism
- **Member A (Agent + orchestration lead):** ADK agent, planner pattern, HITL checkpoint logic, tool calling, tracing. citeturn1search1turn12search1  
- **Member B (Data/KG lead):** BigQuery schema discovery, Open Targets or provided KG queries, create Vertex AI Search data store/connector if used. citeturn5search2turn1search0  
- **Member C (External APIs + scoring lead):** OpenAlex + PubMed wrappers with throttling, “activity level” score definition, author/entity resolution. citeturn0search2turn14search0turn13search3  
- **Member D (Frontend + demo + evaluation):** simple UI, task checklist view, report rendering/export, grounding score visualization, video script and capture. citeturn12search4  

### A realistic build schedule that ships
**Day 1 (today): make it run end-to-end**
- Build the visible planner (2–3 steps) + Firestore task document model (“pending / running / done / blocked”). citeturn1search7  
- Implement two MCP servers first (BigQuery + PubMed or BigQuery + OpenAlex) and prove the agent can call them. citeturn7view0turn8search0  
- Hardcode one flagship query path (IPF progression) and ensure it’s resilient.

**Day 2 (tomorrow morning): make it impressive**
- Add the HITL checkpoint and at least one “choice” branch so the user feels in control. citeturn7view0  
- Add grounding score output (even if it’s one button: “Check grounding”). citeturn12search4  
- Turn on tracing and show the trace timeline (this is a killer judge-facing artifact). citeturn12search1  
- Record the demo video early (before last-minute instability).

### What to cut (to protect the demo)
Avoid risky scope that tends to fail under hackathon time:
- Full PDF ingestion and long-context full-text extraction (unless already available and easy).
- Complex UI polish (keep it clean, not fancy).
- Any attempt to “infer emails” or scrape personal info (also risky from a privacy standpoint).

## Benchmarking and proof: how you demonstrate you’re better than a one-shot chatbot

A practical judging strategy is to show **measurable quality** under time constraints—this is the difference between “cool demo” and “winner.”

### Benchmarks you can complete in hackathon time
**Agent behavior benchmark**
- Success rate over 10 test queries: does it always produce a 2–3 step plan, run tools, pause once for HITL, and generate a structured brief?
- This aligns with research showing agent evaluation matters because agent failures often come from long-horizon reasoning and decision making. citeturn3search0  

**Grounding benchmark (your strongest differentiator)**
- For each generated brief, run Vertex AI Search “check grounding.”
- Display:
  - overall support score (0–1)
  - per-claim support (if you wire claim-level scoring)  
This is a rare “hard metric” for LLM outputs in hackathon demos, and the API explicitly provides citations to the supporting facts. citeturn12search4turn12search5  

**Expert-finding benchmark**
Define a simple “gold set” for 2–3 diseases (IPF, Alzheimer’s, RA):
- Gold set = top authors by (a) PubMed recency + (b) OpenAlex cited_by_count / counts_by_year.  
OpenAlex exposes author-level counts_by_year and cited_by_count; PubMed ESearch supports date constraints via datetype/mindate/maxdate (or equivalent query filters). citeturn13search3turn14search0  

Then quantify:
- overlap@10 between your ranked experts and gold list
- time-to-result (latency)
- number of tool calls (efficiency)

### Show-the-work instrumentation (creates judge confidence)
- Enable Agent Engine tracing and show one trace in the demo: “user request → plan → BigQuery → OpenAlex/PubMed → checkpoint → report.” citeturn12search1  
- Track API failures/retries and show stability (“We handle rate limits and continue.”). citeturn0search2turn0search6  

## Competitor analysis and how you position your entry as the “BenchSci-aligned” winner

### Competitors outside the hackathon (what judges already know)
entity["company","Elicit","ai research assistant"] is explicitly built around guiding users through multi-step research workflows (systematic reviews), including step-by-step screening and a final report, with support/verification features. citeturn3search2turn3search4turn3search5  
entity["organization","Semantic Scholar","academic search engine"] offers AI-powered discovery features like personalized recommendation feeds to help users stay up-to-date. citeturn3search9  

So you **should not** position your product as “a better literature search.” That’s not credible in 48 hours.

### What hackathon teams will likely build (your real competitors)
Most teams targeting Challenge 7 will ship some variation of:
- A chat UI + a single BigQuery query + a summary
- Maybe OpenAlex/PubMed calls, but without real state, checkpoints, or evaluation
- Minimal provenance and no measurable trust scoring

### Your winning positioning
You win by being the team that delivers **a production-shaped agent** aligned with BenchSci’s ethos:

1) **Evidence-first**: citations everywhere + grounding score displayed (not just promised). citeturn12search4turn4search1  
2) **Stateful**: clear task checklist with “completed vs pending,” persisted in Firestore transactions. citeturn1search7  
3) **Agentic and interactive**: visible plan, real HITL checkpoint, branching workflow. citeturn2search2turn7view0  
4) **MCP-native architecture**: you explicitly meet the published “MCP servers” architecture instruction, which very few teams will execute cleanly under time pressure. citeturn7view0turn8search0turn8search2  
5) **BenchSci story fit**: you show disease biology context + expert network + next actions—exactly the “co-pilot for preclinical organizations” narrative BenchSci sells. citeturn4search0turn4search1  

If you want a single tagline that sounds like a winning pitch in this specific room:
**“Co-Investigator turns a search prompt into an evidence-grounded research brief with measurable grounding, stateful workflows, and an expert activity map—built as composable MCP tools on GCP.”** citeturn7view0turn12search4turn8search0turn1search1