"""Mock OTP auth for ThalNet demo.

Production swap: replace _otp_store with Redis TTL keys,
replace _user_registry with DynamoDB Users table,
send real OTP via AWS SNS or Twilio.
"""
import random
import string
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory (DynamoDB-ready seam)
_otp_store: dict = {}       # phone -> {code, attempts}
_user_registry: dict = {}   # phone -> {user_id, role}


class SendOtpRequest(BaseModel):
    phone: str  # "+91XXXXXXXXXX"


class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str


def _gen_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def link_phone(phone: str, user_id: str, role: str) -> None:
    """Called by patient/donor register endpoints after successful registration."""
    _user_registry[phone] = {"user_id": user_id, "role": role}


def get_user_by_phone(phone: str):
    return _user_registry.get(phone)


@router.post("/send-otp")
def send_otp(req: SendOtpRequest):
    code = _gen_otp()
    _otp_store[req.phone] = {"code": code, "attempts": 0}
    # Demo mode: return code in response (prod: send via SMS/WhatsApp, omit from response)
    return {
        "status": "sent",
        "message": f"OTP sent to {req.phone}",
        "dev_otp": code,  # remove in production
    }


@router.post("/verify-otp")
def verify_otp(req: VerifyOtpRequest):
    entry = _otp_store.get(req.phone)
    if not entry:
        raise HTTPException(400, "No OTP sent to this number. Request a new one.")
    if entry["attempts"] >= 3:
        raise HTTPException(429, "Too many attempts. Try again in 5 minutes.")
    if entry["code"] != req.otp:
        entry["attempts"] += 1
        raise HTTPException(401, "Incorrect code. Try again.")

    del _otp_store[req.phone]

    user = _user_registry.get(req.phone)
    if not user:
        raise HTTPException(404, "No account found for this number. Sign up instead.")

    return {
        "token": f"demo_token_{user['user_id']}",
        "user_id": user["user_id"],
        "role": user["role"],
        "status": "verified",
    }


@router.get("/me")
def get_me(user_id: str):
    """Look up role by user_id (demo: linear scan)."""
    for phone, u in _user_registry.items():
        if u["user_id"] == user_id:
            return {"user_id": user_id, "role": u["role"], "phone": phone}
    raise HTTPException(404, "User not found")
