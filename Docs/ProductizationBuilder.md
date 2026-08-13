# HooshyarOS Productization Builder

The repository-native productization worker uses `Backend/AI_Runtime/productization_builder.py` to produce deterministic Windows bootstrap and Android application artifacts without duplicating HBOS business logic.

Windows artifacts are created under `dist/productization/windows/installer`. Android project artifacts are created under `android/` and use the existing web/API boundary.
