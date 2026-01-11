(() => {
    const STORAGE_KEY = 'orlando_trip_data';

    const defaultData = {
        trip: {
            name: 'Orlando 2026',
            startDate: '2026-02-22',
            endDate: '2026-03-11',
            base: 'Davenport / Orlando - FL, USA',
            familyOne: 'Bruno, Fernanda, Noah, Alice',
            familyTwo: 'Wilton and Celia',
            subtitle: 'Consolidated document with flights, lodging, car, and key reminders.'
        },
        flights: [],
        lodgings: [],
        cars: [],
        expenses: [],
        transports: [],
        timeline: [],
        reminders: []
    };

    const state = {
        data: null,
        useRemote: false,
        syncStatus: 'Local',
        activeModule: 'dashboard',
        editing: {
            flights: null,
            lodgings: null,
            cars: null,
            expenses: null,
            transports: null,
            timeline: null,
            reminders: null
        }
    };

    const MODULE_IDS = ['dashboard', 'voos', 'hospedagem', 'turo', 'financeiro', 'linha-tempo', 'lembretes'];
    const DEFAULT_MODULE = 'dashboard';

    const generateId = () => {
        if (crypto && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };

    const loadData = () => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return JSON.parse(JSON.stringify(defaultData));
        try {
            return { ...defaultData, ...JSON.parse(raw) };
        } catch (err) {
            return JSON.parse(JSON.stringify(defaultData));
        }
    };

    const saveData = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    };

    const getCookie = (name) => {
        return document.cookie
            .split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith(`${name}=`))
            ?.split('=')[1];
    };

    const setSyncStatus = (value) => {
        state.syncStatus = value;
        const badge = document.getElementById('syncStatus');
        if (badge) badge.textContent = value;
    };

    // Previously all modules rendered together; now we show one module at a time for a cleaner shell-first flow.
    const getModuleFromHash = () => {
        const hash = window.location.hash.replace('#', '').trim();
        return MODULE_IDS.includes(hash) ? hash : DEFAULT_MODULE;
    };

    const getModuleElement = (moduleId) => {
        if (moduleId === 'dashboard') {
            return document.getElementById('module-dashboard');
        }
        return document.getElementById(moduleId);
    };

    const showModule = (moduleId) => {
        MODULE_IDS.forEach((id) => {
            const target = getModuleElement(id);
            if (target) {
                target.hidden = id !== moduleId;
            }
        });
        state.activeModule = moduleId;
    };

    const setActiveMenu = (moduleId) => {
        const links = document.querySelectorAll('#side-menu a[href^=\"#\"]');
        links.forEach((link) => {
            const match = link.getAttribute('href') === `#${moduleId}`;
            link.classList.toggle('active', match);
            const li = link.closest('li');
            if (li) li.classList.toggle('mm-active', match);
        });
    };

    const apiRequest = async (url, options = {}) => {
        const method = (options.method || 'GET').toUpperCase();
        const headers = { ...(options.headers || {}) };
        if (method !== 'GET') {
            headers['x-csrf-token'] = getCookie('csrf_token') || '';
        }
        if (options.body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        const res = await fetch(url, { ...options, method, headers });
        if (!res.ok) {
            throw new Error(`Request failed: ${res.status}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : {};
    };

    const fetchRemoteData = async () => {
        try {
            const [meta, flights, lodgings, cars, expenses, transports, timeline, reminders] = await Promise.all([
                apiRequest('/api/trip/meta'),
                apiRequest('/api/trip/flights'),
                apiRequest('/api/trip/lodgings'),
                apiRequest('/api/trip/cars'),
                apiRequest('/api/trip/expenses'),
                apiRequest('/api/trip/transports'),
                apiRequest('/api/trip/timeline'),
                apiRequest('/api/trip/reminders')
            ]);

            state.useRemote = true;
            setSyncStatus('Server');

            return {
                trip: meta.data || { ...defaultData.trip },
                flights: flights.data || [],
                lodgings: lodgings.data || [],
                cars: cars.data || [],
                expenses: expenses.data || [],
                transports: transports.data || [],
                timeline: timeline.data || [],
                reminders: reminders.data || []
            };
        } catch (err) {
            state.useRemote = false;
            setSyncStatus('Local');
            return null;
        }
    };

    const formatCurrency = (value, currency) => {
        if (value === '' || value === null || value === undefined) return '--';
        const number = Number(value);
        if (Number.isNaN(number)) return '--';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(number);
    };

    const formatDate = (value) => {
        if (!value) return '--';
        return new Date(value).toLocaleDateString('en-US');
    };

    const formatDateTime = (value) => {
        if (!value) return '--';
        return new Date(value).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    };

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    const loadUserEmail = async () => {
        try {
            const res = await apiRequest('/api/me');
            if (res && res.email) {
                setText('userEmail', res.email);
            }
        } catch (err) {
            // Keep placeholder if not authenticated.
        }
    };

    const calcCountdown = (startDate) => {
        if (!startDate) return null;
        const now = new Date();
        const start = new Date(startDate);
        const diff = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const totalsByCurrency = () => {
        const totals = {};
        const add = (value, currency) => {
            if (!currency) return;
            const number = Number(value);
            if (Number.isNaN(number)) return;
            totals[currency] = (totals[currency] || 0) + number;
        };

        state.data.flights.forEach((item) => add(item.cost, item.currency));
        state.data.lodgings.forEach((item) => add(item.cost, item.currency));
        state.data.cars.forEach((item) => add(item.cost, item.currency));
        state.data.expenses.forEach((item) => add(item.amount, item.currency));
        state.data.transports.forEach((item) => add(item.amount, item.currency));

        return totals;
    };

    const totalsByCategory = () => {
        const totals = {};
        const add = (category, value) => {
            const number = Number(value);
            if (Number.isNaN(number)) return;
            totals[category] = (totals[category] || 0) + number;
        };

        state.data.flights.forEach((item) => add('Flights', item.cost));
        state.data.lodgings.forEach((item) => add('Lodging', item.cost));
        state.data.cars.forEach((item) => add('Car', item.cost));
        state.data.expenses.forEach((item) => add(item.category || 'Expenses', item.amount));
        state.data.transports.forEach((item) => add('Transport', item.amount));

        return totals;
    };

    const parseSplit = (value) => {
        if (!value) return [];
        return value
            .split(';')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
                const parts = entry.split(/[:=]/).map((part) => part.trim());
                if (parts.length < 2) return null;
                const name = parts[0];
                const amount = Number(parts[1]);
                if (!name || Number.isNaN(amount)) return null;
                return { name, amount };
            })
            .filter(Boolean);
    };


    const renderTripMeta = () => {
        const { trip } = state.data;
        setText('tripNamePill', trip.name || 'Trip');
        setText('tripTitle', `Trip summary - ${trip.name}`);
        setText('tripSubtitle', trip.subtitle || '');
        setText('tripPeriod', trip.startDate && trip.endDate ? `${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}` : '--');
        setText('tripBase', trip.base || '--');
        setText('familyOne', trip.familyOne || '--');
        setText('familyTwo', trip.familyTwo || '--');

        const countdown = calcCountdown(trip.startDate);
        setText('countdownDays', countdown !== null ? `${countdown} days` : '--');
        setText('countdownLabel', trip.startDate ? `Departure on ${formatDate(trip.startDate)}` : '--');
    };

    const renderDashboard = () => {
        const totals = totalsByCurrency();
        const cad = totals.CAD || 0;
        const brl = totals.BRL || 0;
        const countdown = calcCountdown(state.data.trip.startDate);

        setText('dashboardDays', countdown !== null ? `${countdown} days` : '--');
        setText('dashboardDaysLabel', state.data.trip.startDate ? `Departure on ${formatDate(state.data.trip.startDate)}` : '--');
        setText('dashboardCad', cad ? formatCurrency(cad, 'CAD').replace('CA$', '').trim() : '--');
        setText('dashboardCadLabel', 'Lodging + car + flights');
        setText('dashboardCadTrend', cad ? 'Updated' : '--');
        setText('dashboardBrl', brl ? formatCurrency(brl, 'BRL') : '--');
        setText('dashboardBrlLabel', 'Costs in BRL');

        const pending = state.data.expenses.filter((item) => item.status === 'due');
        setText('dashboardPendingCount', `${pending.length} items`);
        setText('dashboardPendingTitle', pending.length ? pending[0].category || 'Pending item' : '--');
        setText('dashboardPendingLabel', pending.length ? 'Review reminders and deadlines' : '--');
        setText('dashboardPendingNext', pending.length && pending[0].dueDate ? `Next: ${formatDate(pending[0].dueDate)}` : '--');

        const progress = document.getElementById('dashboardProgress');
        if (progress) {
            progress.style.width = state.data.trip.startDate ? '35%' : '0%';
        }
        const brlProgress = document.getElementById('dashboardBrlProgress');
        if (brlProgress) {
            brlProgress.style.width = brl ? '60%' : '0%';
        }
    };

    const renderHeroMetrics = () => {
        const totals = totalsByCurrency();
        setText('metricLodging', state.data.lodgings.length ? formatCurrency(state.data.lodgings[0].cost, state.data.lodgings[0].currency) : '--');
        setText('metricCar', state.data.cars.length ? formatCurrency(state.data.cars[0].cost, state.data.cars[0].currency) : '--');
        const flightCad = state.data.flights.find((item) => item.currency === 'CAD');
        setText('metricFlights', flightCad ? formatCurrency(flightCad.cost, 'CAD').replace('CA$', '').trim() : '--');
    };

    const renderFinanceLanes = () => {
        const container = document.getElementById('financeLanes');
        if (!container) return;
        container.innerHTML = '';

        const items = [
            ...state.data.lodgings.map((item) => ({
                label: 'Lodging',
                value: formatCurrency(item.cost, item.currency),
                detail: item.checkOut ? `Check-out on ${formatDate(item.checkOut)}` : 'No date'
            })),
            ...state.data.cars.map((item) => ({
                label: 'Car',
                value: formatCurrency(item.cost, item.currency),
                detail: item.dropoff ? `Drop-off on ${formatDateTime(item.dropoff)}` : 'No date'
            }))
        ];

        if (!items.length) {
            container.innerHTML = '<div class="list-group-item text-muted">No finance data yet.</div>';
            return;
        }

        items.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'list-group-item d-flex align-items-center justify-content-between gap-3';
            row.innerHTML = `
                <div>
                    <div class="fw-semibold">${item.label}</div>
                    <div class="text-muted small">${item.detail}</div>
                </div>
                <div class="fw-semibold">${item.value}</div>
            `;
            container.appendChild(row);
        });
    };

    const renderChecklist = () => {
        const list = document.getElementById('checklistList');
        if (!list) return;
        list.innerHTML = '';
        const items = state.data.reminders.slice(0, 4);
        if (!items.length) {
            list.innerHTML = '<li class="list-group-item text-muted">No pending reminders.</li>';
            return;
        }
        items.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex align-items-center justify-content-between';
            li.innerHTML = `
                <span>${item.title}</span>
                <small class="text-muted">${formatDate(item.date)}</small>
            `;
            list.appendChild(li);
        });
    };

    const renderTotals = () => {
        const currencyList = document.getElementById('totalsByCurrency');
        const categoryList = document.getElementById('totalsByCategory');
        const groupList = document.getElementById('totalsByGroup');

        if (currencyList) {
            currencyList.innerHTML = '';
            const totals = totalsByCurrency();
            const entries = Object.entries(totals);
            if (!entries.length) {
                currencyList.innerHTML = '<li class="text-muted">No values yet.</li>';
            } else {
                entries.forEach(([currency, value]) => {
                    const li = document.createElement('li');
                    li.className = 'mb-1';
                    li.innerHTML = `<strong>${currency}:</strong> ${formatCurrency(value, currency)}`;
                    currencyList.appendChild(li);
                });
            }
        }

        if (categoryList) {
            categoryList.innerHTML = '';
            const totals = totalsByCategory();
            const entries = Object.entries(totals);
            if (!entries.length) {
                categoryList.innerHTML = '<li class="text-muted">No categories yet.</li>';
            } else {
                entries.forEach(([category, value]) => {
                    const li = document.createElement('li');
                    li.className = 'mb-1';
                    li.innerHTML = `<strong>${category}:</strong> ${value.toFixed(2)}`;
                    categoryList.appendChild(li);
                });
            }
        }

        if (groupList) {
            const baseGroups = [state.data.trip.familyOne, state.data.trip.familyTwo].filter(Boolean);
            const sharedLabel = 'Shared';
            const groupNames = new Set(baseGroups);

            const registerGroup = (name) => {
                if (name) groupNames.add(name);
            };

            const totals = {};
            const addSplit = (amount, currency, group) => {
                if (!totals[group]) totals[group] = {};
                totals[group][currency] = (totals[group][currency] || 0) + amount;
            };
            const splitShared = (amount, currency) => {
                if (!baseGroups.length) {
                    registerGroup(sharedLabel);
                    addSplit(amount, currency, sharedLabel);
                    return;
                }
                const share = amount / baseGroups.length;
                baseGroups.forEach((group) => addSplit(share, currency, group));
            };
            const applyCustomSplit = (split, currency) => {
                const entries = parseSplit(split);
                if (!entries.length) return false;
                entries.forEach(({ name, amount }) => {
                    registerGroup(name);
                    addSplit(amount, currency, name);
                });
                return true;
            };

            const handleItem = (amount, currency, group, split) => {
                const number = Number(amount);
                if (Number.isNaN(number)) return;
                if (applyCustomSplit(split, currency)) return;
                const normalizedGroup = group && group.trim();
                if (normalizedGroup && normalizedGroup !== sharedLabel && normalizedGroup !== 'Compartilhado') {
                    registerGroup(normalizedGroup);
                    addSplit(number, currency, normalizedGroup);
                } else {
                    splitShared(number, currency);
                }
            };

            state.data.expenses.forEach((item) => handleItem(item.amount, item.currency, item.group, item.split));
            state.data.transports.forEach((item) => handleItem(item.amount, item.currency, item.group));
            state.data.flights.forEach((item) => handleItem(item.cost, item.currency, item.group));
            state.data.lodgings.forEach((item) => handleItem(item.cost, item.currency, item.group));
            state.data.cars.forEach((item) => handleItem(item.cost, item.currency, item.group));

            const groups = Array.from(new Set([...baseGroups, ...Array.from(groupNames)])).filter(Boolean);
            if (!groups.length) {
                groupList.innerHTML = '<p class="text-muted mb-0">Define trip groups to see split totals.</p>';
                return;
            }
            groupList.innerHTML = '';
            groups.forEach((group) => {
                const entries = totals[group] ? Object.entries(totals[group]) : [];
                const wrapper = document.createElement('div');
                wrapper.className = 'mb-3';
                const label = document.createElement('div');
                label.className = 'fw-semibold';
                label.textContent = group;
                wrapper.appendChild(label);
                if (!entries.length) {
                    const empty = document.createElement('div');
                    empty.className = 'text-muted small';
                    empty.textContent = 'No costs assigned.';
                    wrapper.appendChild(empty);
                } else {
                    entries.forEach(([currency, value]) => {
                        const item = document.createElement('div');
                        item.className = 'small';
                        item.textContent = `${currency}: ${formatCurrency(value, currency)}`;
                        wrapper.appendChild(item);
                    });
                }
                groupList.appendChild(wrapper);
            });
        }
    };

    const createCard = (title, meta, details, actions) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card border shadow-none mb-3';
        wrapper.innerHTML = `
            <div class="card-body">
                <div class="d-flex flex-column gap-1">
                    <div class="fw-semibold">${title}</div>
                    <div class="text-muted small">${meta}</div>
                    <div>${details || ''}</div>
                    <div class="d-flex gap-2 mt-2">${actions || ''}</div>
                </div>
            </div>
        `;
        return wrapper;
    };

    const renderFlights = () => {
        const container = document.getElementById('flightsList');
        if (!container) return;
        container.innerHTML = '';
        if (!state.data.flights.length) {
            container.innerHTML = '<p class="text-muted mb-0">No flights yet.</p>';
            return;
        }
        state.data.flights.forEach((flight) => {
            const title = `${flight.airline} ${flight.pnr ? `(${flight.pnr})` : ''}`.trim();
            const meta = `${flight.from} -> ${flight.to} | ${formatDateTime(flight.departAt)} - ${formatDateTime(flight.arriveAt)}`;
            const details = `${flight.group || 'Unassigned group'} | ${formatCurrency(flight.cost, flight.currency)}`;
            const card = createCard(title, meta, details, `
                <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${flight.id}" data-entity="flight">Edit</button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${flight.id}" data-entity="flight">Delete</button>
            `);
            container.appendChild(card);
        });
    };

    const renderLodgings = () => {
        const container = document.getElementById('lodgingList');
        if (!container) return;
        container.innerHTML = '';
        if (!state.data.lodgings.length) {
            container.innerHTML = '<p class="text-muted mb-0">No lodging yet.</p>';
            return;
        }
        state.data.lodgings.forEach((item) => {
            const title = item.name;
            const meta = `${item.address} | ${formatDateTime(item.checkIn)} -> ${formatDateTime(item.checkOut)}`;
            const details = `${formatCurrency(item.cost, item.currency)} | ${item.host || 'No host'}`;
            const card = createCard(title, meta, details, `
                <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${item.id}" data-entity="lodging">Edit</button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${item.id}" data-entity="lodging">Delete</button>
            `);
            container.appendChild(card);
        });
    };

    const renderCars = () => {
        const container = document.getElementById('carList');
        if (!container) return;
        container.innerHTML = '';
        if (!state.data.cars.length) {
            container.innerHTML = '<p class="text-muted mb-0">No car rental yet.</p>';
            return;
        }
        state.data.cars.forEach((item) => {
            const title = `${item.vehicle} (${item.provider || 'Provider'})`;
            const meta = `${formatDateTime(item.pickup)} -> ${formatDateTime(item.dropoff)} | ${item.location || ''}`;
            const details = `${formatCurrency(item.cost, item.currency)}`;
            const card = createCard(title, meta, details, `
                <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${item.id}" data-entity="car">Edit</button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${item.id}" data-entity="car">Delete</button>
            `);
            container.appendChild(card);
        });
    };

    const renderExpenses = () => {
        const container = document.getElementById('expensesList');
        if (!container) return;
        container.innerHTML = '';
        if (!state.data.expenses.length) {
            container.innerHTML = '<p class="text-muted mb-0">No expenses yet.</p>';
            return;
        }
        state.data.expenses.forEach((item) => {
            const title = `${item.category} (${item.status})`;
            const meta = item.dueDate ? `Due: ${formatDate(item.dueDate)}` : 'No due date';
            const groupLabel = item.group === 'Compartilhado' ? 'Shared' : item.group;
            const details = `${formatCurrency(item.amount, item.currency)} | ${groupLabel || 'Shared'}`;
            const card = createCard(title, meta, details, `
                <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${item.id}" data-entity="expense">Edit</button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${item.id}" data-entity="expense">Delete</button>
            `);
            container.appendChild(card);
        });
    };

    const renderTransports = () => {
        const container = document.getElementById('transportList');
        if (!container) return;
        container.innerHTML = '';
        if (!state.data.transports.length) {
            container.innerHTML = '<p class="text-muted mb-0">No extra transport yet.</p>';
            return;
        }
        state.data.transports.forEach((item) => {
            const title = item.type;
            const meta = `${formatDate(item.date)} | ${item.group || 'Unassigned group'}`;
            const details = `${formatCurrency(item.amount, item.currency)}`;
            const card = createCard(title, meta, details, `
                <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${item.id}" data-entity="transport">Edit</button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${item.id}" data-entity="transport">Delete</button>
            `);
            container.appendChild(card);
        });
    };

    const renderTimeline = () => {
        const container = document.getElementById('timelineList');
        if (!container) return;
        container.innerHTML = '';
        if (!state.data.timeline.length) {
            container.innerHTML = '<p class="text-muted mb-0">No events yet.</p>';
            return;
        }
        const grouped = state.data.timeline.reduce((acc, item) => {
            const key = item.date || 'No date';
            acc[key] = acc[key] || [];
            acc[key].push(item);
            return acc;
        }, {});

        Object.keys(grouped).sort().forEach((date) => {
            const title = document.createElement('h6');
            title.className = 'text-muted text-uppercase mt-3 mb-2';
            title.textContent = date !== 'No date' ? formatDate(date) : 'No date';
            container.appendChild(title);

            grouped[date].forEach((item) => {
                const row = document.createElement('div');
                row.className = 'border rounded p-3 mb-2';
                row.innerHTML = `
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <div class="fw-semibold">${item.title}</div>
                            <small class="text-muted">${item.time || '--'}</small>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${item.id}" data-entity="timeline">Edit</button>
                            <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${item.id}" data-entity="timeline">Delete</button>
                        </div>
                    </div>
                    ${item.notes ? `<div class="text-muted small mt-2">${item.notes}</div>` : ''}
                `;
                container.appendChild(row);
            });
        });
    };

    const renderReminders = () => {
        const container = document.getElementById('remindersList');
        if (!container) return;
        container.innerHTML = '';
        if (!state.data.reminders.length) {
            container.innerHTML = '<tr><td colspan="4" class="text-muted">No reminders yet.</td></tr>';
            return;
        }
        state.data.reminders.forEach((item) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(item.date)}</td>
                <td>${item.title}</td>
                <td>${item.description || ''}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${item.id}" data-entity="reminder">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${item.id}" data-entity="reminder">Delete</button>
                </td>
            `;
            container.appendChild(tr);
        });
    };

    const renderModule = (moduleId) => {
        switch (moduleId) {
            case 'dashboard':
                renderTripMeta();
                renderHeroMetrics();
                renderDashboard();
                renderFinanceLanes();
                renderChecklist();
                setText('footerNote', 'Auto-updated summary based on saved data.');
                break;
            case 'voos':
                renderFlights();
                break;
            case 'hospedagem':
                renderLodgings();
                break;
            case 'turo':
                renderCars();
                break;
            case 'financeiro':
                renderTotals();
                renderExpenses();
                renderTransports();
                break;
            case 'linha-tempo':
                renderTimeline();
                break;
            case 'lembretes':
                renderReminders();
                break;
            default:
                renderTripMeta();
                renderHeroMetrics();
                renderDashboard();
                renderFinanceLanes();
                renderChecklist();
                setText('footerNote', 'Auto-updated summary based on saved data.');
        }
    };

    const renderActiveModule = () => {
        renderModule(state.activeModule || DEFAULT_MODULE);
    };


    const entityEndpoints = {
        flights: 'flights',
        lodgings: 'lodgings',
        cars: 'cars',
        expenses: 'expenses',
        transports: 'transports',
        timeline: 'timeline',
        reminders: 'reminders'
    };

    const updateTripMeta = async (trip) => {
        if (!state.useRemote) return;
        await apiRequest('/api/trip/meta', {
            method: 'PUT',
            body: JSON.stringify(trip || {})
        });
    };

    const replaceRemoteEntity = async (key, items) => {
        const endpoint = entityEndpoints[key];
        if (!endpoint) return;
        const existing = state.data[key] || [];
        for (const item of existing) {
            if (!item.id) continue;
            await apiRequest(`/api/trip/${endpoint}/${item.id}`, { method: 'DELETE' });
        }
        const updated = [];
        for (const item of items || []) {
            const res = await apiRequest(`/api/trip/${endpoint}`, {
                method: 'POST',
                body: JSON.stringify(item)
            });
            updated.push({ ...item, id: res.id || item.id });
        }
        state.data[key] = updated;
    };

    const bindExportImport = () => {
        const exportButton = document.getElementById('exportData');
        const importInput = document.getElementById('importData');

        if (exportButton) {
            exportButton.addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'orlando-trip.json';
                link.click();
                URL.revokeObjectURL(url);
            });
        }

        if (importInput) {
            importInput.addEventListener('change', async (event) => {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    state.data = { ...defaultData, ...parsed };
                    if (state.useRemote) {
                        await updateTripMeta(state.data.trip);
                        await replaceRemoteEntity('flights', state.data.flights);
                        await replaceRemoteEntity('lodgings', state.data.lodgings);
                        await replaceRemoteEntity('cars', state.data.cars);
                        await replaceRemoteEntity('expenses', state.data.expenses);
                        await replaceRemoteEntity('transports', state.data.transports);
                        await replaceRemoteEntity('timeline', state.data.timeline);
                        await replaceRemoteEntity('reminders', state.data.reminders);
                    }
                    saveData();
                    renderActiveModule();
                } catch (err) {
                    alert('Invalid file. Check the JSON.');
                } finally {
                    importInput.value = '';
                }
            });
        }
    };

    
    const bindLogout = () => {
        const targets = [
            document.getElementById('logoutButton'),
            document.getElementById('logoutLink')
        ].filter(Boolean);
        if (!targets.length) return;
        targets.forEach((target) => {
            target.addEventListener('click', async (event) => {
                if (target.tagName === 'A') {
                    event.preventDefault();
                }
                if (target.tagName === 'BUTTON') {
                    target.disabled = true;
                }
                try {
                    await apiRequest('/api/logout', { method: 'POST' });
                } catch (err) {
                    // Ignore logout errors and force redirect to login.
                }
                window.location.href = '/login';
            });
        });
    };

    const bindVerticalMenuToggle = () => {
        const button = document.getElementById('vertical-menu-btn');
        if (!button) return;
        button.addEventListener('click', (event) => {
            event.preventDefault();
            document.body.classList.toggle('sidebar-enable');
            if (window.innerWidth >= 992) {
                document.body.classList.toggle('vertical-collpsed');
            } else {
                document.body.classList.remove('vertical-collpsed');
            }
        });
    };

