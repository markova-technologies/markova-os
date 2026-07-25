"""
Barge-In Manager — ESL-Only VMD Approach (Stage 3)
===================================================
Connects to FreeSWITCH ESL (port 8021) and drives VMD entirely from Python.
Lua does NOTHING for barge-in — just plain playback.

Flow:
    1. Subscribe to CHANNEL_EXECUTE events
    2. When "playback" app starts on a channel → send uuid_execute <uuid> vmd start
    3. Subscribe to CUSTOM vmd::start events
    4. When vmd::start fires on same UUID → send uuid_break to stop playback instantly
    5. When CHANNEL_EXECUTE_COMPLETE for playback → send uuid_execute <uuid> vmd stop
"""

import logging
import os
import threading
import time
from typing import Dict, Set

logger = logging.getLogger(__name__)

FS_HOST     = os.getenv("FREESWITCH_HOST", "127.0.0.1")
FS_PORT     = int(os.getenv("FREESWITCH_ESL_PORT", "8021"))
FS_PASSWORD = os.getenv("FREESWITCH_ESL_PASSWORD", "ClueCon")


class BargeInManager:
    """
    ESL-driven barge-in manager.
    Monitors FreeSWITCH events to start/stop VMD and trigger uuid_break.
    """

    def __init__(self):
        self._playing_uuids: Set[str] = set()   # UUIDs currently playing audio
        self._vmd_uuids: Set[str] = set()       # UUIDs with VMD running
        self._lock = threading.Lock()
        self._client = None
        self._running = False
        self._thread = None

    # ── Public API ──────────────────────────────────────────────────────────

    def register_playback(self, uuid: str):
        """Mark a UUID as currently playing — barge-in will be armed."""
        with self._lock:
            self._playing_uuids.add(uuid)

    def unregister_playback(self, uuid: str):
        with self._lock:
            self._playing_uuids.discard(uuid)
            self._vmd_uuids.discard(uuid)

    # ── ESL event handlers ───────────────────────────────────────────────────

    def _on_channel_execute(self, event):
        """Fires when FreeSWITCH starts executing an application on a channel."""
        try:
            uuid = event.headers.get("Unique-ID", "")
            app  = event.headers.get("Application", "")

            if app == "playback" and uuid:
                logger.info(f"[BargeIn] Playback started on {uuid[:8]} — arming VMD")
                with self._lock:
                    self._playing_uuids.add(uuid)
                # Start VMD on this UUID via ESL API (no Lua needed)
                self._api(f"uuid_execute {uuid} vmd start")
                with self._lock:
                    self._vmd_uuids.add(uuid)
        except Exception as e:
            logger.debug(f"[BargeIn] _on_channel_execute error: {e}")

    def _on_channel_execute_complete(self, event):
        """Fires when an application finishes on a channel."""
        try:
            uuid = event.headers.get("Unique-ID", "")
            app  = event.headers.get("Application", "")

            if app == "playback" and uuid:
                with self._lock:
                    had_vmd = uuid in self._vmd_uuids
                    self._playing_uuids.discard(uuid)
                    self._vmd_uuids.discard(uuid)

                if had_vmd:
                    self._api(f"uuid_execute {uuid} vmd stop")
                    logger.info(f"[BargeIn] VMD stopped after playback on {uuid[:8]}")
        except Exception as e:
            logger.debug(f"[BargeIn] _on_channel_execute_complete error: {e}")

    def _on_vmd_event(self, event):
        """Fires when mod_vmd detects voice on a channel."""
        try:
            uuid = event.headers.get("Unique-ID", "")
            if not uuid:
                return

            with self._lock:
                is_playing = uuid in self._playing_uuids

            if is_playing:
                logger.info(f"⚡ [BargeIn] Voice detected on {uuid[:8]} — breaking playback!")
                self._api(f"uuid_break {uuid} both")
                with self._lock:
                    self._playing_uuids.discard(uuid)
                    self._vmd_uuids.discard(uuid)
        except Exception as e:
            logger.debug(f"[BargeIn] _on_vmd_event error: {e}")

    def _on_channel_destroy(self, event):
        """Clean up when a channel is destroyed."""
        try:
            uuid = event.headers.get("Unique-ID", "")
            if uuid:
                self.unregister_playback(uuid)
        except Exception:
            pass

    # ── ESL connection loop ──────────────────────────────────────────────────

    def _api(self, cmd: str):
        """Send an API command to FreeSWITCH via ESL."""
        if self._client:
            try:
                self._client.api(cmd)
            except Exception as e:
                logger.warning(f"[BargeIn] ESL API error ({cmd}): {e}")

    def _run_esl_loop(self):
        while self._running:
            try:
                import greenswitch

                client = greenswitch.InboundESL(
                    host=FS_HOST, port=FS_PORT, password=FS_PASSWORD
                )
                client.connect()
                self._client = client
                logger.info(f"✅ [BargeIn] Connected to FreeSWITCH ESL at {FS_HOST}:{FS_PORT}")

                # Subscribe to the events we need
                client.send("event plain "
                            "CHANNEL_EXECUTE "
                            "CHANNEL_EXECUTE_COMPLETE "
                            "CHANNEL_DESTROY "
                            "CUSTOM vmd::start")

                # Register handlers
                client.register_handle("CHANNEL_EXECUTE",          self._on_channel_execute)
                client.register_handle("CHANNEL_EXECUTE_COMPLETE", self._on_channel_execute_complete)
                client.register_handle("CHANNEL_DESTROY",          self._on_channel_destroy)
                client.register_handle("CUSTOM",                   self._on_vmd_event)

                # Start background event dispatcher + block on receive loop
                client.start_event_handlers()
                client.receive_events()   # blocks until disconnected

            except Exception as e:
                logger.warning(f"[BargeIn] ESL disconnected: {e}. Retrying in 5s…")
                self._client = None
                time.sleep(5)


    # ── Lifecycle ────────────────────────────────────────────────────────────

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._run_esl_loop, daemon=True, name="BargeInESL"
        )
        self._thread.start()
        logger.info(f"🎯 [BargeIn] ESL listener starting → {FS_HOST}:{FS_PORT}")

    def stop(self):
        self._running = False
        if self._client:
            try:
                self._client.stop()
            except Exception:
                pass


# Singleton
barge_in_manager = BargeInManager()


def start_barge_in_listener():
    try:
        barge_in_manager.start()
    except Exception as e:
        logger.error(f"[BargeIn] Failed to start: {e}")
