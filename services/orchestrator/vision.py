import structlog
from typing import Optional
from openai import AsyncOpenAI

logger = structlog.get_logger()

async def analyze_document(media_url: str, mime_type: str, openai_api_key: str) -> Optional[str]:
    """
    Passes a media URL to OpenAI's GPT-4o vision model to extract its contents.
    Suitable for documents, invoices, IDs, and receipts sent via Twilio MMS/WhatsApp.
    """
    if not openai_api_key:
        logger.error("vision_analysis_failed_missing_openai_key")
        return None
        
    try:
        client = AsyncOpenAI(api_key=openai_api_key)
        
        prompt = (
            "You are an AI assistant in a call center. The user just sent this image/document during their phone call. "
            "Please describe what this document is, read all the text on it clearly (such as invoice totals, names, dates, or ID numbers), "
            "and summarize the key details so I can speak with them about it over the phone."
        )

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": media_url,
                                "detail": "auto"
                            },
                        },
                    ],
                }
            ],
            max_tokens=300,
        )

        return response.choices[0].message.content

    except Exception as e:
        logger.error("vision_analysis_error", error=str(e), media_url=media_url)
        return None
