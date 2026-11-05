import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Explicit path to .env inside backend
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
# Use the working service_role key first, or fall back to SUPABASE_KEY
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(f"Supabase credentials missing! URL={bool(SUPABASE_URL)}, KEY={bool(SUPABASE_KEY)}")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)