const express = require('express');
const requireEditLock = require('../middleware/editLock');

const router = express.Router();

const emptyMeals = () => ({
  breakfast: '',
  breakfast_place: '',
  breakfast_disabled: false,
  breakfast_time: '',
  breakfast_end: '',
  breakfast_detached: false,
  lunch: '',
  lunch_place: '',
  lunch_disabled: false,
  lunch_time: '',
  lunch_end: '',
  lunch_detached: false,
  dinner: '',
  dinner_place: '',
  dinner_disabled: false,
  dinner_time: '',
  dinner_end: '',
  dinner_detached: false
});

const emptyTransfer = () => ({
  time: '',
  end_time: '',
  location: '',
  contact: '',
  flight_no: '',
  airline: '',
  terminal: '',
  disabled: false,
  detached: false
});

const buildResourceId = (date, category, key) => {
  if (!date) return null;
  if (category === 'meal') {
    return `daily:${date}:meal:${key}`;
  }
  return `daily:${date}:${category}`;
};

const mapDayRow = (row) => ({
  date: row.activity_date,
  city: row.city || '',
  departure_city: row.departure_city || '',
  arrival_city: row.arrival_city || '',
  hotel: row.hotel_name || '',
  hotel_address: row.hotel_address || '',
  hotel_disabled: Boolean(row.hotel_disabled),
  vehicle: {
    driver: row.vehicle_driver || '',
    plate: row.vehicle_plate || '',
    phone: row.vehicle_phone || ''
  },
  vehicle_disabled: Boolean(row.vehicle_disabled),
  guide: {
    name: row.guide_name || '',
    phone: row.guide_phone || ''
  },
  guide_disabled: Boolean(row.guide_disabled),
  security: {
    name: row.security_name || '',
    phone: row.security_phone || ''
  },
  security_disabled: Boolean(row.security_disabled),
  meals: emptyMeals(),
  pickup: emptyTransfer(),
  dropoff: emptyTransfer(),
  note: row.note || ''
});

const attachMeal = (target, meal) => {
  const key = meal.meal_type;
  if (!key) return;
  target.meals[key] = meal.arrangement || '';
  target.meals[`${key}_place`] = meal.place || '';
  target.meals[`${key}_disabled`] = Boolean(meal.disabled);
  target.meals[`${key}_time`] = meal.start_time || '';
  target.meals[`${key}_end`] = meal.end_time || '';
  target.meals[`${key}_detached`] = Boolean(meal.detached);
};

const attachTransfer = (target, transfer) => {
  const key = transfer.transfer_type === 'pickup' ? 'pickup' : 'dropoff';
  target[key] = {
    time: transfer.start_time || '',
    end_time: transfer.end_time || '',
    location: transfer.location || '',
    contact: transfer.contact || '',
    flight_no: transfer.flight_no || '',
    airline: transfer.airline || '',
    terminal: transfer.terminal || '',
    disabled: Boolean(transfer.disabled),
    detached: Boolean(transfer.detached)
  };
};

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const hasMealData = (meal, key) => {
  if (!meal) return false;
  return (
    Boolean(meal[`${key}_disabled`]) ||
    Boolean(meal[`${key}_detached`]) ||
    hasValue(meal[key]) ||
    hasValue(meal[`${key}_place`]) ||
    hasValue(meal[`${key}_time`]) ||
    hasValue(meal[`${key}_end`])
  );
};

const hasTransferData = (transfer) => {
  if (!transfer) return false;
  return (
    Boolean(transfer.disabled) ||
    Boolean(transfer.detached) ||
    hasValue(transfer.time) ||
    hasValue(transfer.end_time) ||
    hasValue(transfer.location) ||
    hasValue(transfer.contact) ||
    hasValue(transfer.flight_no) ||
    hasValue(transfer.airline) ||
    hasValue(transfer.terminal)
  );
};

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    if (!text || text === '[object Object]' || text === 'undefined' || text === 'null') return '';
    return text;
  }
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return normalizeText(value.name);
    if (typeof value.label === 'string') return normalizeText(value.label);
    if (typeof value.value === 'string' || typeof value.value === 'number') {
      return normalizeText(value.value);
    }
  }
  return '';
};

