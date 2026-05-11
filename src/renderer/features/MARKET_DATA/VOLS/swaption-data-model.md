# Swaption / Vols Data Model

## BASE Sources

These tables are the legacy BASE sources:

- `SWAPTION_ATM_BASE` = BASE ATM surface
- `SWAPTION_ATM_SMILE` = BASE smile spreads
- `SWAPTION_CUBE` = BASE cube

## Scenario Sources

These tables store user-created scenarios:

- `SWAPTION_ATM_SCENARIO_DATA` = saved ATM scenarios
- `SWAPTION_SMILE_SCENARIO_DATA` = saved smile scenarios
- `SWAPTION_ACTIVE` = currently active scenario

## Rule

`EUSWAPTION_*` is BASE data.  
`SWAPTION_*` is scenario / active data.

Do not mix BASE source loading with active scenario loading.