import asyncio
import time
from enum import Enum
import structlog
from typing import Callable, Any

logger = structlog.get_logger()

class CircuitState(Enum):
    CLOSED = "CLOSED"      # Normal operation
    OPEN = "OPEN"          # Failing, fast-fail requests
    HALF_OPEN = "HALF_OPEN" # Testing recovery

class CircuitBreaker:
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout_sec: float = 30.0,
        expected_exception: type = Exception
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout_sec = recovery_timeout_sec
        self.expected_exception = expected_exception
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0.0
        self._lock = asyncio.Lock()

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        async with self._lock:
            if self.state == CircuitState.OPEN:
                if time.time() - self.last_failure_time > self.recovery_timeout_sec:
                    logger.info("circuit_breaker_half_open", name=self.name)
                    self.state = CircuitState.HALF_OPEN
                else:
                    raise RuntimeError(f"Circuit {self.name} is OPEN. Fast failing.")
            
        try:
            # If HALF_OPEN, only one request will effectively go through and transition the state
            # based on success or failure.
            result = await func(*args, **kwargs)
            
            async with self._lock:
                if self.state != CircuitState.CLOSED:
                    logger.info("circuit_breaker_recovered", name=self.name)
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
            return result
            
        except self.expected_exception as e:
            async with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.state == CircuitState.HALF_OPEN or self.failure_count >= self.failure_threshold:
                    if self.state != CircuitState.OPEN:
                        logger.warning("circuit_breaker_opened", name=self.name, failures=self.failure_count)
                    self.state = CircuitState.OPEN
            raise e

    async def call_generator(self, func: Callable, *args, **kwargs):
        async with self._lock:
            if self.state == CircuitState.OPEN:
                if time.time() - self.last_failure_time > self.recovery_timeout_sec:
                    logger.info("circuit_breaker_half_open", name=self.name)
                    self.state = CircuitState.HALF_OPEN
                else:
                    raise RuntimeError(f"Circuit {self.name} is OPEN. Fast failing.")
            
        try:
            async for item in func(*args, **kwargs):
                yield item
            
            async with self._lock:
                if self.state != CircuitState.CLOSED:
                    logger.info("circuit_breaker_recovered", name=self.name)
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
                    
        except self.expected_exception as e:
            async with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.state == CircuitState.HALF_OPEN or self.failure_count >= self.failure_threshold:
                    if self.state != CircuitState.OPEN:
                        logger.warning("circuit_breaker_opened", name=self.name, failures=self.failure_count)
                    self.state = CircuitState.OPEN
            raise e

# Global instances
llm_breaker = CircuitBreaker("LLM", failure_threshold=5, recovery_timeout_sec=30.0)
stt_breaker = CircuitBreaker("STT", failure_threshold=3, recovery_timeout_sec=15.0)
tts_breaker = CircuitBreaker("TTS", failure_threshold=3, recovery_timeout_sec=15.0)