const fetchLogistics = (db, groupId) => {
  const days = db.prepare(`
    SELECT *
    FROM group_logistics_days
    WHERE group_id = ?
    ORDER BY activity_date
  `).all(groupId);

  if (days.length === 0) {
    return [];
  }

  const dayIds = days.map(day => day.id);
  const placeholders = dayIds.map(() => '?').join(', ');

  const meals = db.prepare(`
    SELECT *
    FROM group_logistics_meals
    WHERE day_id IN (${placeholders})
  `).all(...dayIds);

  const transfers = db.prepare(`
    SELECT *
    FROM group_logistics_transfers
    WHERE day_id IN (${placeholders})
  `).all(...dayIds);

  const dayMap = new Map();
  days.forEach((day) => {
    dayMap.set(day.id, mapDayRow(day));
  });

  meals.forEach((meal) => {
    const target = dayMap.get(meal.day_id);
    if (target) {
      attachMeal(target, meal);
    }
  });

  transfers.forEach((transfer) => {
    const target = dayMap.get(transfer.day_id);
    if (target) {
      attachTransfer(target, transfer);
    }
  });

  return Array.from(dayMap.values());
};

// 获取团组食行卡片
router.get('/groups/:groupId/logistics', (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ error: '无效团组ID' });
  }

  return res.json(fetchLogistics(req.db, groupId));
});

