# 🌱 BLOOM — Life Improvement & Recovery

A full-stack web application for personal growth, habit tracking, addiction recovery support, mood monitoring, journaling with sentiment analysis, guided breathing exercises, an emotional support chatbot, and an AI-powered insights engine.

> **Disclaimer**: BLOOM is a support tool, not a substitute for professional mental health care. If you're in crisis, call India's national 24/7 mental health helpline **Tele MANAS at 14416** or the **KIRAN helpline at 1800-599-0019**.

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI (Python), async endpoints, Pydantic v2 |
| **Frontend** | React (Vite), React Router, Zustand |
| **Database** | MongoDB Atlas (Motor async driver) |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Chat** | WebSocket (FastAPI), Groq LLM (Llama 3.3 70B) |
| **Sentiment** | VADER (NLTK) |
| **Insights** | APScheduler nightly job |
| **Charts** | Recharts |

## Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Groq API key ([console.groq.com](https://console.groq.com))

## Setup

### 1. Clone and configure environment

```bash
cd backend
copy .env.example .env
# Edit .env with your values:
#   MONGODB_URL=mongodb+srv://...
#   GROQ_API_KEY=gsk_...
#   JWT_SECRET=your-random-secret
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

# Download VADER lexicon (auto-downloads on first run, but you can pre-download):
python -c "import nltk; nltk.download('vader_lexicon')"

# Seed sample data (optional)
python seed.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

The API docs are available at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: [http://localhost:5173](http://localhost:5173)

### 4. Test credentials (after seeding)

| Email | Password |
|---|---|
| alex@example.com | password123 |
| sam@example.com | password123 |

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `MONGODB_URL` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net` |
| `DATABASE_NAME` | Database name | `bloom` |
| `JWT_SECRET` | Secret key for JWT signing | Random string, 32+ chars |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `7` |
| `GROQ_API_KEY` | Groq API key | `gsk_...` |
| `GROQ_MODEL` | Groq model name | `llama-3.3-70b-versatile` |
| `GOOGLE_CLIENT_ID` | Google OAuth Web client ID (enables Google sign-in; leave blank to disable) | `...apps.googleusercontent.com` |
| `FRONTEND_URL` | Frontend URL (CORS) | `http://localhost:5173` |

The frontend also reads `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` from `frontend/.env` (see `frontend/.env.example`). Set `VITE_GOOGLE_CLIENT_ID` to the **same** value as the backend's `GOOGLE_CLIENT_ID`, and add `http://localhost:5173` as an authorized JavaScript origin in the Google Cloud console.

## Features

- **🔐 Auth**: Signup/login with JWT refresh flow, **Google sign-in (OAuth)**, show/hide password toggle. Refresh tokens are **revocable** — logout and password changes invalidate every outstanding session. Login/signup and AI endpoints are **rate-limited** to prevent brute-force and abuse.
- **🎯 Daily Goals**: CRUD, monthly completion grid, streak tracking, heatmap
- **💪 Habit Tracker**: Track habits, log urges (intensity 1-10, trigger tags), sobriety counter that only resets on actual relapses (resisting an urge never penalizes you), AI-generated supportive relapse messages
- **😊 Mood Check-ins**: Daily mood score with emoji feedback, tags, notes
- **📝 Journal**: Free-text entries with automatic VADER sentiment analysis, full-text search, writing prompts, expandable entries, delete
- **💬 Chat**: WebSocket-based AI companion (Groq/Llama), crisis detection, multiple named conversations
- **🌬️ Breathe**: Guided breathing exercises (Box, 4-7-8, Simple Deep) with an animated pacer for riding out urges and stress
- **🔮 Insights**: AI-generated insights from your data (mood trends, goal rates, urge patterns) — generated nightly or on demand with the "Generate Now" button
- **📊 Dashboard**: Daily affirmation, growing-plant progress visual, today's goals, streaks, mood trend chart, latest insights
- **⚙️ Settings**: Profile personalization, change password, full data export (JSON), permanent account deletion
- **🌗 Dark Mode**: Toggle between light and dark themes from the sidebar, mobile header, or auth pages — your choice is remembered

## API Endpoints

Visit `/docs` on the running backend for full OpenAPI documentation.

| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/signup`, `/login`, `/google`, `/verify-email`, `/resend-verification`, `/refresh`, `/logout` |
| Goals | `GET/POST /api/goals`, `PUT/DELETE /api/goals/{id}`, `POST /api/goals/{id}/complete`, `POST /api/goals/{id}/toggle-date`, `GET /api/goals/stats/monthly` |
| Habits | `GET/POST /api/habits`, `DELETE /api/habits/{id}`, `POST /api/habits/{id}/relapse` |
| Urge Logs | `GET/POST /api/urge-logs` |
| Mood Logs | `GET/POST /api/mood-logs` |
| Journal | `GET /api/journal?q=search`, `POST /api/journal`, `DELETE /api/journal/{id}` |
| Insights | `GET /api/insights`, `POST /api/insights/generate` |
| Dashboard | `GET /api/dashboard` |
| Settings | `GET /api/settings/export`, `DELETE /api/settings/account`, `PUT /api/settings/profile`, `PUT /api/settings/password` |
| Chat | `GET /api/chat/sessions`, `PUT /api/chat/sessions/{id}/rename`, `DELETE /api/chat/sessions/{id}` |
| WebSocket | `WS /ws/chat` |

## Project Structure

```
BLOOM/
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app
│   │   ├── config.py           # Settings
│   │   ├── database.py         # MongoDB connection
│   │   ├── auth/               # JWT, hashing, dependencies
│   │   ├── models/             # Pydantic models
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # Sentiment, crisis, LLM, insights
│   │   ├── websocket/          # Chat WebSocket handler
│   │   └── scheduler/          # APScheduler jobs
│   ├── seed.py                 # Sample data seeder
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Routes
│   │   ├── index.css           # Design system
│   │   ├── api/                # Axios client, endpoints
│   │   ├── store/              # Zustand
│   │   ├── components/         # Layout, ProtectedRoute, CrisisDisclaimer, OnboardingModal
│   │   ├── pages/              # All 10 pages (incl. Breathe)
│   │   └── utils/              # Constants, helpers
│   └── package.json
└── README.md
```

## Deployment

The backend (FastAPI + WebSocket + APScheduler) needs a persistent process, so it's deployed to **Render**; the frontend (static Vite build) goes to **Vercel**.

### Backend → Render

1. Push this repo to GitHub (see checklist below).
2. In Render, **New → Blueprint**, point it at the repo. It reads [`render.yaml`](render.yaml) at the repo root and creates a `bloom-api` web service automatically (root dir `backend`, correct build/start commands, VADER lexicon pre-downloaded at build time).
3. Fill in the env vars Render prompts for (marked `sync: false` in `render.yaml`): `MONGODB_URL`, `GROQ_API_KEY`, `GOOGLE_CLIENT_ID`, `BREVO_API_KEY`, `FROM_EMAIL`, `FRONTEND_URL` (your Vercel URL — you can circle back and fill this in after deploying the frontend). `JWT_SECRET` is auto-generated by Render; everything else has a sensible default already in the file.
4. Deploy. Confirm `https://<your-service>.onrender.com/health` returns `{"status":"ok"}`.

**Free-tier caveat**: Render's free plan spins the service down after ~15 minutes idle. That's fine for on-demand API requests (it wakes on the next request, ~30–50s cold start), but the nightly-insights/weekly-review APScheduler jobs won't fire if the service is asleep at 2am/Monday-6am UTC. Either upgrade to a paid "Starter" instance (always on), or set up a free uptime pinger (e.g. [cron-job.org](https://cron-job.org) or UptimeRobot) hitting `/health` every ~10 minutes to keep it awake.

### Frontend → Vercel

1. In Vercel, **New Project** → import the same repo.
2. Set **Root Directory** to `frontend` (Vercel auto-detects the Vite framework preset from there).
3. Add environment variables: `VITE_API_URL` = your Render backend URL (e.g. `https://bloom-api.onrender.com`), and `VITE_GOOGLE_CLIENT_ID` (same value as the backend's `GOOGLE_CLIENT_ID`).
4. Deploy. [`vercel.json`](frontend/vercel.json) rewrites all routes to `index.html` so React Router's client-side routes (e.g. `/dashboard`, `/verify-email`) work on direct load/refresh.
5. Go back to Render and set `FRONTEND_URL` to your final `https://<project>.vercel.app` URL, then redeploy the backend so CORS allows it.

### Google OAuth — production origins

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), edit your OAuth 2.0 Web client and add your **production** Vercel URL to **Authorized JavaScript origins** (e.g. `https://bloom-app.vercel.app`) — the `http://localhost:5173` entry you used for dev won't work in production.

## Safety & Privacy

- 🚫 No streak-shaming or guilt-tripping mechanics
- 💛 Crisis detection surfaces hotline resources immediately in chat
- 🔒 All sensitive collections require authentication
- 📦 Users can export all data or fully delete their account
- 🤖 The chatbot explicitly disclaims it is NOT a therapist
