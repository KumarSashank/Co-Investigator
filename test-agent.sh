#!/bin/bash
# test-agent.sh
# A simple script to test your Agent's API routes locally without needing the Frontend UI yet.

echo "============================================="
echo "   Testing Co-Investigator Agent API"
echo "============================================="

echo "1. Testing the Planner (Calling Vertex AI Gemini 1.5 Pro)..."
echo "Query: 'Find experts on IPF treatments'"
echo ""

# Store the response
RESPONSE=$(curl -s -X POST http://localhost:3000/api/agent/plan \
  -H "Content-Type: application/json" \
  -d '{"query": "Find experts on IPF treatments"}')

echo "Response from your App Server (which called Vertex AI):"
echo $RESPONSE | pcregrep -o '(?<="plan":)\[.*\]' || echo $RESPONSE

# Extract the sessionId
SESSION_ID=$(echo $RESPONSE | pcregrep -o '(?<="sessionId":")[^"]+')

if [ -z "$SESSION_ID" ]; then
  echo ""
  echo "❌ Error: Could not get a session ID. Is Firebase configured or did the Vertex call fail?"
  exit 1
fi

echo ""
echo "✅ Successfully created session: $SESSION_ID"
echo ""

echo "2. Simulating the Agent picking up the first task from the plan..."
echo "Executing task 1 (Assuming your AI plan generated 'step-1' or similar)..."

# Note: In a real flow, you parse the plan array from the response above and use the dynamic ID.
# For this test, we assume the AI creates a task with an ID structure you can inspect.
echo "To test execution further, please review the raw Response above, find a task 'id', and run:"
echo "curl -X POST http://localhost:3000/api/agent/execute -H \"Content-Type: application/json\" -d '{\"sessionId\": \"$SESSION_ID\", \"taskId\": \"<TASK_ID_HERE>\"}'"
echo "============================================="
