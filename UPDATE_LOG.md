# Update Log

## 2026-02-08
- Docs: consolidated planning docs into `docs/planning/`; archived/removed outdated docs; refreshed runbook/auth/permissions/api references.
- ItineraryDesigner: further refactor/split into hooks (data loading, activity CRUD, group console DnD/actions, group calendar resize). `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx` reduced to ~640 lines. Frontend build verified.

## 2026-02-07
- Planning export: must-visit validation based on `groups.manual_must_visit_location_ids`; export modal supports fixing missing must-visit points and saving back to group fields.
- ItineraryDesigner: initial refactor splitting UI blocks (header, group selector, activity modal, calendar detail modal) and moving planning IO/drag/conflicts into dedicated modules; `index.jsx` reduced to ~1024 lines.
- GroupManagementV2: upgraded itinerary detail view (modern timeline/magazine style) and extracted subcomponents.

## Legacy notes (older, may be incomplete)
- 2026-01-27: calendar detail time slot/mapping adjustments; drag-drop and activity creation bug fixes.
- 2026-01-26: itinerary designer cards: departure marker.
