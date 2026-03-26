import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from typing import Optional
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_event
from app.core.email import send_welcome_email
from app.core.security import (
    create_access_token, create_refresh_token,
    decode_token, hash_password, verify_password,
)
from app.db.engine import get_db
from app.db.models import User

logger = logging.getLogger("emocare.auth")

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    full_name: str


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    result = await db.execute(select(User).where(User.id == user_id))
    user   = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_role(*roles):
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return _check


# ── Background email sender with error logging ─────────────────

async def _send_welcome(email: str, full_name: str):
    try:
        result = await send_welcome_email(email, full_name)
        if result:
            logger.info("Welcome email sent to %s", email)
        else:
            logger.warning("Welcome email failed (no exception) for %s", email)
    except Exception as e:
        logger.error("Welcome email exception for %s: %s", email, e)


@router.post("/register", response_model=TokenOut)
async def register(
    body: RegisterIn,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    exists = await db.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role="user",
        is_active=True,
        consent_model=True,
        consent_therapist=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Use FastAPI BackgroundTasks — more reliable than asyncio.create_task
    background_tasks.add_task(_send_welcome, user.email, user.full_name)

    log_event("REGISTER", user.id, "user", ip=request.client.host if request.client else None)
    access  = create_access_token({"sub": user.id, "role": user.role})
    refresh = create_refresh_token({"sub": user.id})
    return TokenOut(
        access_token=access,
        refresh_token=refresh,
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
    )


@router.post("/login", response_model=TokenOut)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == form.username))
    user   = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    log_event("LOGIN", user.id, user.role)
    access  = create_access_token({"sub": user.id, "role": user.role})
    refresh = create_refresh_token({"sub": user.id})
    return TokenOut(
        access_token=access,
        refresh_token=refresh,
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
    )


@router.post("/consent")
async def update_consent(
    model_consent: bool = True,
    therapist_consent: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.consent_model     = model_consent
    current_user.consent_therapist = therapist_consent
    await db.commit()
    log_event("CONSENT_UPDATE", current_user.id)
    return {"status": "updated"}