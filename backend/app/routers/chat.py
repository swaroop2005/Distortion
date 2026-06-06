"""Chatbot route — role-aware, read-only, grounded, multilingual assistant.

POST /chat is stateless and single-turn. role/user_id are trusted from the body
for now; when RBAC middleware lands, derive them from the auth context instead.
"""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..services.chatbot import handle_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    role: Literal["donor", "patient", "admin", "public"] = "public"
    user_id: Optional[str] = None
    lang: Optional[str] = None  # "en" | "hi" | "te"; auto-detected when null


@router.post("")
def chat(req: ChatRequest):
    """Answer one grounded, empathetic message. Read-only — never mutates state."""
    return handle_chat(
        message=req.message,
        role=req.role,
        user_id=req.user_id,
        lang=req.lang,
    )
