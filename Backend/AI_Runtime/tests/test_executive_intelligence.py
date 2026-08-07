from Backend.AI_Runtime.intelligence.executive_engine import ExecutiveEngine
from Backend.AI_Runtime.intelligence.insight_generator import InsightGenerator
from Backend.AI_Runtime.intelligence.recommendation_engine import RecommendationEngine
from Backend.AI_Runtime.intelligence.kpi_analyzer import KPIAnalyzer


def test_executive_engine():

    result = ExecutiveEngine().analyze(
        "Financial Data"
    )

    assert result["status"] == "analyzed"


def test_insight():

    result = InsightGenerator().generate(
        "analysis"
    )

    assert result["status"] == "generated"


def test_recommendation():

    result = RecommendationEngine().recommend(
        "insight"
    )

    assert result["status"] == "recommended"


def test_kpi():

    result = KPIAnalyzer().evaluate(
        {"profit": 10}
    )

    assert result["score"] == 100
