from collections import defaultdict, deque
from statistics import mean, pstdev


class AnomalyDetectionService:
    def __init__(self) -> None:
        self.latency_windows: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=60))
        self.error_windows: dict[str, deque[int]] = defaultdict(lambda: deque(maxlen=60))

    def evaluate(self, api_name: str, status_code: int, latency_ms: float) -> dict:
        latencies = self.latency_windows[api_name]
        errors = self.error_windows[api_name]
        baseline_latency = mean(latencies) if latencies else latency_ms
        deviation = pstdev(latencies) if len(latencies) > 8 else max(baseline_latency * 0.15, 30)
        latency_z = max(0.0, (latency_ms - baseline_latency) / max(deviation, 1))

        is_error = 1 if status_code >= 500 or status_code == 408 else 0
        error_rate = (sum(errors) + is_error) / max(len(errors) + 1, 1)

        score = round(min(100, latency_z * 18 + error_rate * 85), 2)
        reasons: list[str] = []
        if latency_z >= 2.4 or latency_ms > 900:
            reasons.append("latency_spike")
        if error_rate >= 0.18 or is_error:
            reasons.append("error_spike")
        if status_code == 0:
            reasons.append("downtime")

        latencies.append(latency_ms)
        errors.append(is_error)

        return {
            "is_anomaly": score >= 35 or bool(reasons),
            "score": score,
            "reasons": reasons,
            "baseline_latency": round(baseline_latency, 2),
            "error_rate": round(error_rate * 100, 2),
        }


anomaly_detector = AnomalyDetectionService()
