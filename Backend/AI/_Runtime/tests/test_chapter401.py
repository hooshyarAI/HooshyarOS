from Backend.AI._Runtime.runtime_assurance.readiness.runtime_readiness_finalizer import RuntimeReadinessFinalizer

def test_chapter401():
    result = RuntimeReadinessFinalizer().finalize("test-runtime")
    assert result["runtime"] == "test-runtime"
    assert result["status"] == "runtime_readiness_finalized"
