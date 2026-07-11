"""BLOOM — FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.origin_check import CORS_ORIGIN_REGEX
from app.rate_limit import limiter
from app.scheduler.jobs import setup_scheduler, scheduler

# Import routers
from app.routes.auth import router as auth_router
from app.routes.goals import router as goals_router
from app.routes.habits import router as habits_router
from app.routes.urge_logs import router as urge_logs_router
from app.routes.mood_logs import router as mood_logs_router
from app.routes.journal import router as journal_router
from app.routes.insights import router as insights_router
from app.routes.milestones import router as milestones_router
from app.routes.dashboard import router as dashboard_router
from app.routes.garden import router as garden_router
from app.routes.settings import router as settings_router
from app.routes.chat import router as chat_router

# Import WebSocket handler
from app.websocket.chat import chat_websocket_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    # Startup
    await connect_to_mongo()
    setup_scheduler()
    yield
    # Shutdown
    scheduler.shutdown()
    await close_mongo_connection()


app = FastAPI(
    title="BLOOM API",
    description="Life improvement and habit/addiction recovery support API",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiting (slowapi). Routes opt in via @limiter.limit(...).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS middleware. Explicit origins come from FRONTEND_URL / CORS_ALLOWED_ORIGINS
# (set these to your real Vercel domain(s) in production); the regex additionally
# covers local dev (any localhost port) and Vercel preview-deployment subdomains.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(goals_router)
app.include_router(habits_router)
app.include_router(urge_logs_router)
app.include_router(mood_logs_router)
app.include_router(journal_router)
app.include_router(insights_router)
app.include_router(milestones_router)
app.include_router(dashboard_router)
app.include_router(garden_router)
app.include_router(settings_router)
app.include_router(chat_router)


# WebSocket endpoint
@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await chat_websocket_handler(websocket)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "healthy", "app": "BLOOM", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}
