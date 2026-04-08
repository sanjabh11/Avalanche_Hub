# Avalanche Hub Deployment Guide

This application is a full-stack React/Express app designed for avalanche risk prediction.

## Public Deployment Options

To make this app accessible to external tools like Perplexity and avoid 403 errors:

### 1. AI Studio "Deploy to Cloud Run" (Recommended)
The easiest way to get a public URL is to use the built-in deployment feature:
1. Click the **Deploy** button in the AI Studio header.
2. Select **Cloud Run**.
3. Follow the prompts to deploy. This will give you a permanent `run.app` URL that is publicly accessible.

### 2. AI Studio "Share"
If you just want a quick public link:
1. Click the **Share** button in the AI Studio header.
2. Enable sharing.
3. Use the provided **Shared App URL**.

### 3. Manual Firebase Hosting / Cloud Functions
If you prefer to use your own Firebase project:
1. Ensure `firebase-applet-config.json` is correctly configured with your project details.
2. The `firestore.rules` have already been deployed to your project via the `deploy_firebase` tool.
3. You can use the Firebase CLI to deploy the frontend to Hosting and the backend to Cloud Functions.

## Environment Variables
Ensure the following secrets are set in your production environment (Cloud Run / Firebase Secrets):
- `GEMINI_API_KEY`: Your Google AI Studio API key.
- `NEWSDATA_API_KEY`: Your NewsData.io API key.
- `FIREBASE_SERVICE_ACCOUNT`: (Optional) If using `firebase-admin` for server-side operations.

## Testing from Perplexity
Once you have your public URL (e.g., `https://avalanche-hub-xxxx.a.run.app`), you can point Perplexity to it. The 403 error you encountered is expected for the internal development URL, but the public URL will allow external access.
