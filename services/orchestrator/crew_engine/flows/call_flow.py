"""
Markova OS — MarkovaCallFlow (Complex Multi-Agent Workflow)
─────────────────────────────────────────────────────────────────────────────
Event-driven flow executed only for complex, multi-turn, or multi-action calls.
"""

from typing import Optional
from pydantic import BaseModel

try:
    from crewai.flow.flow import Flow, start, listen  # type: ignore
    HAS_CREWAI = True
except ImportError:
    HAS_CREWAI = False

    # Standalone fallback decorators if crewai is not in current environment
    class Flow:  # type: ignore
        def __init__(self):
            self.state = None

        def kickoff(self, inputs=None):
            if hasattr(self, "classify_caller_intent"):
                self.classify_caller_intent()
            if hasattr(self, "execute_specialist_agent"):
                return self.execute_specialist_agent()
            return ""

    def start():
        def decorator(fn):
            return fn
        return decorator

    def listen(other):
        def decorator(fn):
            return fn
        return decorator


class CallState(BaseModel):
    call_id: str
    tenant_id: str
    caller_phone: str = ""
    transcript: str = ""
    intent: Optional[str] = None
    agent_response: str = ""
    rag_context: str = ""


class MarkovaCallFlow(Flow):
    def __init__(self, initial_state: Optional[CallState] = None):
        super().__init__()
        self.state = initial_state or CallState(call_id="", tenant_id="")

    @start()
    def classify_caller_intent(self):
        """Analyze caller transcript to route to the optimal specialized Agent."""
        transcript = self.state.transcript.lower()
        if any(w in transcript for w in ["ዋጋ", "ግዢ", "እንዴት ልግዛ", "price", "buy", "cost"]):
            self.state.intent = "SALES"
        elif any(w in transcript for w in ["ችግር", "አይሰራም", "ብልሽት", "issue", "broken", "repair"]):
            self.state.intent = "SUPPORT"
        else:
            self.state.intent = "RECEPTIONIST"

    @listen(classify_caller_intent)
    def execute_specialist_agent(self):
        """Kick off matching specialized agent."""
        if self.state.intent == "SALES":
            from crew_engine.agents.sales import sales_agent
            result = sales_agent.execute(self.state.transcript, self.state.rag_context)
        elif self.state.intent == "SUPPORT":
            from crew_engine.agents.support import support_agent
            result = support_agent.execute(self.state.transcript, self.state.rag_context)
        else:
            from crew_engine.agents.receptionist import receptionist_agent
            result = receptionist_agent.execute(self.state.transcript, self.state.rag_context)

        self.state.agent_response = result
        return result
