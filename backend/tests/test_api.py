from fastapi.testclient import TestClient

from app.main import app


def test_health():
    r = TestClient(app).get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_metrics_on_ingested_january_data():
    r = TestClient(app).get("/api/metrics", params={"cutoff": "09:00"})
    assert r.status_code == 200
    body = r.json()
    # 31 delivery days x 24 hourly targets, all with actuals.
    assert body["summary"]["n"] == 31 * 24
    assert len(body["by_hour"]) == 24
    assert len(body["by_day"]) == 31
    assert sum(g["n"] for g in body["by_level"]) == 31 * 24
    assert all(g["key"] % 4000 == 0 for g in body["by_level"])


def test_metrics_rejects_bad_cutoff():
    assert TestClient(app).get("/api/metrics", params={"cutoff": "25:00"}).status_code == 422


def test_forecast_day_on_ingested_data():
    r = TestClient(app).get("/api/forecast", params={"day": "2026-01-15", "cutoff": "09:00"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["points"]) == 24
    assert len(body["actuals_half_hourly"]) == 48
    assert body["publish_times_used"] == ["2026-01-14T07:30:00Z"]


def test_forecast_rejects_day_outside_window():
    r = TestClient(app).get("/api/forecast", params={"day": "2026-01-01"})
    assert r.status_code == 422


def test_meta_lists_publish_schedule():
    body = TestClient(app).get("/api/meta").json()
    assert body["delivery_start"] == "2026-01-02"
    assert len(body["publish_times_utc"]) == 8


def test_forecast_lists_runs_on_decision_day_including_late_run():
    body = TestClient(app).get("/api/forecast", params={"day": "2026-01-16"}).json()
    times = [t[11:16] for t in body["runs_on_decision_day"]]
    assert times == ["02:30", "04:30", "07:30", "09:30", "12:25", "15:30", "18:30", "22:30"]
