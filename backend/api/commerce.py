import asyncio
import json
import math
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.account import require_app_user
from backend.core.config import get_settings
from backend.core.database import get_db
from backend.models.db_models import AppUser
from backend.services.commerce_service import (
    CommerceService,
    OfficialGatewayError,
    OfficialLLMGatewayService,
    make_reference,
)

settings = get_settings()
router = APIRouter()


class GatewayMessage(BaseModel):
    role: Literal["system", "user", "assistant"] = "user"
    content: str = Field(..., min_length=1, max_length=12000)


class LLMGatewayStreamRequest(BaseModel):
    messages: list[GatewayMessage] = Field(..., min_length=1, max_length=40)
    systemPrompt: str = Field(default="", max_length=8000)
    model: str = Field(default="", max_length=160)
    temperature: float = Field(default=0.7, ge=0, le=2)
    maxTokens: int = Field(default=1024, ge=1, le=8000)


def _sse(event: str, payload: dict) -> str:
    return f"event:{event}\ndata:{json.dumps(payload, ensure_ascii=False)}\n\n"


@router.get("/commerce/catalog")
async def commerce_catalog():
    return {
        "catalog": CommerceService(db=None).catalog(),
        "payment": {
            "membershipCheckout": bool(
                settings.STRIPE_PUBLISHABLE_KEY
                and settings.STRIPE_SECRET_KEY
                and (settings.STRIPE_PAYMENT_PRICE_ID or settings.STRIPE_SUBSCRIPTION_PRICE_ID)
            ),
            "characterPackCheckout": False,
        },
        "gateway": {
            "officialLlmConfigured": OfficialLLMGatewayService().is_configured(),
            "reserveCredits": settings.AILIS_GATEWAY_LLM_RESERVE_CREDITS,
        },
    }


@router.get("/commerce/me")
async def commerce_me(
    user: AppUser = Depends(require_app_user),
    db: AsyncSession = Depends(get_db),
):
    service = CommerceService(db)
    await service.ensure_starter_profile(user.id)
    entitlements = await service.list_entitlements(user.id)
    return {
        "entitlements": [service.serialize_entitlement(item) for item in entitlements],
        "credits": await service.credit_summary(user.id),
    }


@router.get("/commerce/entitlements")
async def commerce_entitlements(
    user: AppUser = Depends(require_app_user),
    db: AsyncSession = Depends(get_db),
):
    service = CommerceService(db)
    await service.ensure_starter_profile(user.id)
    entitlements = await service.list_entitlements(user.id)
    return {"entitlements": [service.serialize_entitlement(item) for item in entitlements]}


@router.get("/commerce/credits")
async def commerce_credits(
    user: AppUser = Depends(require_app_user),
    db: AsyncSession = Depends(get_db),
):
    service = CommerceService(db)
    await service.ensure_starter_profile(user.id)
    return {"credits": await service.credit_summary(user.id)}


@router.post("/commerce/gateway/llm/stream")
async def commerce_llm_stream(
    payload: LLMGatewayStreamRequest,
    user: AppUser = Depends(require_app_user),
    db: AsyncSession = Depends(get_db),
):
    gateway = OfficialLLMGatewayService()
    if not gateway.is_configured():
        raise HTTPException(status_code=503, detail="官方 LLM 流式网关还没有配置供应商密钥。")

    service = CommerceService(db)
    await service.ensure_starter_profile(user.id)
    reserve_amount = max(int(settings.AILIS_GATEWAY_LLM_RESERVE_CREDITS or 1), 1)
    reference_id = make_reference("llm-stream")
    try:
        await service.reserve_credits(
            user_id=user.id,
            credit_type="llm",
            amount=reserve_amount,
            reference_id=reference_id,
            detail={"endpoint": "commerce.gateway.llm.stream"},
        )
    except ValueError as exc:
        raise HTTPException(status_code=402, detail="LLM 积分不足，请购买积分包或开通会员。") from exc

    messages = [{"role": message.role, "content": message.content} for message in payload.messages]

    async def event_generator():
        output_chars = 0
        try:
            yield _sse(
                "ready",
                {
                    "referenceId": reference_id,
                    "reservedCredits": reserve_amount,
                },
            )
            async for chunk in gateway.stream_chat(
                messages=messages,
                system_prompt=payload.systemPrompt,
                model=payload.model,
                temperature=payload.temperature,
                max_tokens=payload.maxTokens,
            ):
                output_chars += len(chunk)
                yield _sse("delta", {"text": chunk})
        except asyncio.CancelledError:
            await service.refund_reservation(
                user_id=user.id,
                credit_type="llm",
                reference_id=reference_id,
                reserved_amount=reserve_amount,
                reason="client_disconnected",
            )
            raise
        except OfficialGatewayError as exc:
            await service.refund_reservation(
                user_id=user.id,
                credit_type="llm",
                reference_id=reference_id,
                reserved_amount=reserve_amount,
                reason="provider_error",
            )
            yield _sse("error", {"message": str(exc)})
        except Exception as exc:  # noqa: BLE001
            await service.refund_reservation(
                user_id=user.id,
                credit_type="llm",
                reference_id=reference_id,
                reserved_amount=reserve_amount,
                reason="gateway_error",
            )
            yield _sse("error", {"message": f"流式转发失败：{exc.__class__.__name__}"})
        else:
            chars_per_credit = max(int(settings.AILIS_GATEWAY_LLM_CHARS_PER_CREDIT or 3000), 1)
            spent_amount = max(math.ceil(max(output_chars, 1) / chars_per_credit), 1)
            await service.settle_reservation(
                user_id=user.id,
                credit_type="llm",
                reference_id=reference_id,
                reserved_amount=reserve_amount,
                spent_amount=spent_amount,
                detail={"outputChars": output_chars, "charsPerCredit": chars_per_credit},
            )
            summary = await service.credit_summary(user.id)
            yield _sse(
                "done",
                {
                    "referenceId": reference_id,
                    "outputChars": output_chars,
                    "spentCredits": min(spent_amount, reserve_amount),
                    "balances": summary["balances"],
                },
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
