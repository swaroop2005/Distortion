"""DynamoDB client and table helpers for ThalNet.

Enable with: THALNET_DB=dynamodb
Table prefix:  THALNET_TABLE_PREFIX  (default: ThalNet-)
Region:        AWS_REGION            (default: us-east-1)

All callers import from here; swap-out is transparent to routers.
"""
from __future__ import annotations

import os
import time

import boto3
from boto3.dynamodb.conditions import Key

REGION = os.getenv("AWS_REGION", "us-east-1")
PREFIX = os.getenv("THALNET_TABLE_PREFIX", "ThalNet-")

T_USERS         = PREFIX + "Users"
T_BRIDGES       = PREFIX + "Bridges"
T_REQUESTS      = PREFIX + "Requests"
T_CONVERSATIONS = PREFIX + "Conversations"
T_OUTCOMES      = PREFIX + "Outcomes"

_ddb = None


def _get_ddb():
    global _ddb
    if _ddb is None:
        _ddb = boto3.resource("dynamodb", region_name=REGION)
    return _ddb


def _table(name: str):
    return _get_ddb().Table(name)


def _clean(d: dict) -> dict:
    """Strip None values — DynamoDB rejects them."""
    import math
    out = {}
    for k, v in d.items():
        if v is None:
            continue
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            continue
        if isinstance(v, dict):
            v = _clean(v)
        out[k] = v
    return out


# ── Users ─────────────────────────────────────────────────────────────────────

def get_user(user_id: str) -> dict | None:
    r = _table(T_USERS).get_item(Key={"userId": str(user_id)})
    return r.get("Item")


def put_user(item: dict):
    row = _clean(item)
    row["userId"] = str(row.get("user_id", row.get("userId", "")))
    _table(T_USERS).put_item(Item=row)


def scan_users(role: str | None = None) -> list[dict]:
    kwargs: dict = {}
    if role:
        kwargs["FilterExpression"] = "role = :r"
        kwargs["ExpressionAttributeValues"] = {":r": role}
    items: list[dict] = []
    last = None
    while True:
        if last:
            kwargs["ExclusiveStartKey"] = last
        resp = _table(T_USERS).scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
    return items


# ── Bridges ───────────────────────────────────────────────────────────────────

def get_bridge(bridge_id: str) -> dict | None:
    r = _table(T_BRIDGES).get_item(Key={"bridgeId": bridge_id})
    return r.get("Item")


def put_bridge(bridge_id: str, item: dict):
    row = _clean(item)
    row["bridgeId"] = bridge_id
    _table(T_BRIDGES).put_item(Item=row)


def scan_bridges() -> list[dict]:
    items: list[dict] = []
    last = None
    while True:
        kwargs: dict = {}
        if last:
            kwargs["ExclusiveStartKey"] = last
        resp = _table(T_BRIDGES).scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
    return items


# ── Requests ──────────────────────────────────────────────────────────────────

def put_request(request_id: str, item: dict):
    row = _clean(item)
    row["requestId"] = request_id
    _table(T_REQUESTS).put_item(Item=row)


def get_request(request_id: str) -> dict | None:
    r = _table(T_REQUESTS).get_item(Key={"requestId": request_id})
    return r.get("Item")


def scan_requests() -> list[dict]:
    return _table(T_REQUESTS).scan().get("Items", [])


# ── Conversations (agent memory) ──────────────────────────────────────────────

def append_turn(user_id: str, role: str, text: str, lang: str = "en"):
    _table(T_CONVERSATIONS).put_item(Item={
        "userId": str(user_id),
        "ts": str(time.time()),
        "role": role,
        "text": text,
        "lang": lang,
    })


def get_history(user_id: str, limit: int = 20) -> list[dict]:
    r = _table(T_CONVERSATIONS).query(
        KeyConditionExpression=Key("userId").eq(str(user_id)),
        ScanIndexForward=False,
        Limit=limit,
    )
    return list(reversed(r.get("Items", [])))


# ── Outcomes (failure learning) ───────────────────────────────────────────────

def log_outcome(request_id: str, donor_id: str, **kwargs):
    row = _clean(kwargs)
    row.update({"requestId": str(request_id), "donorId": str(donor_id), "ts": str(time.time())})
    _table(T_OUTCOMES).put_item(Item=row)


def scan_outcomes(request_id: str | None = None) -> list[dict]:
    if request_id:
        r = _table(T_OUTCOMES).query(
            KeyConditionExpression=Key("requestId").eq(str(request_id))
        )
        return r.get("Items", [])
    return _table(T_OUTCOMES).scan().get("Items", [])
