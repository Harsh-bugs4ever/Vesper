# Midnight tasks implementation and verification

## Task 1: weather-driven digital twin

The GM's existing Department Operations Cockpit now opens one department at a time. Its new 14-day outlook reads confirmed bookings, existing occupancy forecasts, the assigned department head, active staff, stock items and recent consumption movements. It requests live forecast weather from Open-Meteo, geocodes the property's city, renders a city-area OpenStreetMap view, and lists relevant public news from Google News RSS. The rain and temperature sliders run a read-only counterfactual and change estimated department staffing demand. They never modify bookings, rosters or inventory.

The weather response now refits against 90 days of archived weather, room bookings and department work records each time the GM requests a scenario. It uses a ridge model with a 14-day temporal holdout; it only activates when there are enough wet and dry observations and its holdout error beats an occupancy/weekend-only baseline. The GM sees sample size and error band. When the property has insufficient data or weather is not predictive, a bounded assumption is labelled instead. The map uses `Property.settings.latitude` and `Property.settings.longitude` when configured, otherwise the city center. Public articles are unverified signals. Stock depletion is only projected when consumption movements exist. More historical operating data would improve precision.

## Task 2: Nugen alignment

`docs/nugen-resort-operations.txt` is the domain corpus. `scripts/nugen_align.py` uploads it, starts alignment, checks an existing project, and requests deployment once READY. The GM digital twin calls the Nugen chat inference endpoint only when `VESPER_NUGEN_API_KEY` and `VESPER_NUGEN_ALIGNED_MODEL_ID` are configured. Docker Compose forwards both environment variables to the backend. It shows the actual model status and does not substitute a generic model.

On 27 September 2026, the domain document uploaded successfully as `document_01m3fy12z278p0md`. Five alignment attempts (`alignment_01m3fy20qksqghx0`, `alignment_01m3fy2zd9e2ng9n`, `alignment_01m3fykr0qg55049`, `alignment_01m3fytmz570vb6a`, and `alignment_01m3fz19azt0kvwb`) failed in Nugen with `Finetuning failed: Nugen job creation failed: HTTP 502 Bad Gateway`. A different alignment-ready base model and the replacement API key produced the same failure. No aligned model was deployed or used for inference. This is an external service failure; Task 2 is pending a successful Nugen training run.

Once Nugen training is working, run `python scripts/nugen_align.py --document-id document_01m3fy12z278p0md`, then `python scripts/nugen_align.py --alignment-id <new-id>` after its status becomes READY. Run `python scripts/nugen_align.py --model-id <deployed-model-id>` until it reports DEPLOYED and prints a domain-specific test response. Set `VESPER_NUGEN_ALIGNED_MODEL_ID` to that model ID and verify the GM panel reports `aligned_inference` with an actual response. Do not commit the API key.

On 27 September 2026, the locally running backend connected to PostgreSQL and Redis. The live GM digital-twin endpoint returned a 14-day Housekeeping scenario with current weather and public news. The demo history supplied 90 weather samples but insufficient department work observations for a validated weather response, so the view correctly labelled its scenario as an assumption. After concurrent feed lookups and linear occupancy aggregation, a fresh-process calculation took about 5.4 seconds and a repeat took about 0.3 seconds on this laptop.

Sources: [Open-Meteo forecast](https://open-meteo.com/en/docs), [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api), [Nugen alignment](https://docs.nugen.in/api-reference/general/create-alignment), [Nugen inference](https://docs.nugen.in/api-reference/inference/generate-chat-completions).

## Existing AI automation audit

The occupancy engine can use Prophet or a gradient model when enough history and optional dependencies are available; otherwise it reports a seasonal baseline. The workforce engine can use OR-Tools for roster optimization; otherwise it uses a greedy allocator. Action cards automate detection and manager review, but some named "AI" action engines contain hard-coded demo assumptions and revenue impacts. Those cards should not be presented as independently measured gains. Nugen aligned inference is wired into the new GM outlook but remains inactive until training and deployment succeed.
