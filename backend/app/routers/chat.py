"""Chatbot route — role-aware, read-only, grounded, multilingual assistant.

POST /chat is stateless and single-turn. role/user_id are trusted from the body
for now; when RBAC middleware lands, derive them from the auth context instead.
"""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..services.chatbot import handle_chat
from ..services import knowledge

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    role: Literal["donor", "patient", "admin", "public"] = "public"
    user_id: Optional[str] = None
    lang: Optional[str] = None  # "en" | "hi" | "te"; auto-detected when null


class LearnRequest(BaseModel):
    question: str
    answer: str
    source: str = "Admin-submitted"


@router.post("")
def chat(req: ChatRequest):
    """Answer one grounded message. Read-only."""
    return handle_chat(
        message=req.message,
        role=req.role,
        user_id=req.user_id,
        lang=req.lang,
    )


@router.post("/learn")
def learn(req: LearnRequest):
    """Admin: add a new FAQ entry so the bot learns to answer previously unknown queries."""
    entry = knowledge.learn_faq(req.question, req.answer, req.source)
    return {"status": "learned", "entry": entry}


@router.get("/unanswered")
def unanswered(limit: int = 50):
    """Admin: review queries the bot couldn't answer (for teaching)."""
    return {"items": knowledge.get_unanswered(limit)}
