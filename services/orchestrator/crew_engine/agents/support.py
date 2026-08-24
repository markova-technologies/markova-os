"""
Markova OS — Technical Support Specialist Agent
"""

from typing import Optional


class SupportAgent:
    def __init__(self, name: str = "Technical Support Specialist"):
        self.name = name
        self.role = "Technical Troubleshooting & Escalation"
        self.goal = "Diagnose customer issues, provide troubleshooting steps, and create or update support tickets."

    def execute(self, transcript: str, rag_context: Optional[str] = None) -> str:
        if "ችግር" in transcript or "broken" in transcript.lower():
            return "ያጋጠመዎትን ችግር ተረድቻለሁ። ሁኔታውን ለማስተካከል የሚያስፈልጉትን የመጀመሪያ ደረጃ መፍትሄዎች ላብራራልዎት ወይም ወደ ቴክኒክ ቡድን ላስተላልፍልዎት?"
        return "የቴክኒክ ድጋፍ ክፍል ነኝ። ያጋጠመዎትን የብልሽት ወይም የአገልግሎት ችግር ዝርዝር ቢነግሩኝ አግዝዎታለሁ።"


support_agent = SupportAgent()
