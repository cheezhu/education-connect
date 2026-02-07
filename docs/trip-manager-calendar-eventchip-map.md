# Trip-Manager Calendar Detail: EventChip + Key Component Map

This document is a quick index for the Calendar Detail page used in Group Management (Calendar Detail).
It helps you locate signature components like `EventChip`, understand what data they render, and which APIs/tables they rely on.

## Where `EventChip` Renders

| Item | File | Used By | What It Renders | Primary Data | Related API | Core Tables |
|---|---|---|---|---|---|---|
| `EventChip` | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/components/EventChip.jsx` | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/index.jsx` | One schedule block inside the time-grid (title + optional location) | `activities` (aka schedules) owned by `CalendarWorkshop` | `GET /api/groups/:groupId/schedules` | `schedules` |

## Calendar Detail Module Index (frontend)

| Name | Type | File | Responsibility | Core Tables (if any) |
|---|---|---|---|---|
| `CalendarWorkshop` | Page container | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/index.jsx` | Loads plan/location data; owns drag/drop + create/edit; passes schedules into grid; owns "designer sync" actions | `schedules`, `itinerary_plans`, `itinerary_plan_items`, `locations` |
| `CalendarGrid` | Component | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/components/CalendarGrid.jsx` | Renders the day/time grid and click-to-create slots | none (pure render) |
| `EventChip` | Component | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/components/EventChip.jsx` | Visual/interaction for a single activity chip | `schedules` |
| `ActivityPopover` | Component | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/components/ActivityPopover.jsx` | Create/edit form (must-visit vs daily vs custom) | `schedules` |
| `ResourcePane` | Component | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/components/ResourcePane.jsx` | Resource library UI (must-visit pool / daily cards / custom cards) + pull/push/reset actions | mixed (see hooks below) |
| `ResourceSidebar` | Component | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/components/ResourceSidebar.jsx` | Right-side container for resource tabs | none (composition) |
| `useDesignerSync` | Hook | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/hooks/useDesignerSync.js` | Pull schedules from designer-source; push current schedules to designer | `schedules` |
| `useMustVisitPool` | Hook | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/hooks/useMustVisitPool.js` | Builds/filters "must-visit" resource pool | `itinerary_plans`, `itinerary_plan_items`, `locations` |
| `useDailyCardResources` | Hook | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/hooks/useDailyCardResources.js` | Converts logistics records into draggable "daily card" resources | `group_logistics_days`, `group_logistics_meals`, `group_logistics_transfers` |

## APIs Used (backend)

These are the main endpoints Calendar Detail relies on:

| Purpose | Method + Path | Backend Route File |
|---|---|---|
| Load locations | `GET /api/locations` | `trip-manager/backend/src/routes/locations.js` |
| Load itinerary plans | `GET /api/itinerary-plans` | `trip-manager/backend/src/routes/itineraryPlans.js` |
| Load schedules | `GET /api/groups/:groupId/schedules` | `trip-manager/backend/src/routes/schedules.js` |
| Save schedules (batch) | `POST /api/groups/:groupId/schedules/batch` | `trip-manager/backend/src/routes/schedules.js` |
| Load daily logistics | `GET /api/groups/:groupId/logistics` | `trip-manager/backend/src/routes/logistics.js` |
| Save daily logistics | `POST /api/groups/:groupId/logistics` | `trip-manager/backend/src/routes/logistics.js` |
| Designer source (pull) | `GET /api/groups/:groupId/schedules/designer-source` | `trip-manager/backend/src/routes/schedules.js` |
| Push to designer | `POST /api/groups/:groupId/schedules/push-to-designer` | `trip-manager/backend/src/routes/schedules.js` |

## Styling Notes

| Area | File | Notes |
|---|---|---|
| Grid activity look | `trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.css` | `.calendar-activity`, `.activity-title`, `.activity-location` |
| Calendar layout + paging toolbar | `trip-manager/frontend/src/pages/GroupEditV2/Calendar/styles.css` | container/sidebar styles and `.calendar-range-toolbar` |

## 9+ Days Paging

If a group's trip spans more than 9 days, Calendar Detail switches into a 7-day window mode with a toolbar (prev/next day + prev/next chunk + date jump).

- Implementation: `trip-manager/frontend/src/pages/GroupEditV2/Calendar/index.jsx`
- Styling: `trip-manager/frontend/src/pages/GroupEditV2/Calendar/styles.css`