const resetForm = (form, editingKey) => {
        form.reset();
        state.editing[editingKey] = null;
    };

    const bindForm = (formId, dataKey, fields) => {
        const form = document.getElementById(formId);
        if (!form) return;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());
            payload.id = state.editing[dataKey] || generateId();

            if (fields.numeric) {
                fields.numeric.forEach((field) => {
                    if (payload[field] !== undefined) {
                        payload[field] = payload[field] ? Number(payload[field]) : 0;
                    }
                });
            }

            const endpoint = entityEndpoints[dataKey];
            if (state.useRemote && endpoint) {
                try {
                    if (state.editing[dataKey]) {
                        await apiRequest(`/api/trip/${endpoint}/${payload.id}`, {
                            method: 'PUT',
                            body: JSON.stringify(payload)
                        });
                    } else {
                        const res = await apiRequest(`/api/trip/${endpoint}`, {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        });
                        payload.id = res.id || payload.id;
                    }
                } catch (err) {
                    alert('Could not save. Please try again.');
                    return;
                }
            }

            if (state.editing[dataKey]) {
                const idx = state.data[dataKey].findIndex((item) => item.id === payload.id);
                if (idx >= 0) state.data[dataKey][idx] = payload;
            } else {
                state.data[dataKey].push(payload);
            }

            saveData();
            renderActiveModule();
            resetForm(form, dataKey);
        });
    };

    const bindCancel = (buttonId, formId, dataKey) => {
        const button = document.getElementById(buttonId);
        const form = document.getElementById(formId);
        if (!button || !form) return;
        button.addEventListener('click', () => {
            resetForm(form, dataKey);
        });
    };

    const bindListActions = () => {
        document.addEventListener('click', (event) => {
            const target = event.target.closest('button[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            const id = target.dataset.id;
            const entity = target.dataset.entity || 'flight';
            const entityMap = {
                flight: 'flights',
                lodging: 'lodgings',
                car: 'cars',
                expense: 'expenses',
                transport: 'transports',
                reminder: 'reminders',
                timeline: 'timeline'
            };
            const key = entityMap[entity] || entity;

            if (action === 'delete') {
                const endpoint = entityEndpoints[key];
                if (state.useRemote && endpoint) {
                    apiRequest(`/api/trip/${endpoint}/${id}`, { method: 'DELETE' })
                        .catch(() => {});
                }
                state.data[key] = state.data[key].filter((item) => item.id !== id);
                saveData();
                renderActiveModule();
                return;
            }

            if (action === 'edit') {
                const item = state.data[key].find((entry) => entry.id === id);
                if (!item) return;
                state.editing[key] = id;
                Object.keys(item).forEach((field) => {
                    const input = document.querySelector(`#${entity}Form [name="${field}"]`);
                    if (input) input.value = item[field];
                });
                return;
            }
        });
    };

    const init = async () => {
        const remote = await fetchRemoteData();
        state.data = remote || loadData();
        loadUserEmail();

        bindForm('flightForm', 'flights', { numeric: ['cost'] });
        bindForm('lodgingForm', 'lodgings', { numeric: ['cost'] });
        bindForm('carForm', 'cars', { numeric: ['cost'] });
        bindForm('expenseForm', 'expenses', { numeric: ['amount'] });
        bindForm('transportForm', 'transports', { numeric: ['amount'] });
        bindForm('timelineForm', 'timeline', { numeric: [] });
        bindForm('reminderForm', 'reminders', { numeric: [] });

        bindCancel('flightCancel', 'flightForm', 'flights');
        bindCancel('lodgingCancel', 'lodgingForm', 'lodgings');
        bindCancel('carCancel', 'carForm', 'cars');
        bindCancel('expenseCancel', 'expenseForm', 'expenses');
        bindCancel('transportCancel', 'transportForm', 'transports');
        bindCancel('timelineCancel', 'timelineForm', 'timeline');
        bindCancel('reminderCancel', 'reminderForm', 'reminders');

        bindListActions();
        bindExportImport();
        bindLogout();
        bindVerticalMenuToggle();

        const initialModule = getModuleFromHash();
        if (!window.location.hash) {
            history.replaceState(null, '', `#${DEFAULT_MODULE}`);
        }
        showModule(initialModule);
        setActiveMenu(initialModule);
        renderModule(initialModule);

        window.addEventListener('hashchange', () => {
            const nextModule = getModuleFromHash();
            showModule(nextModule);
            setActiveMenu(nextModule);
            renderModule(nextModule);
        });
    };

    init();
})();
