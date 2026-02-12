import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupManagementV2 from './index';

const mockUseLocation = vi.fn();
const mockUseGroupData = vi.fn();
const mockUseRealtimeSync = vi.fn();

vi.mock('react-router-dom', () => ({
  useLocation: () => mockUseLocation()
}));

vi.mock('./hooks/useGroupData', () => ({
  useGroupData: (args) => mockUseGroupData(args)
}));

vi.mock('./hooks/useRealtimeSync', () => ({
  useRealtimeSync: (args) => mockUseRealtimeSync(args)
}));

vi.mock('./components/Sidebar/GroupList', () => ({
  default: (props) => (
    <div data-testid="group-list">
      <button data-testid="create-group" onClick={props.onCreateGroup}>create</button>
      <button data-testid="open-bulk" onClick={props.onBulkCreate}>bulk</button>
    </div>
  )
}));

vi.mock('./components/Detail/TabBar', () => ({
  default: (props) => (
    <div data-testid="tabbar" data-active={props.activeTab} data-mode={props.mode}>
      <button data-testid="tab-profile" onClick={() => props.onTabChange('profile')}>profile</button>
      <button data-testid="tab-schedule" onClick={() => props.onTabChange('schedule')}>schedule</button>
    </div>
  )
}));

vi.mock('./components/Modals/BulkCreateModal', () => ({
  default: (props) => (
    <div data-testid="bulk-modal">{props.open ? 'open' : 'closed'}</div>
  )
}));

vi.mock('./components/GroupCommandCenterSkeleton', () => ({
  default: () => <div data-testid="group-skeleton">skeleton</div>
}));

vi.mock('./tabViews', () => ({
  isReadModeTab: (tabKey) => tabKey === 'profile' || tabKey === 'itinerary',
  renderTabView: ({ activeTab }) => <div data-testid="tab-view">{activeTab}</div>
}));

const createHookState = (overrides = {}) => ({
  groups: [],
  filteredGroups: [],
  loading: false,
  activeGroupId: 1,
  activeGroup: { id: 1 },
  groupSchedules: [],
  hasMembers: false,
  itineraryPlans: [],
  locations: [],
  rightPanelWidth: 260,
  filters: { searchText: '' },
  bulkOpen: false,
  bulkSubmitting: false,
  bulkRows: [],
  bulkErrors: {},
  scheduleRevision: 0,
  setRightPanelWidth: vi.fn(),
  setBulkOpen: vi.fn(),
  handleSelectGroup: vi.fn(),
  handleGroupUpdate: vi.fn(),
  handleScheduleUpdate: vi.fn(),
  handleLogisticsChange: vi.fn(),
  handleDeleteGroup: vi.fn(),
  handleQuickCreateGroup: vi.fn(async () => {}),
  updateSearch: vi.fn(),
  addBulkRow: vi.fn(),
  removeBulkRow: vi.fn(),
  updateBulkRow: vi.fn(),
  resetBulkForm: vi.fn(),
  handleBulkCreate: vi.fn(),
  handleCalendarLogisticsUpdate: vi.fn(),
  handleCustomResourcesChange: vi.fn(),
  handleRevisionChange: vi.fn(),
  handleRevisionConflict: vi.fn(),
  fetchGroups: vi.fn(),
  fetchItineraryPlans: vi.fn(),
  fetchLocations: vi.fn(),
  fetchLogistics: vi.fn(),
  fetchSchedules: vi.fn(),
  fetchMemberCount: vi.fn(),
  getActiveGroupId: vi.fn(() => 1),
  ...overrides
});

describe('GroupManagementV2 container', () => {
  it('shows skeleton when first loading and there are no groups', () => {
    mockUseLocation.mockReturnValue({ search: '' });
    mockUseGroupData.mockReturnValue(createHookState({
      loading: true,
      groups: [],
      filteredGroups: []
    }));

    render(<GroupManagementV2 />);
    expect(screen.getByTestId('group-skeleton')).not.toBeNull();
  });

  it('loads schedule tab from query and returns to profile after quick create', async () => {
    const handleQuickCreateGroup = vi.fn(async () => {});
    mockUseLocation.mockReturnValue({ search: '?tab=schedule' });
    mockUseGroupData.mockReturnValue(createHookState({
      groups: [{ id: 1 }],
      filteredGroups: [{ id: 1 }],
      handleQuickCreateGroup
    }));

    render(<GroupManagementV2 />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-view').textContent).toBe('schedule');
    });

    fireEvent.click(screen.getByTestId('create-group'));

    await waitFor(() => {
      expect(handleQuickCreateGroup).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('tab-view').textContent).toBe('profile');
    });
  });

  it('switches tab by TabBar callback', async () => {
    mockUseLocation.mockReturnValue({ search: '' });
    mockUseGroupData.mockReturnValue(createHookState({
      groups: [{ id: 1 }],
      filteredGroups: [{ id: 1 }]
    }));

    render(<GroupManagementV2 />);
    expect(screen.getByTestId('tab-view').textContent).toBe('profile');

    fireEvent.click(screen.getByTestId('tab-schedule'));

    await waitFor(() => {
      expect(screen.getByTestId('tab-view').textContent).toBe('schedule');
      expect(screen.getByTestId('tabbar').getAttribute('data-active')).toBe('schedule');
    });
  });

  it('shows loading overlay when loading with existing groups', () => {
    mockUseLocation.mockReturnValue({ search: '' });
    mockUseGroupData.mockReturnValue(createHookState({
      loading: true,
      groups: [{ id: 1 }],
      filteredGroups: [{ id: 1 }]
    }));

    const { container } = render(<GroupManagementV2 />);
    expect(container.querySelector('.modal-overlay.visible')).not.toBeNull();
  });
});