// 批量保存食行卡片（替换团组全部数据）
router.post('/groups/:groupId/logistics', requireEditLock, (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ error: '无效团组ID' });
  }

  const logisticsList = Array.isArray(req.body?.logistics)
    ? req.body.logistics
    : (Array.isArray(req.body) ? req.body : []);

  if (!Array.isArray(logisticsList)) {
    return res.status(400).json({ error: '无效的食行卡片数据' });
  }

  const insertDay = req.db.prepare(`
    INSERT INTO group_logistics_days (
      group_id, activity_date, city, departure_city, arrival_city,
      hotel_name, hotel_address, hotel_disabled,
      vehicle_driver, vehicle_plate, vehicle_phone, vehicle_disabled,
      guide_name, guide_phone, guide_disabled,
      security_name, security_phone, security_disabled,
      note, created_at, updated_at
    ) VALUES (
      @groupId, @date, @city, @departureCity, @arrivalCity,
      @hotelName, @hotelAddress, @hotelDisabled,
      @vehicleDriver, @vehiclePlate, @vehiclePhone, @vehicleDisabled,
      @guideName, @guidePhone, @guideDisabled,
      @securityName, @securityPhone, @securityDisabled,
      @note, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  const insertMeal = req.db.prepare(`
    INSERT INTO group_logistics_meals (
      day_id, meal_type, place, arrangement, disabled,
      start_time, end_time, detached, resource_id, schedule_id,
      created_at, updated_at
    ) VALUES (
      @dayId, @mealType, @place, @arrangement, @disabled,
      @startTime, @endTime, @detached, @resourceId, @scheduleId,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  const insertTransfer = req.db.prepare(`
    INSERT INTO group_logistics_transfers (
      day_id, transfer_type, start_time, end_time, location, contact,
      flight_no, airline, terminal, disabled, detached, resource_id, schedule_id,
      created_at, updated_at
    ) VALUES (
      @dayId, @transferType, @startTime, @endTime, @location, @contact,
      @flightNo, @airline, @terminal, @disabled, @detached, @resourceId, @scheduleId,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  const selectPersonByNamePhone = req.db.prepare(`
    SELECT id, phone
    FROM resource_people
    WHERE role = ? AND name = ? AND phone = ?
    ORDER BY id DESC
    LIMIT 1
  `);

  const selectPersonByName = req.db.prepare(`
    SELECT id, phone
    FROM resource_people
    WHERE role = ? AND name = ? AND (phone IS NULL OR phone = '')
    ORDER BY id DESC
    LIMIT 1
  `);

  const insertPerson = req.db.prepare(`
    INSERT INTO resource_people (role, name, phone, notes)
    VALUES (?, ?, ?, '')
  `);

  const updatePerson = req.db.prepare(`
    UPDATE resource_people
    SET phone = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const updatePersonActive = req.db.prepare(`
    UPDATE resource_people
    SET is_active = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const selectHotelByNameAddress = req.db.prepare(`
    SELECT id, address, city
    FROM resource_hotels
    WHERE name = ? AND address = ?
    ORDER BY id DESC
    LIMIT 1
  `);

  const selectHotelByName = req.db.prepare(`
    SELECT id, address, city
    FROM resource_hotels
    WHERE name = ?
    ORDER BY id DESC
    LIMIT 1
  `);

  const insertHotel = req.db.prepare(`
    INSERT INTO resource_hotels (name, address, city, is_active)
    VALUES (?, ?, ?, 1)
  `);

  const updateHotel = req.db.prepare(`
    UPDATE resource_hotels
    SET
      address = CASE WHEN address IS NULL OR address = '' THEN ? ELSE address END,
      city = CASE WHEN city IS NULL OR city = '' THEN ? ELSE city END,
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const selectVehicleByPlate = req.db.prepare(`
    SELECT id
    FROM resource_vehicles
    WHERE plate = ?
    ORDER BY id DESC
    LIMIT 1
  `);

  const insertVehicle = req.db.prepare(`
    INSERT INTO resource_vehicles (plate, is_active)
    VALUES (?, 1)
  `);

  const updateVehicle = req.db.prepare(`
    UPDATE resource_vehicles
    SET is_active = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const selectRestaurantByNameAddress = req.db.prepare(`
    SELECT id, name, address
    FROM resource_restaurants
    WHERE name = ? AND address = ?
    ORDER BY id DESC
    LIMIT 1
  `);

  const selectRestaurantByName = req.db.prepare(`
    SELECT id, name, address
    FROM resource_restaurants
    WHERE name = ?
    ORDER BY id DESC
    LIMIT 1
  `);

  const selectRestaurantByAddress = req.db.prepare(`
    SELECT id, name, address
    FROM resource_restaurants
    WHERE address = ?
    ORDER BY id DESC
    LIMIT 1
  `);

  const insertRestaurant = req.db.prepare(`
    INSERT INTO resource_restaurants (name, address, city, notes, is_active)
    VALUES (?, ?, ?, '', 1)
  `);

  const updateRestaurant = req.db.prepare(`
    UPDATE resource_restaurants
    SET
      name = CASE WHEN name IS NULL OR name = '' THEN ? ELSE name END,
      address = CASE WHEN address IS NULL OR address = '' THEN ? ELSE address END,
      city = CASE WHEN city IS NULL OR city = '' THEN ? ELSE city END,
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const updateRestaurantActive = req.db.prepare(`
    UPDATE resource_restaurants
    SET is_active = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const selectFlightByNoAirline = req.db.prepare(`
    SELECT id, flight_no, airline
    FROM resource_flights
    WHERE flight_no = ? AND airline = ?
    ORDER BY id DESC
    LIMIT 1
  `);

  const selectFlightByNo = req.db.prepare(`
    SELECT id, flight_no, airline
    FROM resource_flights
    WHERE flight_no = ?
    ORDER BY id DESC
    LIMIT 1
  `);

  const selectFlightByAirlineOnly = req.db.prepare(`
    SELECT id, flight_no, airline
    FROM resource_flights
    WHERE airline = ? AND (flight_no IS NULL OR flight_no = '')
    ORDER BY id DESC
    LIMIT 1
  `);

  const insertFlight = req.db.prepare(`
    INSERT INTO resource_flights (flight_no, airline, notes, is_active)
    VALUES (?, ?, '', 1)
  `);

  const updateFlightAirline = req.db.prepare(`
    UPDATE resource_flights
    SET
      airline = CASE WHEN airline IS NULL OR airline = '' THEN ? ELSE airline END,
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const updateFlightActive = req.db.prepare(`
    UPDATE resource_flights
    SET is_active = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const replaceAll = req.db.transaction((items) => {
    req.db.prepare('DELETE FROM group_logistics_days WHERE group_id = ?').run(groupId);

    const upsertPerson = (role, name, phone) => {
      const cleanName = normalizeText(name);
      if (!cleanName) return;
      const cleanPhone = normalizeText(phone);
      let row = null;
      if (cleanPhone) {
        row = selectPersonByNamePhone.get(role, cleanName, cleanPhone);
      }
      if (!row) {
        row = selectPersonByName.get(role, cleanName);
      }
      if (!row) {
        insertPerson.run(role, cleanName, cleanPhone || null);
        return;
      }
      if (cleanPhone && row.phone && row.phone !== cleanPhone) {
        insertPerson.run(role, cleanName, cleanPhone);
        return;
      }
      if (cleanPhone && (!row.phone || row.phone === '')) {
        updatePerson.run(cleanPhone, row.id);
      } else {
        updatePersonActive.run(row.id);
      }
    };

    const upsertHotel = (name, address, city) => {
      const cleanName = normalizeText(name);
      if (!cleanName) return;
      const cleanAddress = normalizeText(address);
      const cleanCity = normalizeText(city);
      let row = null;
      if (cleanAddress) {
        row = selectHotelByNameAddress.get(cleanName, cleanAddress);
      }
      if (!row) {
        row = selectHotelByName.get(cleanName);
      }
      if (!row) {
        insertHotel.run(cleanName, cleanAddress || null, cleanCity || null);
        return;
      }
      updateHotel.run(cleanAddress || null, cleanCity || null, row.id);
    };

    const upsertVehicle = (plate) => {
      const cleanPlate = normalizeText(plate);
      if (!cleanPlate) return;
      const row = selectVehicleByPlate.get(cleanPlate);
      if (!row) {
        insertVehicle.run(cleanPlate);
      } else {
        updateVehicle.run(row.id);
      }
    };

    const upsertRestaurant = (name, address, city) => {
      const cleanName = normalizeText(name);
      const cleanAddress = normalizeText(address);
      if (!cleanName && !cleanAddress) return;
      const cleanCity = normalizeText(city);

      let row = null;
      if (cleanName && cleanAddress) {
        row = selectRestaurantByNameAddress.get(cleanName, cleanAddress);
      }
      if (!row && cleanName) {
        row = selectRestaurantByName.get(cleanName);
      }
      if (!row && cleanAddress) {
        row = selectRestaurantByAddress.get(cleanAddress);
      }

      if (!row) {
        insertRestaurant.run(cleanName || cleanAddress, cleanAddress || null, cleanCity || null);
        return;
      }

      if (cleanName && cleanAddress && row.name && row.address && (row.name !== cleanName || row.address !== cleanAddress)) {
        insertRestaurant.run(cleanName, cleanAddress, cleanCity || null);
        return;
      }

      if (cleanName || cleanAddress || cleanCity) {
        updateRestaurant.run(cleanName || null, cleanAddress || null, cleanCity || null, row.id);
      } else {
        updateRestaurantActive.run(row.id);
      }
    };

    const upsertFlight = (flightNo, airline) => {
      const cleanFlightNo = normalizeText(flightNo).toUpperCase();
      const cleanAirline = normalizeText(airline);
      if (!cleanFlightNo && !cleanAirline) return;

      let row = null;
      if (cleanFlightNo && cleanAirline) {
        row = selectFlightByNoAirline.get(cleanFlightNo, cleanAirline);
      }
      if (!row && cleanFlightNo) {
        row = selectFlightByNo.get(cleanFlightNo);
      }
      if (!row && cleanAirline && !cleanFlightNo) {
        row = selectFlightByAirlineOnly.get(cleanAirline);
      }

      if (!row) {
        insertFlight.run(cleanFlightNo || '', cleanAirline || '');
        return;
      }

      if (cleanFlightNo && cleanAirline && row.airline && row.airline !== cleanAirline) {
        insertFlight.run(cleanFlightNo, cleanAirline);
        return;
      }

      if (cleanAirline && (!row.airline || row.airline === '')) {
        updateFlightAirline.run(cleanAirline, row.id);
      } else {
        updateFlightActive.run(row.id);
      }
    };

    items.forEach((item, index) => {
      const date = item.date || item.activity_date;
      if (!date) {
        throw new Error(`第 ${index + 1} 条数据缺少日期`);
      }

      const dayResult = insertDay.run({
        groupId,
        date,
        city: normalizeText(item.city),
        departureCity: normalizeText(item.departure_city),
        arrivalCity: normalizeText(item.arrival_city),
        hotelName: normalizeText(item.hotel),
        hotelAddress: normalizeText(item.hotel_address),
        hotelDisabled: item.hotel_disabled ? 1 : 0,
        vehicleDriver: normalizeText(item.vehicle?.driver || item.vehicle?.name),
        vehiclePlate: normalizeText(item.vehicle?.plate),
        vehiclePhone: normalizeText(item.vehicle?.phone),
        vehicleDisabled: item.vehicle_disabled ? 1 : 0,
        guideName: normalizeText(item.guide?.name || item.guide),
        guidePhone: normalizeText(item.guide?.phone),
        guideDisabled: item.guide_disabled ? 1 : 0,
        securityName: normalizeText(item.security?.name || item.security),
        securityPhone: normalizeText(item.security?.phone),
        securityDisabled: item.security_disabled ? 1 : 0,
        note: normalizeText(item.note)
      });

      const dayId = dayResult.lastInsertRowid;
      const meals = item.meals || {};
      ['breakfast', 'lunch', 'dinner'].forEach((key) => {
        if (!hasMealData(meals, key)) return;
        insertMeal.run({
          dayId,
          mealType: key,
          place: meals[`${key}_place`] || '',
          arrangement: meals[key] || '',
          disabled: meals[`${key}_disabled`] ? 1 : 0,
          startTime: meals[`${key}_time`] || '',
          endTime: meals[`${key}_end`] || '',
          detached: meals[`${key}_detached`] ? 1 : 0,
          resourceId: buildResourceId(date, 'meal', key),
          scheduleId: null
        });
      });

      const pickup = item.pickup || {};
      if (hasTransferData(pickup)) {
        insertTransfer.run({
          dayId,
          transferType: 'pickup',
          startTime: pickup.time || '',
          endTime: pickup.end_time || '',
          location: pickup.location || '',
          contact: pickup.contact || '',
          flightNo: pickup.flight_no || '',
          airline: pickup.airline || '',
          terminal: pickup.terminal || '',
          disabled: pickup.disabled ? 1 : 0,
          detached: pickup.detached ? 1 : 0,
          resourceId: buildResourceId(date, 'pickup'),
          scheduleId: null
        });
      }

      const dropoff = item.dropoff || {};
      if (hasTransferData(dropoff)) {
        insertTransfer.run({
          dayId,
          transferType: 'dropoff',
          startTime: dropoff.time || '',
          endTime: dropoff.end_time || '',
          location: dropoff.location || '',
          contact: dropoff.contact || '',
          flightNo: dropoff.flight_no || '',
          airline: dropoff.airline || '',
          terminal: dropoff.terminal || '',
          disabled: dropoff.disabled ? 1 : 0,
          detached: dropoff.detached ? 1 : 0,
          resourceId: buildResourceId(date, 'dropoff'),
          scheduleId: null
        });
      }

      upsertHotel(item.hotel, item.hotel_address, item.city || item.arrival_city || item.departure_city);
      upsertVehicle(item.vehicle?.plate);
      upsertPerson('driver', item.vehicle?.driver || item.vehicle?.name, item.vehicle?.phone);
      upsertPerson('guide', item.guide?.name || item.guide, item.guide?.phone);
      upsertPerson('security', item.security?.name || item.security, item.security?.phone);

      ['breakfast', 'lunch', 'dinner'].forEach((key) => {
        const mealDisabled = Boolean(meals[`${key}_disabled`]);
        if (mealDisabled) return;
        upsertRestaurant(
          meals[key],
          meals[`${key}_place`],
          item.city || item.arrival_city || item.departure_city
        );
      });

      upsertFlight(item.pickup?.flight_no, item.pickup?.airline);
      upsertFlight(item.dropoff?.flight_no, item.dropoff?.airline);
    });
  });

  try {
    replaceAll(logisticsList);
    const refreshed = fetchLogistics(req.db, groupId);
    return res.json(refreshed);
  } catch (error) {
    console.error('保存食行卡片失败:', error);
    return res.status(500).json({ error: '保存食行卡片失败' });
  }
});

module.exports = router;
