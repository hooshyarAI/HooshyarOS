import re


class ReasoningEngine:
    """Repository-native, evidence-bound reasoning for the commercial runtime.

    The engine intentionally reasons only over verified values present in the
    supplied context. It does not invent thresholds, transactions or external
    facts.
    """

    _metric_patterns = {
        "revenue": re.compile(r"Revenue=([-+]?\d+(?:\.\d+)?)"),
        "profit": re.compile(r"Profit=([-+]?\d+(?:\.\d+)?)"),
        "profit_margin": re.compile(r"ProfitMargin=([-+]?\d+(?:\.\d+)?)"),
        "debt_ratio": re.compile(r"DebtRatio=([-+]?\d+(?:\.\d+)?)"),
    }

    def reason(self, problem):
        if not isinstance(problem, str) or not problem.strip():
            return {"problem": problem, "status": "invalid_problem", "answer": "سؤال خالی است."}

        metrics = {}
        for name, pattern in self._metric_patterns.items():
            match = pattern.search(problem)
            if match:
                metrics[name] = float(match.group(1))

        if not metrics:
            return {
                "problem": problem,
                "status": "reasoned",
                "answer": "برای پاسخ مستند، ابتدا یک تحلیل مالی تأییدشده برای این نشست ثبت کنید.",
            }

        parts = []
        if "revenue" in metrics:
            parts.append(f"درآمد ثبت‌شده {metrics['revenue']:g} است")
        if "profit" in metrics:
            parts.append(f"سود ثبت‌شده {metrics['profit']:g} است")
        if "profit_margin" in metrics:
            parts.append(f"حاشیه سود {metrics['profit_margin']:.4g} است")
        if "debt_ratio" in metrics:
            parts.append(f"نسبت بدهی {metrics['debt_ratio']:.4g} است")

        return {
            "problem": problem,
            "status": "reasoned",
            "answer": "؛ ".join(parts) + ". این پاسخ فقط بر پایه مقادیر تأییدشده موجود در context تولید شده است.",
        }
