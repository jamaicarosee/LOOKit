import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load local .env without overriding Render environment variables
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=False)

SUPABASE_URL = os.getenv("SUPABASE_URL")

SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Missing Supabase credentials. "
        "Check your environment variables."
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)