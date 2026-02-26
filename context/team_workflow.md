# AI-First Team Workflow (20 Hours Remaining)

Since your team has exactly 20 hours and depends entirely on AI coding tools (Antigravity/Cursor), the workflow must be highly parallelized to avoid code conflicts. You will act as "Prompt Engineers" and "Reviewers."

## 1. The GitHub Workflow (CRITICAL)
If multiple AIs edit the same file, you will get merge conflicts. To avoid this, **enforce strict file boundaries**.

1. **Lead (You)** creates the `main` branch with the initial Next.js scaffolding and folder structure.
2. **Everyone** pulls the `main` branch.
3. Each member creates their own branch: `git checkout -b feature/<your-name>`
4. Members use Cursor/Antigravity to build their feature *only in their assigned folders*.
5. When done, they tell the AI: *"Commit these changes with a message and push to my branch."*
6. Members open a Pull Request (PR) on GitHub.
7. **Lead** reviews the PR (or asks the AI to review it) and merges it into `main`.
8. Everyone runs `git checkout main && git pull` before starting a new task.

## 2. Role Assignments & Folder Boundaries

### Role 1: Project Lead & Orchestrator (You - using Antigravity)
**Boundary:** `/src/app/api/agent`, `/src/lib/gcp`, `/package.json`
- **Goal:** Set up the Next.js project, handle GCP authentication, and build the Vertex AI Agent logic.
- **Your Prompting Strategy:** 
  > "**CRITICAL FIRST STEP:** Read `shared_context.md`. Use the `ResearchSession` and `SubTask` DTOs."
  > "Initialize the Next.js project, write a script to authenticate with GCP Application Default Credentials, and set up the Vertex AI Agent Builder SDK to orchestrate the `SubTasks`."
- **Management Focus:** Merge PRs from the other 3 members. If there's a conflict, tell the AI: *"Fix the merge conflicts in this file."*

### Role 2: Backend/API Developer (Using Cursor)
**Boundary:** `/src/app/api/tools`, `/src/lib/bigquery`, `/src/lib/openalex`
- **Goal:** Build internal API routes that fetch data from BigQuery and OpenAlex.
- **Your Prompting Strategy (Give this to Member 2):** 
  > "**CRITICAL FIRST STEP:** Read `shared_context.md` to see the exact TypeScript interfaces you must return."
  > "Build a Next.js App Router API route at `/api/tools/bigquery` that uses the `@google-cloud/bigquery` SDK, fetches data from the Open Targets dataset, and returns JSON matching the `BigQueryDiseaseResponse` interface. Handle all errors gracefully."

### Role 3: Frontend/UI Developer (Using Cursor)
**Boundary:** `/src/components`, `/src/app/page.tsx`, `/src/styles`
- **Goal:** Build the Chat UI, the Task Tracker, and the Research Brief visualization without touching the backend logic. Provide them mock JSON data to work with initially.
- **Your Prompting Strategy (Give this to Member 3):**
  > "**CRITICAL FIRST STEP:** Read `shared_context.md` to see the exact state structures you must expect."
  > "Build a responsive, modern Chat Interface in Next.js using TailwindCSS. Also build a right-hand sidebar that visualizes a list of `SubTask` objects. Use mock data matching those interfaces. Make it look like a premium enterprise AI tool. Do NOT write any actual API fetching logic yet."

### Role 4: Scientific Evaluator & Prompt Engineer (Using ChatGPT/Cursor)
**Boundary:** No code writing. Focus on `/docs`, Prompts, and Testing.
- **Goal:** Define the system prompt for the Agent, write the demo script, and verify the biological accuracy of the outputs.
- **Your Prompting Strategy (Give this to Member 4):**
  > "**CRITICAL FIRST STEP:** Read `shared_context.md`. You dictate how the Agent fills out the `SubTask` object."
  > "Act as a Preclinical Scientist. We are building an AI agent that queries BigQuery and PubMed to research IPF progression. Write a robust System Prompt for the AI that tells it how to act, what steps to take (Planner -> Search -> Checkpoint -> Report), and what scientific details to extract." 
  Take the prompt they generate and give it to the Lead (Role 1) to inject into the code.

## 3. The 20-Hour Sprint Timeline

| Time Remaining | Activity |
| :--- | :--- |
| **Hours 20-18** | **Setup:** Lead uses Antigravity to init project, push to GitHub. Everyone clones, checks out branches. |
| **Hours 18-12** | **Parallel Build:** Frontend explicitly uses mock data; API lead builds BigQuery logic; Agent lead wires up Vertex AI with dummy tool responses. |
| **Hours 12-8** | **Integration:** API lead finishes. Frontend lead replaces mock data with real API calls. Agent lead connects the Vertex AI loop to the real APIs. |
| **Hours 8-4** | **Testing & HITL:** Complete the Human-in-the-Loop checkpoint logic. Evaluator tests the system with real biological queries. Fixing bugs via AI prompting. |
| **Hours 4-0** | **Demo Prep:** Record the 3-minute demo video. Freeze all code. Write the GitHub Readme (using AI). Submit. |

By strictly enforcing **Folder Boundaries**, your AI tools (Cursor/Antigravity) will not overwrite each other's code, preventing the team from getting stuck in "git hell."
