# Reforged — AI Fitness Coach

AI-powered fitness app that builds personalized workout and nutrition programs. Answer a questionnaire, get a complete training program with injury-safe exercises, set-by-set tracking, food logging, daily check-ins, and an AI coach — all adapting to your schedule, equipment, and goals.

## Stack

- **Frontend:** React + Vite
- **Backend:** Vercel Serverless Functions
- **AI:** Claude API (Sonnet)
- **Storage:** localStorage

## Setup

```bash
npm install
npm run dev
```

## Deploy

1. Push to GitHub
2. Import on Vercel
3. Set Framework to "Other"
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Root Directory: leave blank
7. Add `ANTHROPIC_API_KEY` environment variable
8. Deploy
