### **Challenge 7**

## **Co-Investigator — From Search Bar to Research Partner**

**Challenge Statement**  
Build an agentic AI Research Assistant that operates like a high-level research intern—decomposing complex research requests into multi-step, event-driven workflows, tracking task state, and interacting with users to confirm next steps before proceeding. It identifies key researchers in a field, determines their current activity level, finds contact information, and synthesizes disease data with external sources to create comprehensive reports. The agent should be interactive, pausing to ask, "I’ve found this data—would you like me to research the lead scientists next?"

**The Problem**  
Modern researchers are overwhelmed by fragmented data across various databases. Current AI tools often provide "one-shot" answers but fail at complex, multi-stage tasks like network analysis or tracking the progression of a research project over time. We need a system that moves from being a "calculator" to a "co-investigator" by managing its own task-tracking and combining internal disease data with Gemini’s expansive external knowledge.

**Your Task**  
Create an agentic research assistant that:  
✅ Accepts natural language research requests (e.g., "Find experts in IPF progression")  
✅ Decomposes requests into 2-3 executable sub-tasks using a simple planner pattern  
✅ Queries the pre-loaded disease/research datasets in BigQuery  
✅ Maintains basic task state (tracking completed vs. pending steps)  
✅ Implements at least one Human-in-the-Loop checkpoint that pauses for user confirmation before proceeding  
✅ Returns a structured summary of findings

**Recommended datasets**  
✅ Knowledge Graph datasets

**External APIs to Integrate:**  
OpenAlex (researcher citations and publications)  
PubMed (publication activity and recency)

**Recommended Services**  
✅ Vertex AI Agent Builder: To orchestrate agentic loops and manage ReAct (Reasoning and Acting) patterns  
✅ Vertex AI Search: For grounding agent responses in the provided datasets  
✅ Firestore: For the task-tracking system to maintain state across multi-step assignments

---

**Suggested Acceptance Criteria**  
*Teams should define their own acceptance criteria and provide a rationale. Here is guidance:*

**Your system should enable a scientist to:**

1. Submit a request: "Find researchers who have published on idiopathic pulmonary fibrosis (IPF) treatment in the last 3 years"  
2. Verify task decomposition: The agent should break this into visible sub-tasks (e.g., query disease data → identify publications → find authors → assess activity)  
3. Confirm HITL checkpoint: The agent pauses at least once to ask for user input before proceeding (e.g., "I found 12 researchers. Should I pull their recent publication counts?")  
4. Review final output: The agent returns a structured summary that includes the data retrieved and the steps it took to get there

**Stretch Goals (if time permits)**

* Integrate external APIs (OpenAlex or PubMed) for researcher identification  
* Add richer task-tracking with full history and rollback capability  
* Generate formatted PDF or markdown research reports

MVP would be to show a simple agentic AI workflow with only 2-3 steps that still have the Reasoning-Act-Observation workflow in each step of the process. The steps should use different data sources to show the agent's ability to provide value in a comprehensive way that cannot be solved with a single query/question.  
