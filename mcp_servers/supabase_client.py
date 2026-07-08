import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# One shared Supabase client for the whole project. Anything that wants to
# read/write the menu cache imports `supabase` from here instead of making
# its own client — keeps things simple and avoids duplicate connections.
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)