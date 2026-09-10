"""
Markova Orchestrator — Telephony & Streaming Barge-In Engine
─────────────────────────────────────────────────────────────────────────────
Handles real-time caller speech interruption across telephony interfaces:
1. FreeSWITCH ESL (Event Socket Layer) via VMD (Voice Motion Detection)
2. Twilio & SIP Media Streams via Silero VAD buffer clearing
─────────────────────────────────────────────────────────────────────────────
"""

import os
import threading
import time
from typing import Dict, Optional, Set
import structlog

logger = structlog.get_logger("markova.barge_in")

FS_HOST = os.getenv("FREESWITCH_HOST", "127.0.0.1")
FS_PORT = int(os.getenv("FREESWITCH_ESL_PORT", "8021"))
FS_PASSWORD = os.getenv("FREESWITCH_ESL_PASSWORD", "")


class TelephonyBargeInController:
    """
    Multi-tenant, per-call aware FreeSWITCH ESL barge-in manager.
    Monitors channel events to arm VMD during playback and fire uuid_break on speech.
    """

    def __init__(self, host: str = FS_HOST, port: int = FS_PORT, password: str = FS_PASSWORD):
        self.host = host
        self.port = port
        self.password = password
        self._playing_calls: Dict[str, str] = {}  # uuid -> company_id
        self._vmd_armed: Set[str] = set()
        self._lock = threading.Lock()
        self._client = None
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def register_playback(self, call_uuid: str, company_id: str = "default"):
        """Mark a call UUID as currently playing audio; arms barge-in detection."""
        if not call_uuid:
            return
        with self._lock:
            self._playing_calls[call_uuid] = company_id
        # If ESL is connected, trigger VMD start on the channel
        self._send_api(f"uuid_execute {call_uuid} vmd start")
        with self._lock:
            self._vmd_armed.add(call_uuid)
        logger.debug("barge_in_playback_registered", call_uuid=call_uuid[:8], company_id=company_id)

    def unregister_playback(self, call_uuid: str):
        """Unregister playback and disarm VMD."""
        if not call_uuid:
            return
        with self._lock:
            had_vmd = call_uuid in self._vmd_armed
            self._playing_calls.pop(call_uuid, None)
            self._vmd_armed.discard(call_uuid)

        if had_vmd:
            self._send_api(f"uuid_execute {call_uuid} vmd stop")
            logger.debug("barge_in_playback_unregistered", call_uuid=call_uuid[:8])

    def trigger_break(self, call_uuid: str, reason: str = "caller_speech") -> bool:
        """Immediately issue uuid_break to interrupt channel playback."""
        if not call_uuid:
            return False
        with self._lock:
            self._playing_calls.pop(call_uuid, None)
            self._vmd_armed.discard(call_uuid)
        self._send_api(f"uuid_break {call_uuid} both")
        logger.info("barge_in_playback_interrupted", call_uuid=call_uuid[:8], reason=reason)
        return True

    def _on_channel_execute(self, event):
        try:
            uuid = getattr(event, "headers", {}).get("Unique-ID", "")
            app = getattr(event, "headers", {}).get("Application", "")
            if app == "playback" and uuid:
                with self._lock:
                    if uuid not in self._playing_calls:
                        self._playing_calls[uuid] = "unknown"
                self._send_api(f"uuid_execute {uuid} vmd start")
                with self._lock:
                    self._vmd_armed.add(uuid)
        except Exception as e:
            logger.debug("barge_in_channel_execute_err", error=str(e))

    def _on_channel_execute_complete(self, event):
        try:
            uuid = getattr(event, "headers", {}).get("Unique-ID", "")
            app = getattr(event, "headers", {}).get("Application", "")
            if app == "playback" and uuid:
                self.unregister_playback(uuid)
        except Exception as e:
            logger.debug("barge_in_channel_complete_err", error=str(e))

    def _on_vmd_event(self, event):
        try:
            uuid = getattr(event, "headers", {}).get("Unique-ID", "")
            if not uuid:
                return
            with self._lock:
                is_playing = uuid in self._playing_calls
            if is_playing:
                self.trigger_break(uuid, reason="vmd_speech_detected")
        except Exception as e:
            logger.debug("barge_in_vmd_event_err", error=str(e))

    def _on_channel_destroy(self, event):
        try:
            uuid = getattr(event, "headers", {}).get("Unique-ID", "")
            if uuid:
                self.unregister_playback(uuid)
        except Exception:
            pass

    def _send_api(self, cmd: str):
        if self._client:
            try:
                self._client.api(cmd)
            except Exception as e:
                logger.debug("barge_in_esl_api_err", cmd=cmd, error=str(e))

    def _run_esl_loop(self):
        while self._running:
            try:
                import greenswitch

                client = greenswitch.InboundESL(
                    host=self.host, port=self.port, password=self.password
                )
                client.connect()
                self._client = client
                logger.info("barge_in_esl_connected", host=self.host, port=self.port)

                client.send(
                    "event plain CHANNEL_EXECUTE CHANNEL_EXECUTE_COMPLETE CHANNEL_DESTROY CUSTOM vmd::start"
                )
                client.register_handle("CHANNEL_EXECUTE", self._on_channel_execute)
                client.register_handle("CHANNEL_EXECUTE_COMPLETE", self._on_channel_execute_complete)
                client.register_handle("CHANNEL_DESTROY", self._on_channel_destroy)
                client.register_handle("CUSTOM", self._on_vmd_event)

                client.start_event_handlers()
                client.receive_events()
            except ImportError:
                logger.info("greenswitch_not_installed_esl_disabled")
                break
            except Exception as e:
                logger.debug("barge_in_esl_disconnected", error=str(e))
                self._client = None
                time.sleep(10)

    def start(self):
        if self._running or not self.password:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._run_esl_loop, daemon=True, name="TelephonyBargeInESL"
        )
        self._thread.start()
        logger.info("barge_in_esl_thread_started", host=self.host, port=self.port)

    def stop(self):
        self._running = False
        if self._client:
            try:
                self._client.stop()
            except Exception:
                pass


# Global singleton instance
barge_in_controller = TelephonyBargeInController()
