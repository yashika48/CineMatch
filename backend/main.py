"""
Movie recommender backend — serves recommendations from the trained two-tower
item embeddings.

Design: a user picks a few movies they like. We build a "taste vector" by averaging
the embeddings of those movies, then return the nearest item embeddings. This means the
app works for ANY user (no cold-start) — the same trick real onboarding recommenders use.
"""

import json
import numpy as np
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Movie Recommender")

# allow the Next.js frontend (localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- load the trained artifacts once at startup ----
MODEL_DIR = Path(__file__).parent / "model"

item_embeddings: np.ndarray = None   # (n_items, dim), L2-normalized
titles: list = []
genres: list = []
item_ids: list = []
title_to_index: dict = {}


@app.on_event("startup")
def load_model():
    global item_embeddings, titles, genres, item_ids, title_to_index

    emb_path = MODEL_DIR / "item_embeddings.npy"
    meta_path = MODEL_DIR / "model_meta.json"
    if not emb_path.exists() or not meta_path.exists():
        # leave things empty; endpoints will report the model is missing
        return

    item_embeddings = np.load(emb_path).astype(np.float32)
    with open(meta_path) as f:
        meta = json.load(f)
    titles = meta["titles"]
    genres = meta["genres"]
    item_ids = meta["item_ids"]
    # lowercase title -> index, for search
    title_to_index = {t.lower(): i for i, t in enumerate(titles)}
    print(f"loaded {item_embeddings.shape[0]} item embeddings, dim {item_embeddings.shape[1]}")


def _ready() -> bool:
    return item_embeddings is not None


# ---- request/response models ----
class RecommendRequest(BaseModel):
    liked_indices: list[int]   # indices of movies the user liked
    k: int = 10


# ---- endpoints ----
@app.get("/api/health")
def health():
    return {"status": "ok", "model_loaded": _ready(),
            "n_items": int(item_embeddings.shape[0]) if _ready() else 0}


@app.get("/api/search")
def search(q: str, limit: int = 10):
    """Search movies by title substring (for the 'pick movies you like' UI)."""
    if not _ready():
        raise HTTPException(503, "Model not loaded. Place item_embeddings.npy and model_meta.json in backend/model/.")
    ql = q.strip().lower()
    if not ql:
        return {"results": []}
    hits = []
    for i, t in enumerate(titles):
        if ql in t.lower():
            hits.append({"index": i, "title": titles[i], "genres": genres[i]})
            if len(hits) >= limit:
                break
    return {"results": hits}


@app.post("/api/recommend")
def recommend(req: RecommendRequest):
    """Given movies the user likes, return the nearest movies by embedding."""
    if not _ready():
        raise HTTPException(503, "Model not loaded.")
    if not req.liked_indices:
        raise HTTPException(400, "Pick at least one movie you like.")

    liked = [i for i in req.liked_indices if 0 <= i < item_embeddings.shape[0]]
    if not liked:
        raise HTTPException(400, "No valid movie indices provided.")

    # taste vector = average of liked-movie embeddings, re-normalized
    taste = item_embeddings[liked].mean(axis=0)
    norm = np.linalg.norm(taste)
    if norm > 0:
        taste = taste / norm

    # cosine similarity to every item (embeddings are already normalized)
    scores = item_embeddings @ taste          # (n_items,)
    scores[liked] = -1e9                        # don't recommend what they already picked

    k = max(1, min(req.k, 50))
    top = np.argpartition(-scores, k)[:k]
    top = top[np.argsort(-scores[top])]         # sort the top-k by score

    results = [
        {"index": int(i), "title": titles[i], "genres": genres[i],
         "score": round(float(scores[i]), 4)}
        for i in top
    ]
    return {"recommendations": results}
