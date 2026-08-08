from Backend.AI._Runtime.final_runtime.hooshyar.hooshyar_runtime_continuity_runtime import (
    HooshyarRuntimeContinuityRuntime,
)

def test_chapter326_input():
    result = HooshyarRuntimeContinuityRuntime().run("test-input")

    assert result["input"] == "test-input"
    assert result["status"] == "hooshyar_runtime_continuity_ready"
