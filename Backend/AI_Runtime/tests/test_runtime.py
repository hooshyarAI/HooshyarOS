from fastapi.testclient import TestClient
from Backend.AI_Runtime.main import app


client = TestClient(app)


def test_runtime_health():

    response = client.get("/")

    assert response.status_code == 200

    data = response.json()

    assert data["runtime"] == "AI"
    assert data["status"] == "online"