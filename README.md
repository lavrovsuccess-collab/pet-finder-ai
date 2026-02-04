<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1MeNuwLFyHsS9RNAXng6igfKcPzwhGNbx

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env` file with required API keys:
   - **`VITE_OPENROUTER_API_KEY`** — your API key from [OpenRouter](https://openrouter.ai/keys)
   - **`VITE_FIREBASE_API_KEY`** and other Firebase config variables
3. Run the app:
   `npm run dev`
4. **Deploy to Vercel:** Add all environment variables in Settings → Environment Variables (Production, Preview, and Development), then redeploy.