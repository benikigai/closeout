"""SubQ Snap 1.1 client. One forward pass, up to 128 typed questions.
Keys load from the 1Password .env pipe in this folder. Values never print."""
import os, httpx

ENVF = os.path.join(os.path.dirname(__file__), "..", ".env")
URL = "https://api.subq.ai/v1/systemone"

def _key():
    if os.environ.get("SUBQ_API_KEY"):
        return os.environ["SUBQ_API_KEY"]
    with open(ENVF) as f:
        for line in f:
            if line.startswith("SUBQ_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("SUBQ_API_KEY missing")

def decide(state, questions, timeout=30.0):
    r = httpx.post(URL, headers={"Authorization": f"Bearer {_key()}",
                                 "Content-Type": "application/json"},
                   json={"model": "subq-snap-1.1", "state": state, "questions": questions},
                   timeout=timeout)
    r.raise_for_status()
    return r.json()
