"""The weather scenario is bounded and never silently reduces baseline capacity."""
from app.api.action.digital_twin import weather_load_multiplier
from app.api.action.weather_learning import fit_weather_model, learned_multiplier


def test_normal_and_extreme_weather_change_department_load():
    assert weather_load_multiplier("fnb", 0, 30) == 1
    assert weather_load_multiplier("fnb", 60, 43) > 1
    assert weather_load_multiplier("fnb", 500, 60) == 1.35
    assert weather_load_multiplier("security", 500, 60) < weather_load_multiplier("fnb", 500, 60)


def test_weather_model_learns_only_when_it_beats_occupancy_baseline():
    observations = [(65 + i % 12, 22 if i % 3 == 0 else 0, 36,
                     i % 7 >= 5, 5 + (3 if i % 3 == 0 else 0) + i % 4)
                    for i in range(70)]
    fitted = fit_weather_model(observations)
    assert fitted["status"] == "learned"
    assert fitted["samples"] == 70
    assert fitted["mae"] < fitted["baseline_mae"]
    assert learned_multiplier(fitted, 70, 0, 35, 25, 36, False) > 1


def test_weather_model_refuses_sparse_history():
    assert fit_weather_model([(50, 0, 32, False, 0)] * 30)["status"] == "insufficient_history"
