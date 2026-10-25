from fastapi.testclient import TestClient
import app.main as main
from app.demo_data import synthetic_rows

client = TestClient(main.app)


def test_health_endpoint_is_available():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_analysis_endpoint_returns_january_decision_scope(monkeypatch):
    actuals, forecasts = synthetic_rows()

    async def fake_load_rows(force_refresh=False):
        return actuals, forecasts, 'demo', 'synthetic test data'

    monkeypatch.setattr(main, 'load_rows', fake_load_rows)
    response = client.get('/api/v1/analysis', params={
        'decision_cutoff': '12:00',
        'selected_decision_date': '2026-01-31',
    })
    assert response.status_code == 200
    body = response.json()
    assert body['metrics']['available_intervals'] == 744
    assert body['metrics']['matched_intervals'] == 744
    assert body['metrics']['coverage_pct'] == 100.0
    assert len(body['records']) == 744
    assert body['selected_day']['decision_date'] == '2026-01-31'
    assert body['selected_day']['delivery_date'] == '2026-02-01'
    assert len(body['selected_day']['intervals']) == 24
    assert body['data_status']['mode'] == 'demo'


def test_analysis_rejects_invalid_cutoff():
    response = client.get('/api/v1/analysis', params={'decision_cutoff': '25:00'})
    assert response.status_code == 422


def test_csv_export_includes_header_and_all_expected_rows(monkeypatch):
    actuals, forecasts = synthetic_rows()

    async def fake_load_rows(force_refresh=False):
        return actuals, forecasts, 'demo', 'synthetic test data'

    monkeypatch.setattr(main, 'load_rows', fake_load_rows)
    response = client.get('/api/v1/export.csv', params={'decision_cutoff': '12:00'})
    assert response.status_code == 200
    lines = response.text.strip().splitlines()
    assert len(lines) == 745
    assert lines[0].startswith('decision_date,delivery_start,delivery_local_time')
    assert '2026-01-31' in lines[-1]
