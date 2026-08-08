"""
Silero VAD integration for real-time end-of-utterance detection.
Model: silero-vad (ONNX runtime, <2MB, CPU-only, <1ms per frame)
"""
import os
import numpy as np
import structlog

logger = structlog.get_logger()

class SileroVAD:
    """
    Wraps the Silero VAD ONNX model.
    Usage:
        vad = SileroVAD()
        is_speech = vad.is_speech(pcm_frame_bytes)  # 30ms frame @ 8kHz
    """
    SAMPLE_RATE = 8000
    FRAME_MS = 30  # Silero works in 30ms frames at 8kHz
    FRAME_SAMPLES = int(SAMPLE_RATE * FRAME_MS / 1000)  # = 240 samples per frame
    
    def __init__(self, threshold: float = 0.5):
        self.threshold = threshold
        self._session = None
        self._h = np.zeros((2, 1, 64), dtype=np.float32)
        self._c = np.zeros((2, 1, 64), dtype=np.float32)
        self._sr = np.array([self.SAMPLE_RATE], dtype=np.int64)
        self._load_model()
    
    def _load_model(self):
        """Download and load Silero VAD ONNX model on first use."""
        try:
            import onnxruntime as ort
            model_path = os.path.join(os.path.dirname(__file__), "silero_vad.onnx")
            if not os.path.exists(model_path):
                logger.info("downloading_silero_vad_model")
                import urllib.request
                urllib.request.urlretrieve(
                    "https://github.com/snakers4/silero-vad/raw/master/files/silero_vad.onnx",
                    model_path
                )
            opts = ort.SessionOptions()
            opts.inter_op_num_threads = 1
            opts.intra_op_num_threads = 1
            self._session = ort.InferenceSession(model_path, sess_options=opts)
            logger.info("silero_vad_loaded")
        except Exception as e:
            logger.error("silero_vad_load_failed", error=str(e))
            self._session = None
    
    def is_speech(self, pcm_frame: bytes) -> bool:
        """
        pcm_frame: exactly FRAME_SAMPLES * 2 bytes of 16-bit PCM at 8kHz.
        Returns True if frame contains speech above threshold.
        """
        if not self._session:
            # Fallback to energy-based detection if model failed to load
            import audioop
            rms = audioop.rms(pcm_frame, 2)
            return rms > 300
        
        samples = np.frombuffer(pcm_frame, dtype=np.int16).astype(np.float32) / 32768.0
        if len(samples) != self.FRAME_SAMPLES:
            return False  # Wrong frame size
        
        x = samples.reshape(1, -1)
        ort_inputs = {
            "input": x,
            "sr": self._sr,
            "h": self._h,
            "c": self._c,
        }
        out, h, c = self._session.run(None, ort_inputs)
        self._h = h
        self._c = c
        return float(out.squeeze()) >= self.threshold
    
    def reset(self):
        """Reset LSTM state — call at start of each utterance."""
        self._h = np.zeros((2, 1, 64), dtype=np.float32)
        self._c = np.zeros((2, 1, 64), dtype=np.float32)


class EndOfUtteranceDetector:
    """
    Wraps SileroVAD to implement end-of-utterance (EOU) detection.
    EOU is declared when N consecutive silent frames follow a speech segment.
    """
    def __init__(self, vad: SileroVAD, silence_frames_to_eou: int = 15):
        """
        silence_frames_to_eou: Number of consecutive silent frames to declare EOU.
        At 30ms per frame, 15 frames = 450ms of trailing silence.
        """
        self.vad = vad
        self._silence_threshold = silence_frames_to_eou
        self._consecutive_silent = 0
        self._speech_started = False
    
    def push_frame(self, pcm_frame: bytes) -> bool:
        """
        Feed one 30ms PCM frame.
        Returns True when end-of-utterance is detected.
        """
        if self.vad.is_speech(pcm_frame):
            self._speech_started = True
            self._consecutive_silent = 0
            return False
        else:
            if self._speech_started:
                self._consecutive_silent += 1
                if self._consecutive_silent >= self._silence_threshold:
                    return True  # EOU!
            return False
    
    def reset(self):
        self._consecutive_silent = 0
        self._speech_started = False
        self.vad.reset()
