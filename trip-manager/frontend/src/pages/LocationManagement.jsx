import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Checkbox, message, Space, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';
import './LocationManagement.css';

const { Option } = Select;
const { TextArea, Search } = Input;

const getRequestErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || fallback
);

function LocationManagement({ editMode }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('locations');
  const [searchText, setSearchText] = useState('');
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [filteredPlans, setFilteredPlans] = useState([]);
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [filteredPeople, setFilteredPeople] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [filteredHotels, setFilteredHotels] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [filteredVehicles, setFilteredVehicles] = useState([]);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [personModalVisible, setPersonModalVisible] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [hotelModalVisible, setHotelModalVisible] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [form] = Form.useForm();
  const [planForm] = Form.useForm();
  const [personForm] = Form.useForm();
  const [hotelForm] = Form.useForm();
  const [vehicleForm] = Form.useForm();

  // 星期选项
  const weekdayOptions = [
    { label: '周日', value: '0' },
    { label: '周一', value: '1' },
    { label: '周二', value: '2' },
    { label: '周三', value: '3' },
    { label: '周四', value: '4' },
    { label: '周五', value: '5' },
    { label: '周六', value: '6' }
  ];

  const personRoleOptions = [
    { label: '司机', value: 'driver' },
    { label: '导游', value: 'guide' },
    { label: '安保', value: 'security' }
  ];

  // 加载地点数据
  const loadLocations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/locations');
      setLocations(response.data);
    } catch (error) {
      message.error('加载地点数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    setPlanLoading(true);
    try {
      const response = await api.get('/itinerary-plans');
      setPlans(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('加载行程方案失败');
    } finally {
      setPlanLoading(false);
    }
  };

  const loadPeople = async () => {
    setPeopleLoading(true);
    try {
      const response = await api.get('/resources/people');
      setPeople(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('加载人员资源失败');
    } finally {
      setPeopleLoading(false);
    }
  };

  const loadHotels = async () => {
    setHotelsLoading(true);
    try {
      const response = await api.get('/resources/hotels');
      setHotels(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('加载住宿资源失败');
    } finally {
      setHotelsLoading(false);
    }
  };

  const loadVehicles = async () => {
    setVehiclesLoading(true);
    try {
      const response = await api.get('/resources/vehicles');
      setVehicles(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('加载车辆资源失败');
    } finally {
      setVehiclesLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
    loadPlans();
    loadPeople();
    loadHotels();
    loadVehicles();
  }, []);

  useEffect(() => {
    setFilteredLocations(locations);
  }, [locations]);

  useEffect(() => {
    setFilteredPlans(plans);
  }, [plans]);

  useEffect(() => {
    setFilteredPeople(people);
  }, [people]);

  useEffect(() => {
    setFilteredHotels(hotels);
  }, [hotels]);

  useEffect(() => {
    setFilteredVehicles(vehicles);
  }, [vehicles]);

  useEffect(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
      setFilteredLocations(locations);
      setFilteredPlans(plans);
      setFilteredPeople(people);
      setFilteredHotels(hotels);
      setFilteredVehicles(vehicles);
      return;
    }

    setFilteredLocations(
      locations.filter((location) => {
        const haystack = [
          location.name,
          location.address,
          location.notes,
          location.contact_person,
          location.contact_phone
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(keyword);
      })
    );

    setFilteredPlans(
      plans.filter((plan) => {
        const itemNames = Array.isArray(plan.items)
          ? plan.items.map(item => item.location_name).filter(Boolean).join(' ')
          : '';
        const haystack = [plan.name, plan.description, itemNames]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(keyword);
      })
    );

    setFilteredPeople(
      people.filter((person) => {
        const haystack = [
          person.name,
          person.phone,
          person.role,
          person.notes
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(keyword);
      })
    );

    setFilteredHotels(
      hotels.filter((hotel) => {
        const haystack = [
          hotel.name,
          hotel.address,
          hotel.city,
          hotel.contact_person,
          hotel.contact_phone,
          hotel.notes
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(keyword);
      })
    );

    setFilteredVehicles(
      vehicles.filter((vehicle) => {
        const haystack = [
          vehicle.plate,
          vehicle.brand,
          vehicle.model,
          vehicle.notes
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(keyword);
      })
    );
  }, [searchText, locations, plans, people, hotels, vehicles]);

  // 显示创建/编辑对话框
  const showModal = (location = null) => {
    if (!editMode && !location) {
      message.warning('请先进入编辑模式');
      return;
    }
    
    setEditingLocation(location);
    setModalVisible(true);
    
    if (location) {
      form.setFieldsValue({
        name: location.name,
        address: location.address,
        capacity: location.capacity,
        color: location.color || '#1890ff',
        notes: location.notes,
        targetGroups: location.target_groups || 'all',
        contactPerson: location.contact_person || '',
        contactPhone: location.contact_phone || '',
        blockedWeekdays: location.blocked_weekdays ? location.blocked_weekdays.split(',') : [],
        clusterPreferSameDay: Boolean(location.cluster_prefer_same_day)
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        capacity: 100,
        color: '#1890ff',
        targetGroups: 'all',
        blockedWeekdays: [],
        clusterPreferSameDay: false
      });
    }
  };

  // 保存地点
  const handleSave = async (values) => {
    try {
      const blockedValue = values.blockedWeekdays ? values.blockedWeekdays.join(',') : '';
      const data = {
        ...values,
        blockedWeekdays: blockedValue,
        blocked_weekdays: blockedValue,
        target_groups: values.targetGroups,
        contact_person: values.contactPerson,
        contact_phone: values.contactPhone,
        color: values.color || '#1890ff',
        clusterPreferSameDay: values.clusterPreferSameDay ? 1 : 0,
        cluster_prefer_same_day: values.clusterPreferSameDay ? 1 : 0
      };

      if (editingLocation) {
        await api.put(`/locations/${editingLocation.id}`, data);
        message.success('地点更新成功');
      } else {
        await api.post('/locations', data);
        message.success('地点创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      loadLocations();
      loadPlans();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '保存失败'));
    }
  };

  // 删除地点
  const handleDelete = (location) => {
    if (!editMode) {
      message.warning('请先进入编辑模式');
      return;
    }

    Modal.confirm({
      title: '确认删除地点？',
      content: `确定要删除地点"${location.name}"吗？此操作会将地点设为不可用。`,
      onOk: async () => {
        try {
          await api.delete(`/locations/${location.id}`);
          message.success('地点已禁用');
          loadLocations();
          loadPlans();
        } catch (error) {
          message.error(error.response?.data?.error || '删除失败');
        }
      }
    });
  };

  // 显示创建/编辑行程方案
  const showPlanModal = (plan = null) => {
    if (!editMode && !plan) {
      message.warning('请先进入编辑模式');
      return;
    }

    setEditingPlan(plan);
    setPlanModalVisible(true);

    if (plan) {
      planForm.setFieldsValue({
        name: plan.name,
        description: plan.description || '',
        locationIds: (plan.items || []).map(item => item.location_id)
      });
    } else {
      planForm.resetFields();
      planForm.setFieldsValue({ locationIds: [] });
    }
  };

  // 保存行程方案
  const handlePlanSave = async (values) => {
    try {
      const payload = {
        name: values.name,
        description: values.description || '',
        locationIds: values.locationIds || []
      };

      if (editingPlan) {
        await api.put(`/itinerary-plans/${editingPlan.id}`, payload);
        message.success('行程方案更新成功');
      } else {
        await api.post('/itinerary-plans', payload);
        message.success('行程方案创建成功');
      }

      setPlanModalVisible(false);
      planForm.resetFields();
      loadPlans();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '保存失败'));
    }
  };

  // 删除行程方案
  const handlePlanDelete = (plan) => {
    if (!editMode) {
      message.warning('请先进入编辑模式');
      return;
    }

    Modal.confirm({
      title: '确认删除行程方案？',
      content: `确定要删除方案"${plan.name}"吗？`,
      onOk: async () => {
        try {
          await api.delete(`/itinerary-plans/${plan.id}`);
          message.success('行程方案已删除');
          loadPlans();
        } catch (error) {
          message.error(error.response?.data?.error || '删除失败');
        }
      }
    });
  };

  const showPersonModal = (person = null) => {
    if (!editMode && !person) {
      message.warning('请先进入编辑模式');
      return;
    }
    setEditingPerson(person);
    setPersonModalVisible(true);
    if (person) {
      personForm.setFieldsValue({
        role: person.role,
        name: person.name,
        phone: person.phone,
        notes: person.notes
      });
    } else {
      personForm.resetFields();
      personForm.setFieldsValue({ role: 'driver' });
    }
  };

  const handlePersonSave = async (values) => {
    try {
      if (editingPerson) {
        await api.put(`/resources/people/${editingPerson.id}`, values);
        message.success('人员资源已更新');
      } else {
        await api.post('/resources/people', values);
        message.success('人员资源已创建');
      }
      setPersonModalVisible(false);
      personForm.resetFields();
      loadPeople();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '保存失败'));
    }
  };

  const handlePersonDelete = (person) => {
    if (!editMode) {
      message.warning('请先进入编辑模式');
      return;
    }
    Modal.confirm({
      title: '确认删除人员？',
      content: `确定要删除 ${person.name} 吗？`,
      onOk: async () => {
        try {
          await api.delete(`/resources/people/${person.id}`);
          message.success('人员已删除');
          loadPeople();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const showHotelModal = (hotel = null) => {
    if (!editMode && !hotel) {
      message.warning('请先进入编辑模式');
      return;
    }
    setEditingHotel(hotel);
    setHotelModalVisible(true);
    if (hotel) {
      hotelForm.setFieldsValue({
        name: hotel.name,
        address: hotel.address,
        city: hotel.city,
        star: hotel.star,
        price: hotel.price,
        contact_person: hotel.contact_person,
        contact_phone: hotel.contact_phone,
        notes: hotel.notes
      });
    } else {
      hotelForm.resetFields();
    }
  };

  const handleHotelSave = async (values) => {
    try {
      if (editingHotel) {
        await api.put(`/resources/hotels/${editingHotel.id}`, values);
        message.success('住宿资源已更新');
      } else {
        await api.post('/resources/hotels', values);
        message.success('住宿资源已创建');
      }
      setHotelModalVisible(false);
      hotelForm.resetFields();
      loadHotels();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '保存失败'));
    }
  };

  const handleHotelDelete = (hotel) => {
    if (!editMode) {
      message.warning('请先进入编辑模式');
      return;
    }
    Modal.confirm({
      title: '确认删除住宿？',
      content: `确定要删除 ${hotel.name} 吗？`,
      onOk: async () => {
        try {
          await api.delete(`/resources/hotels/${hotel.id}`);
          message.success('住宿已删除');
          loadHotels();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const showVehicleModal = (vehicle = null) => {
    if (!editMode && !vehicle) {
      message.warning('请先进入编辑模式');
      return;
    }
    setEditingVehicle(vehicle);
    setVehicleModalVisible(true);
    if (vehicle) {
      vehicleForm.setFieldsValue({
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        seats: vehicle.seats,
        notes: vehicle.notes
      });
    } else {
      vehicleForm.resetFields();
    }
  };

  const handleVehicleSave = async (values) => {
    try {
      if (editingVehicle) {
        await api.put(`/resources/vehicles/${editingVehicle.id}`, values);
        message.success('车辆资源已更新');
      } else {
        await api.post('/resources/vehicles', values);
        message.success('车辆资源已创建');
      }
      setVehicleModalVisible(false);
      vehicleForm.resetFields();
      loadVehicles();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '保存失败'));
    }
  };

  const handleVehicleDelete = (vehicle) => {
    if (!editMode) {
      message.warning('请先进入编辑模式');
      return;
    }
    Modal.confirm({
      title: '确认删除车辆？',
      content: `确定要删除 ${vehicle.plate} 吗？`,
      onOk: async () => {
        try {
          await api.delete(`/resources/vehicles/${vehicle.id}`);
          message.success('车辆已删除');
          loadVehicles();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '',
      dataIndex: 'color',
      key: 'color',
      width: 36,
      render: (color) => (
        <span
          className="location-color-dot"
          style={{ backgroundColor: color || '#1890ff' }}
        />
      )
    },
    {
      title: '地点名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true
    },
    {
      title: '容量',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (capacity) => `${capacity}人`
    },
    {
      title: '适用团组',
      dataIndex: 'target_groups',
      key: 'target_groups',
      render: (target) => {
        if (target === 'all') return '全部';
        if (target === 'primary') return '小学';
        if (target === 'secondary') return '中学';
        return target;
      }
    },
    {
      title: '归集',
      dataIndex: 'cluster_prefer_same_day',
      key: 'cluster_prefer_same_day',
      width: 96,
      render: (value) => (Number(value) === 1 ? <Tag color="blue">同日优先</Tag> : '-')
    },
    {
      title: '受限日期',
      dataIndex: 'blocked_weekdays',
      key: 'blocked_weekdays',
      render: (blocked) => {
        if (!blocked) return '无';
        const days = blocked.split(',').map(day => {
          const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          return dayNames[parseInt(day)];
        });
        return days.join(', ');
      }
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person'
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            size="small" 
            onClick={() => showModal(record)}
            disabled={!editMode}
          >
            编辑
          </Button>
          <Button 
            icon={<DeleteOutlined />} 
            size="small" 
            danger 
            onClick={() => handleDelete(record)}
            disabled={!editMode}
          >
            禁用
          </Button>
        </Space>
      )
    }
  ];

  const planColumns = [
    {
      title: '方案名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '—'
    },
    {
      title: '包含地点',
      key: 'items',
      render: (_, record) => {
        const items = record.items || [];
        if (items.length === 0) {
          return '未选择';
        }
        return (
          <Space wrap>
            {items.map(item => (
              <Tag key={`${record.id}-${item.location_id}`}>{item.location_name}</Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: '地点数',
      key: 'count',
      width: 90,
      render: (_, record) => `${(record.items || []).length}个`
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => showPlanModal(record)}
            disabled={!editMode}
          >
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handlePlanDelete(record)}
            disabled={!editMode}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const peopleColumns = [
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 90,
      render: (role) => {
        if (role === 'driver') return '司机';
        if (role === 'guide') return '导游';
        if (role === 'security') return '安保';
        return role;
      }
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '联系方式',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => showPersonModal(record)}
            disabled={!editMode}
          >
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handlePersonDelete(record)}
            disabled={!editMode}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const hotelColumns = [
    {
      title: '酒店名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '城市',
      dataIndex: 'city',
      key: 'city',
      width: 80
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true
    },
    {
      title: '星级',
      dataIndex: 'star',
      key: 'star',
      width: 60,
      render: (star) => (star ? `${star}星` : '-')
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 90,
      render: (price) => price || '-'
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person'
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => showHotelModal(record)}
            disabled={!editMode}
          >
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handleHotelDelete(record)}
            disabled={!editMode}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const vehicleColumns = [
    {
      title: '车牌',
      dataIndex: 'plate',
      key: 'plate',
      width: 120
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '座位数',
      dataIndex: 'seats',
      key: 'seats',
      width: 80,
      render: (value) => (value ? `${value}` : '-')
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => showVehicleModal(record)}
            disabled={!editMode}
          >
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handleVehicleDelete(record)}
            disabled={!editMode}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const extraActionMap = {
    locations: {
      label: '添加地点',
      onClick: () => showModal()
    },
    plans: {
      label: '创建方案',
      onClick: () => showPlanModal()
    },
    people: {
      label: '添加人员',
      onClick: () => showPersonModal()
    },
    hotels: {
      label: '添加酒店',
      onClick: () => showHotelModal()
    },
    vehicles: {
      label: '添加车辆',
      onClick: () => showVehicleModal()
    }
  };

  const activeAction = extraActionMap[activeTab] || extraActionMap.locations;
  const extraAction = (
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={activeAction.onClick}
      disabled={!editMode}
    >
      {activeAction.label}
    </Button>
  );

  const tabLabels = [
    { key: 'locations', label: '行程点资源' },
    { key: 'plans', label: '行程方案' },
    { key: 'people', label: '人员管理' },
    { key: 'hotels', label: '住宿管理' },
    { key: 'vehicles', label: '车辆管理' }
  ];

  const searchPlaceholders = {
    locations: '搜索地点/地址/联系人',
    plans: '搜索方案/地点',
    people: '搜索姓名/电话/角色',
    hotels: '搜索酒店/地址/城市',
    vehicles: '搜索车牌/品牌'
  };

  const countsMap = {
    locations: filteredLocations.length,
    plans: filteredPlans.length,
    people: filteredPeople.length,
    hotels: filteredHotels.length,
    vehicles: filteredVehicles.length
  };

  const tableMap = {
    locations: { columns, data: filteredLocations, loading },
    plans: { columns: planColumns, data: filteredPlans, loading: planLoading },
    people: { columns: peopleColumns, data: filteredPeople, loading: peopleLoading },
    hotels: { columns: hotelColumns, data: filteredHotels, loading: hotelsLoading },
    vehicles: { columns: vehicleColumns, data: filteredVehicles, loading: vehiclesLoading }
  };

  const activeTable = tableMap[activeTab] || tableMap.locations;

  return (
    <div className="location-management">
      <Card className="filter-card">
        <Space size="small" wrap>
          <div className="resource-page-title">资源管理</div>
          <div className="resource-tabs">
            {tabLabels.map(tab => (
              <Button
                key={tab.key}
                size="small"
                type={activeTab === tab.key ? 'primary' : 'default'}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <Search
            size="small"
            placeholder={searchPlaceholders[activeTab]}
            allowClear
            style={{ width: 220 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <div className="resource-meta">
            <span>
              共{countsMap[activeTab] ?? 0}个
            </span>
            {extraAction}
          </div>
        </Space>
      </Card>

      <Table
        columns={activeTable.columns}
        dataSource={activeTable.data}
        loading={activeTable.loading}
        rowKey="id"
        size="small"
        className="resource-table"
        pagination={{ pageSize: 10, size: 'small' }}
      />

      <Modal
        title={editingLocation ? '编辑地点' : '添加地点'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="name"
            label="地点名称"
            rules={[{ required: true, message: '请输入地点名称' }]}
          >
            <Input placeholder="请输入地点名称" />
          </Form.Item>

          <Form.Item
            name="address"
            label="地址"
          >
            <TextArea rows={2} placeholder="请输入地址" />
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="capacity"
              label="最大容量"
              rules={[{ required: true, type: 'number', min: 1 }]}
              style={{ flex: 1 }}
            >
              <InputNumber
                min={1}
                max={1000}
                addonAfter="人"
                style={{ width: '100%' }}
                placeholder="最大容量"
              />
            </Form.Item>

            <Form.Item
              name="targetGroups"
              label="适用团组"
              rules={[{ required: true, message: '请选择适用团组' }]}
              style={{ flex: 1 }}
            >
              <Select placeholder="请选择适用团组">
                <Option value="all">全部团组</Option>
                <Option value="primary">仅小学团组</Option>
                <Option value="secondary">仅中学团组</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="color"
              label="色块"
              style={{ width: 120 }}
            >
              <Input type="color" />
            </Form.Item>
          </div>

          <Form.Item
            name="blockedWeekdays"
            label="不可用日期"
          >
            <Checkbox.Group options={weekdayOptions} />
          </Form.Item>

          <Form.Item
            name="clusterPreferSameDay"
            valuePropName="checked"
            label="归集排班"
            tooltip="开启后，求解器会尽量把该地点安排在更少的日期内"
          >
            <Checkbox>同日优先（尽量集中在同一天）</Checkbox>
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="contactPerson"
              label="联系人"
            >
              <Input placeholder="请输入联系人" />
            </Form.Item>

            <Form.Item
              name="contactPhone"
              label="联系电话"
            >
              <Input placeholder="请输入联系电话" />
            </Form.Item>
          </div>

          <Form.Item
            name="notes"
            label="备注"
          >
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingPlan ? '编辑行程方案' : '创建行程方案'}
        open={planModalVisible}
        onCancel={() => {
          setPlanModalVisible(false);
          planForm.resetFields();
        }}
        onOk={() => planForm.submit()}
        width={600}
      >
        <Form
          form={planForm}
          layout="vertical"
          onFinish={handlePlanSave}
        >
          <Form.Item
            name="name"
            label="方案名称"
            rules={[{ required: true, message: '请输入方案名称' }]}
          >
            <Input placeholder="请输入方案名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="说明"
          >
            <TextArea rows={2} placeholder="可选，补充方案说明" />
          </Form.Item>

          <Form.Item
            name="locationIds"
            label="包含地点"
          >
            <Select
              mode="multiple"
              placeholder="选择地点组成方案"
              optionFilterProp="children"
            >
              {locations.map(location => (
                <Option key={location.id} value={location.id}>
                  {location.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingPerson ? '编辑人员' : '添加人员'}
        open={personModalVisible}
        onCancel={() => {
          setPersonModalVisible(false);
          personForm.resetFields();
        }}
        onOk={() => personForm.submit()}
        width={520}
      >
        <Form
          form={personForm}
          layout="vertical"
          onFinish={handlePersonSave}
        >
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="选择角色">
              {personRoleOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="联系电话"
          >
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item
            name="notes"
            label="备注"
          >
            <TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingHotel ? '编辑住宿' : '添加住宿'}
        open={hotelModalVisible}
        onCancel={() => {
          setHotelModalVisible(false);
          hotelForm.resetFields();
        }}
        onOk={() => hotelForm.submit()}
        width={600}
      >
        <Form
          form={hotelForm}
          layout="vertical"
          onFinish={handleHotelSave}
        >
          <Form.Item
            name="name"
            label="酒店名称"
            rules={[{ required: true, message: '请输入酒店名称' }]}
          >
            <Input placeholder="请输入酒店名称" />
          </Form.Item>
          <Form.Item name="address" label="酒店地址">
            <Input placeholder="请输入酒店地址" />
          </Form.Item>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item name="city" label="城市" style={{ flex: 1 }}>
              <Input placeholder="请输入城市" />
            </Form.Item>
            <Form.Item name="star" label="星级" style={{ width: 120 }}>
              <InputNumber min={1} max={7} style={{ width: '100%' }} placeholder="例如 4" />
            </Form.Item>
            <Form.Item name="price" label="价格" style={{ width: 140 }}>
              <Input placeholder="例如 680/间" />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item name="contact_person" label="联系人" style={{ flex: 1 }}>
              <Input placeholder="联系人" />
            </Form.Item>
            <Form.Item name="contact_phone" label="联系电话" style={{ flex: 1 }}>
              <Input placeholder="联系电话" />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="备注">
            <TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingVehicle ? '编辑车辆' : '添加车辆'}
        open={vehicleModalVisible}
        onCancel={() => {
          setVehicleModalVisible(false);
          vehicleForm.resetFields();
        }}
        onOk={() => vehicleForm.submit()}
        width={520}
      >
        <Form
          form={vehicleForm}
          layout="vertical"
          onFinish={handleVehicleSave}
        >
          <Form.Item
            name="plate"
            label="车牌"
            rules={[{ required: true, message: '请输入车牌号' }]}
          >
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item name="brand" label="品牌" style={{ flex: 1 }}>
              <Input placeholder="例如 丰田" />
            </Form.Item>
            <Form.Item name="model" label="车型" style={{ flex: 1 }}>
              <Input placeholder="例如 考斯特" />
            </Form.Item>
          </div>
          <Form.Item name="seats" label="座位数">
            <InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="例如 49" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default LocationManagement;
