from fastapi.testclient import TestClient
from Backend.AI_Runtime.main import app


client = TestClient(app)


def test_execute_api():

    response = client.post(
        "/execute?goal=FinancialEngine"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["build"]["status"] == "generated"

    assert data["test"]["status"] == "passed"

