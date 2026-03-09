"""AI chatbot endpoint — answers production questions using Claude."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from src.database import get_db
from src.auth.rbac import require_role
from src.config import settings
from src.services.ai_context import build_production_context

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

SYSTEM_PROMPT = (
    "You are a production analytics assistant for a cable assembly manufacturing facility. "
    "Answer questions concisely based ONLY on the production data provided below. "
    "Use exact numbers from the data. If the data doesn't contain the answer, say so. "
    "Keep answers short (2-4 sentences). Use plain language.\n\n"
    "PRODUCTION DATA:\n{context}"
)


class AIQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)


class AIQueryResponse(BaseModel):
    answer: str
    context_summary: str


@router.post("/query", response_model=AIQueryResponse)
async def ai_query(
    body: AIQueryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Ask a question about production data. Requires supervisor or admin role."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured. Set ANTHROPIC_API_KEY to enable.",
        )

    # Build context from live DB data
    context = build_production_context(db)

    # Call Claude API
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SYSTEM_PROMPT.format(context=context),
            messages=[{"role": "user", "content": body.question}],
        )
        answer = message.content[0].text
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error: {str(e)}",
        )

    return AIQueryResponse(answer=answer, context_summary=context)
