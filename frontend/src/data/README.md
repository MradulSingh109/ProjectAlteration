# ML Data Integration

All data in NWIS is sourced directly from the ML engineering pipeline and processed dataset located in `/ml/data/`:
- Raw PDF technical documents: `/ml/data/raw/good_data/`
- Historical Wells: `/ml/data/processed/good_data_processed/historical_dataset/wells.csv`
- Extracted Drilling Events: `/ml/data/processed/good_data_processed/historical_dataset/events.csv`
- Geological Formations: `/ml/src/features/stratigraphy.py`
- Real-time Sensor Telemetry & Hazards: `/ml/data/processed/risk_prediction_dataset.csv`
- Well Proximity & Similarity: `/ml/data/processed/good_data_processed/similarity_matrix.csv`

The frontend communicates exclusively with the backend REST APIs (`/api/v1/*`), which are populated with this real ML processed dataset. Synthetic prototyping mock files have been retired.
