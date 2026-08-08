from Backend.AI._Runtime.governance_engine.transaction.failure.failure_detector import (
    TransactionFailureDetector,
)


def test_chapter314_transaction_failure_detection():
    result = TransactionFailureDetector().detect("test-transaction")

    assert result["transaction"] == "test-transaction"
    assert result["status"] == "transaction_failure_detected"
