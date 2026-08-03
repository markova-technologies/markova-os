"""
Real Word Error Rate (WER) evaluator for Amharic STT and LLM prompt quality.
WER = (Substitutions + Deletions + Insertions) / Total Reference Words
"""
import time
from typing import Dict, Any, List


def _tokenize(text: str) -> List[str]:
    """Split text into word tokens, normalizing whitespace."""
    return text.strip().lower().split()


def compute_wer(reference: str, hypothesis: str) -> float:
    """
    Compute Word Error Rate using dynamic programming (Wagner-Fischer algorithm).
    WER = (S + D + I) / N  where N = number of words in reference.
    Returns a float between 0.0 (perfect) and 1.0+ (many errors).
    """
    ref_tokens = _tokenize(reference)
    hyp_tokens = _tokenize(hypothesis)

    r = len(ref_tokens)
    h = len(hyp_tokens)

    if r == 0:
        return 1.0 if h > 0 else 0.0

    # Build edit distance matrix
    dp = [[0] * (h + 1) for _ in range(r + 1)]

    for i in range(r + 1):
        dp[i][0] = i  # deletions
    for j in range(h + 1):
        dp[0][j] = j  # insertions

    for i in range(1, r + 1):
        for j in range(1, h + 1):
            if ref_tokens[i - 1] == hyp_tokens[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]  # match
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],      # deletion
                    dp[i][j - 1],      # insertion
                    dp[i - 1][j - 1]   # substitution
                )

    edit_distance = dp[r][h]
    return round(edit_distance / r, 4)


class MLEvaluator:
    """
    Automated Model Evaluation & Fine-Tuning Pipeline for Amharic STT & LLM prompts.
    Uses real WER (Word Error Rate) via Wagner-Fischer edit distance algorithm.
    """
    WER_THRESHOLD = 0.20  # 20% WER or less = acceptable quality

    def evaluate_response(
        self,
        prompt: str,
        generated_text: str,
        ground_truth: str
    ) -> Dict[str, Any]:
        """
        Evaluate a generated response against a ground truth reference.
        Returns WER score, accuracy score, pass/fail, and detailed breakdown.
        """
        start = time.perf_counter()

        wer = compute_wer(ground_truth, generated_text)
        accuracy_score = max(0.0, round(1.0 - wer, 4))
        passed = wer <= self.WER_THRESHOLD

        ref_tokens = _tokenize(ground_truth)
        hyp_tokens = _tokenize(generated_text)

        latency_ms = round((time.perf_counter() - start) * 1000, 2)

        return {
            "prompt": prompt,
            "wer": wer,
            "accuracyScore": accuracy_score,
            "passedQualityThreshold": passed,
            "werThreshold": self.WER_THRESHOLD,
            "referenceWordCount": len(ref_tokens),
            "hypothesisWordCount": len(hyp_tokens),
            "latencyMs": latency_ms,
        }

    def batch_evaluate(
        self,
        samples: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Evaluate a batch of (prompt, generated_text, ground_truth) samples.
        Returns mean WER, pass rate, and per-sample results.
        """
        results = []
        for s in samples:
            result = self.evaluate_response(
                s.get("prompt", ""),
                s.get("generated_text", ""),
                s.get("ground_truth", "")
            )
            results.append(result)

        if not results:
            return {"error": "No samples provided"}

        mean_wer = round(sum(r["wer"] for r in results) / len(results), 4)
        pass_rate = round(sum(1 for r in results if r["passedQualityThreshold"]) / len(results), 4)

        return {
            "sampleCount": len(results),
            "meanWer": mean_wer,
            "passRate": pass_rate,
            "passedQualityThreshold": pass_rate >= 0.80,
            "results": results
        }
