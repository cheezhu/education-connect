# Trip-Manager Calendar Detail: EventChip + Key Component Map

This is a quick index for the Calendar Detail page used in Group Management (Calendar Detail).
It helps you locate signature components like `EventChip`, understand what data they render, and which APIs/tables they rely on.

## Where `EventChip` Renders

| Item | File | Used By | What It Renders | Primary Data | Related API | Core Tables |
|---|---|---|---|---|---|---|
| `CalendarDetailEventChip` | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailEventChip.jsx` | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/index.jsx` | One schedule block inside the time-grid (title + optional location) | `schedules` owned by `CalendarDetailWorkspace` | `GET /api/groups/:groupId/schedules` | `schedules` |

## Inventory (Repo Scan)

Current repo scan (`rg "EventChip" trip-manager/frontend/src`) shows `EventChip` only exists in Calendar Detail:

| Kind | File | Notes |
|---|---|---|
| Definition | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailEventChip.jsx` | Component definition |
| Import + render | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/index.jsx` | Used inside grid renderer |

## Source Tags (Top-Right, 2 chars)

`CalendarDetailEventChip` shows a small 2-character "source tag" in the top-right corner to help operators understand where a schedule item comes from:

| Tag | Meaning | How Detected |
|---|---|---|
| `必去` | Must-visit itinerary point | `resourceId` kind is `plan` (`plan-*` / `plan-sync-*`) |
| `食行` | Shixing card template item | `resourceId` kind is `shixing` (`daily:*`) |
| `其他` | Custom / other activity | fallback (including `custom:*`) |

Implementation reference:
- `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailEventChip.jsx`
- `trip-manager/frontend/src/domain/resourceId.ts` (kind detection: `resolveResourceKind()`)
- `trip-manager/frontend/src/domain/resourceSource.ts` (badge mapping: 必去/食行/其他)

## Calendar Detail Module Index (frontend)

| Name | Type | File | Responsibility | Core Tables (if any) |
|---|---|---|---|---|
| `CalendarDetailWorkspace` | Interactive workspace | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/index.jsx` | Drag/drop + create/edit + resource library + designer sync | `schedules`, `itinerary_plans`, `itinerary_plan_items`, `locations` |
| `CalendarDetailTimeGrid` | Component | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailTimeGrid.jsx` | Renders the day/time grid and click-to-create slots | none (pure render) |
| `CalendarDetailEventChip` | Component | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailEventChip.jsx` | Visual/interaction for a single activity chip | `schedules` |
| `CalendarDetailEventEditorPopover` | Component | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailEventEditorPopover.jsx` | Create/edit form (must-visit vs shixing vs custom) | `schedules` |
| `CalendarDetailResourceLibrary` | Component | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailResourceLibrary.jsx` | Resource library UI (must-visit pool / shixing cards / custom cards) + pull/push/reset actions | mixed (see hooks below) |
| `CalendarDetailSidebar` | Component | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailSidebar.jsx` | Right-side container for resource tabs | none (composition) |
| `useCalendarDetailDesignerSync` | Hook | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/hooks/useCalendarDetailDesignerSync.js` | Pull schedules from designer-source; push current schedules to designer | `schedules` |
| `useCalendarDetailMustVisitPool` | Hook | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/hooks/useCalendarDetailMustVisitPool.js` | Builds/filters "must-visit" resource pool | `itinerary_plans`, `itinerary_plan_items`, `locations` |
| `useCalendarDetailShixingResources` | Hook | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/hooks/useCalendarDetailShixingResources.js` | Converts logistics records into draggable "shixing card" resources | `group_logistics_days`, `group_logistics_meals`, `group_logistics_transfers` |

## APIs Used (backend)

These are the main endpoints Calendar Detail relies on:

| Purpose | Method + Path | Backend Route File |
|---|---|---|
| Load locations | `GET /api/locations` | `trip-manager/backend/src/routes/locations.js` |
| Load itinerary plans | `GET /api/itinerary-plans` | `trip-manager/backend/src/routes/itineraryPlans.js` |
| Load schedules | `GET /api/groups/:groupId/schedules` | `trip-manager/backend/src/routes/schedules.js` |
| Save schedules (batch) | `POST /api/groups/:groupId/schedules/batch` | `trip-manager/backend/src/routes/schedules.js` |
| Load shixing logistics | `GET /api/groups/:groupId/logistics` | `trip-manager/backend/src/routes/logistics.js` |
| Save shixing logistics | `POST /api/groups/:groupId/logistics` | `trip-manager/backend/src/routes/logistics.js` |
| Designer source (pull) | `GET /api/groups/:groupId/schedules/designer-source` | `trip-manager/backend/src/routes/schedules.js` |
| Push to designer | `POST /api/groups/:groupId/schedules/push-to-designer` | `trip-manager/backend/src/routes/schedules.js` |

## Styling Notes

| Area | File | Notes |
|---|---|---|
| Grid activity look | `trip-manager/frontend/src/features/calendar-detail/CalendarDetail.css` | `.calendar-activity`, `.activity-title`, `.activity-location`, `.activity-corner-tag` |
| Calendar layout + paging toolbar | `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/styles.css` | container/sidebar styles and `.calendar-range-toolbar` |

## 9+ Days Paging

Calendar Detail was originally optimized for <= 9 days. For longer trips, it uses a paging window to avoid rendering too many day columns at once.

- Implementation (pure helpers): `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/model/calendarWindow.js`
- Used by: `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/index.jsx`
- Current behavior:
  - If `tripDays <= 9`: render all days
  - Else: render a 7-day window, with toolbar controls (prev/next day and prev/next chunk)
