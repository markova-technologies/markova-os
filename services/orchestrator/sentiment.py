import os
import httpx
import structlog
from typing import Literal

logger = structlog.get_logger()

# We'll use the default distilbert SST-2 English model for simplicity
# This model returns labels: "POSITIVE" or "NEGATIVE"
HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english"

async def analyze_sentiment(text: str) -> Literal["POSITIVE", "NEGATIVE", "NEUTRAL"]:
    """
    Analyzes sentiment of the user text. 
    Returns 'NEGATIVE' if the user sounds frustrated or angry, 
    'POSITIVE' if happy/satisfied, and 'NEUTRAL' as fallback.
    """
    if not text or len(text.strip()) < 3:
        return "NEUTRAL"
        
    api_key = os.getenv("HUGGINGFACE_API_KEY")
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(
                HUGGINGFACE_API_URL, 
                headers=headers, 
                json={"inputs": text}
            )
            if resp.status_code == 200:
                results = resp.json()
                if isinstance(results, list) and len(results) > 0:
                    # Results look like: [[{'label': 'POSITIVE', 'score': 0.99}, {'label': 'NEGATIVE', 'score': 0.01}]]
                    predictions = results[0]
                    # Sort by score descending
                    best = max(predictions, key=lambda x: x["score"])
                    # Only return if we're fairly confident
                    if best["score"] > 0.8:
                        return best["label"]
            else:
                logger.warning("huggingface_sentiment_error", status_code=resp.status_code, body=resp.text)
                
    except Exception as e:
        logger.warning("huggingface_sentiment_exception", error=str(e))
        
    return "NEUTRAL"
