"""Pipeline configuration and constants."""
import os
from dotenv import load_dotenv

# Load .env.local from pipeline directory, then from app root
_pipeline_dir = os.path.dirname(os.path.abspath(__file__))
_app_dir = os.path.dirname(_pipeline_dir)
load_dotenv(os.path.join(_pipeline_dir, ".env.local"))
load_dotenv(os.path.join(_app_dir, ".env.local"))

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "")
TWELVEDATA_API_KEY = os.environ.get("TWELVEDATA_API_KEY", "")

# Anthropic pricing (per million tokens, USD)
ANTHROPIC_PRICING = {
    "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
    "claude-sonnet-4-6-20250514": {"input": 3.0, "output": 15.0},
}
BATCH_DISCOUNT = 0.5  # 50% off for batch API

# Rate limits
FINNHUB_CALLS_PER_MIN = 60
TWELVEDATA_CALLS_PER_MIN = 8
TWELVEDATA_CREDITS_PER_DAY = 800
