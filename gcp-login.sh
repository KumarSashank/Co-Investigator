#!/bin/bash
# GCP Local Authentication Script
# Run this script to log into your Google Cloud account so the Next.js app 
# can use Vertex AI and BigQuery locally.

echo "====================================================="
echo "  Co-Investigator - Google Cloud Local Authentication"
echo "====================================================="

echo "Checking for gcloud CLI..."
if ! command -v gcloud &> /dev/null
then
    echo "❌ gcloud CLI could not be found."
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi
echo "✅ gcloud CLI found."

# Prompt for the Hackathon Project ID
echo ""
echo "Please enter the GCP Project ID assigned to your team for the hackathon."
echo "(e.g., benchspark-team-123)"
read -p "Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]
then
    echo "Project ID cannot be empty. Exiting."
    exit 1
fi

echo ""
echo "Setting active project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

echo ""
echo "====================================================="
echo "  Action Required:"
echo "  A browser window will open shortly."
echo "  1. Log in with the Google account associated with the hackathon."
echo "  2. Allow the Google Cloud SDK access."
echo "====================================================="
echo ""
read -p "Press [Enter] to open the browser and log in..."

# Authenticate ADC (Application Default Credentials)
# This is what @google-cloud/vertexai and @google-cloud/bigquery use by default in Node.js
gcloud auth application-default login --project=$PROJECT_ID

echo ""
echo "✅ Authentication Complete!"
echo "Your Next.js API routes will now automatically use these credentials."
echo "You can start the environment with: npm run dev"
