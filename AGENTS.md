# Windline engineering and interface guidelines

This repository is a small decision-support pilot. Prefer correctness, observability and clarity over feature breadth.

## Domain and data integrity
- Keep the approved data scope to Elexon `FUELHH` (`fuelType = WIND`) and `WINDFOR` only.
- Never select a forecast published after the decision cut-off for a historical decision.
- Keep all timestamps timezone-aware. Interpret decision times in `Europe/London` and normalize joins to UTC.
- Do not silently impute missing periods. Report data coverage alongside every accuracy summary.
- Synthetic data is for UI/demo use only and must always be labelled as synthetic.
- Do not describe wind forecast error as a complete power procurement requirement: demand and other supply are outside this scope.

## Front-end quality
- Keep navigation, metric cards, chart legends, status labels and spacing consistent with the design tokens in `frontend/src/styles.css`.
- Make every interactive action keyboard reachable, visibly focused, and labelled for assistive technology.
- Use restrained transitions on `transform` and `opacity` where they clarify state. Respect `prefers-reduced-motion` and do not animate layout properties.
- Preserve loading, error, empty and partial-data states; never hide coverage or source mode.
- Use tabular numerals for data comparisons and explain MW, forecast error sign and time zone in the UI.
- Reference Raphael Salaja's User Interface Wiki: https://github.com/raphaelsalaja/userinterface-wiki

## Architecture and reviewability
- Keep the Elexon HTTP adapter, deterministic analytics, API boundary, and UI components separated.
- Add regression tests for every change to date interpretation, forecast selection, duplicate handling or metric math.
- Avoid adding dependencies unless they materially reduce complexity.
- Update `README.md` and the relevant walkthrough docs when behavior or setup changes.
