"""
Markova OS v3.0 — Capability-Centric Kernel
─────────────────────────────────────────────────────────────────────────────
Decoupled capability layer that abstracts tools, connectors, and external
business systems behind standardized declarative interfaces.
─────────────────────────────────────────────────────────────────────────────
"""

import asyncio
import json
import logging
import time
from typing import Any, Callable, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("markova.capability_kernel")


class CapabilityParameter(BaseModel):
    name: str
    type: str  # "string", "number", "boolean", "object"
    description: str
    required: bool = True


class CapabilityDefinition(BaseModel):
    name: str
    description: str
    parameters: List[CapabilityParameter] = []
    requires_approval: bool = False
    timeout_ms: int = 5000
    is_sandboxed: bool = False


class CapabilityExecutionRequest(BaseModel):
    capability_name: str
    tenant_id: str
    agent_id: str
    call_id: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    trace_id: Optional[str] = None


class CapabilityExecutionResult(BaseModel):
    status: str  # "SUCCESS", "FAILED", "APPROVAL_REQUIRED", "TIMEOUT", "PERMISSION_DENIED"
    output: Any = None
    error: Optional[str] = None
    execution_time_ms: float = 0.0


class CapabilityRegistry:
    def __init__(self):
        self._capabilities: Dict[str, CapabilityDefinition] = {}
        self._handlers: Dict[str, Callable] = {}
        self._register_default_core_capabilities()

    def register(self, definition: CapabilityDefinition, handler: Callable):
        self._capabilities[definition.name] = definition
        self._handlers[definition.name] = handler
        logger.info(f"Registered capability: {definition.name}")

    def get_definition(self, name: str) -> Optional[CapabilityDefinition]:
        return self._capabilities.get(name)

    def list_capabilities(self, allowed_names: Optional[List[str]] = None) -> List[CapabilityDefinition]:
        if allowed_names is None:
            return list(self._capabilities.values())
        return [cap for name, cap in self._capabilities.items() if name in allowed_names]

    def _register_default_core_capabilities(self):
        # 1. Knowledge Search Capability
        self.register(
            CapabilityDefinition(
                name="SEARCH_KNOWLEDGE",
                description="Search company knowledge base and FAQ catalog via semantic embeddings",
                parameters=[
                    CapabilityParameter(name="query", type="string", description="User search query in Amharic or English"),
                    CapabilityParameter(name="top_k", type="number", description="Number of context chunks to retrieve", required=False),
                ],
                timeout_ms=2500,
            ),
            self._handle_knowledge_search,
        )

        # 2. Call Transfer Capability
        self.register(
            CapabilityDefinition(
                name="TRANSFER_CALL",
                description="Transfer the current live phone call to a human supervisor or department",
                parameters=[
                    CapabilityParameter(name="department", type="string", description="Target department or phone number"),
                    CapabilityParameter(name="reason", type="string", description="Reason for escalation", required=False),
                ],
                requires_approval=False,
                timeout_ms=3000,
            ),
            self._handle_transfer_call,
        )

        # 3. Customer Lookup Capability
        self.register(
            CapabilityDefinition(
                name="SEARCH_CUSTOMER",
                description="Find customer profile and recent orders by phone number or name",
                parameters=[
                    CapabilityParameter(name="phone_number", type="string", description="Customer phone number"),
                ],
                timeout_ms=3500,
            ),
            self._handle_customer_lookup,
        )

    async def execute(self, request: CapabilityExecutionRequest) -> CapabilityExecutionResult:
        start_time = time.perf_counter()
        cap_def = self._capabilities.get(request.capability_name)

        if not cap_def:
            return CapabilityExecutionResult(
                status="FAILED",
                error=f"Capability '{request.capability_name}' is not registered.",
                execution_time_ms=0.0,
            )

        if cap_def.requires_approval:
            logger.info(f"Capability '{request.capability_name}' requires human approval. Enqueuing approval state.")
            return CapabilityExecutionResult(
                status="APPROVAL_REQUIRED",
                output={"message": "Action requires supervisor confirmation."},
                execution_time_ms=(time.perf_counter() - start_time) * 1000,
            )

        handler = self._handlers.get(request.capability_name)
        if not handler:
            return CapabilityExecutionResult(
                status="FAILED",
                error=f"Handler for capability '{request.capability_name}' is missing.",
                execution_time_ms=(time.perf_counter() - start_time) * 1000,
            )

        try:
            # Enforce strict execution timeout
            timeout_sec = cap_def.timeout_ms / 1000.0
            output = await asyncio.wait_for(handler(request), timeout=timeout_sec)
            elapsed = (time.perf_counter() - start_time) * 1000
            return CapabilityExecutionResult(
                status="SUCCESS",
                output=output,
                execution_time_ms=elapsed,
            )
        except asyncio.TimeoutError:
            elapsed = (time.perf_counter() - start_time) * 1000
            logger.error(f"Capability '{request.capability_name}' timed out after {cap_def.timeout_ms}ms.")
            return CapabilityExecutionResult(
                status="TIMEOUT",
                error=f"Execution timed out after {cap_def.timeout_ms}ms.",
                execution_time_ms=elapsed,
            )
        except Exception as e:
            elapsed = (time.perf_counter() - start_time) * 1000
            logger.error(f"Capability '{request.capability_name}' execution error: {e}")
            return CapabilityExecutionResult(
                status="FAILED",
                error=str(e),
                execution_time_ms=elapsed,
            )

    # Core internal capability handlers
    async def _handle_knowledge_search(self, request: CapabilityExecutionRequest) -> Any:
        query = request.parameters.get("query", "")
        # Mock / Fast RAG lookup contract
        return {
            "query": query,
            "results": [
                {"content": "የማርኮቫ AI የደንበኞች አገልግሎት የስራ ሰዓት ከሰኞ እስከ ቅዳሜ ከጠዋቱ 2:00 እስከ ማታ 2:00 ሰዓት ነው።", "score": 0.94}
            ]
        }

    async def _handle_transfer_call(self, request: CapabilityExecutionRequest) -> Any:
        dept = request.parameters.get("department", "support")
        return {
            "action": "TRANSFER",
            "destination": dept,
            "status": "INITIATED"
        }

    async def _handle_customer_lookup(self, request: CapabilityExecutionRequest) -> Any:
        phone = request.parameters.get("phone_number", "")
        return {
            "found": True,
            "customer": {
                "phone": phone,
                "name": "የተከበሩ ደንበኛ",
                "tier": "VIP",
                "open_orders": 1
            }
        }


# Global singleton capability registry
global_capability_registry = CapabilityRegistry()
