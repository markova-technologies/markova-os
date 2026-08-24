"""
Markova OS — Receptionist Specialist Agent (Almaz Persona)
"""

from typing import Optional


class ReceptionistAgent:
    def __init__(self, name: str = "Almaz Receptionist"):
        self.name = name
        self.role = "Receptionist & Greeting Specialist"
        self.goal = "Greet caller in natural Amharic, understand intent, and direct or answer initial inquiries."

    def execute(self, transcript: str, rag_context: Optional[str] = None) -> str:
        if "ሰላም" in transcript or "hello" in transcript.lower():
            return "ሰላም እንደምን ዋሉ! የማርኮቫ AI የደንበኞች አገልግሎት ነው። ምን ልርዳዎት?"
        return "እንኳን ደህና መጡ። ጥያቄዎን ወይም የሚፈልጉትን አገልግሎት በግልጽ ቢነግሩኝ ደስ ይለኛል።"


receptionist_agent = ReceptionistAgent()
