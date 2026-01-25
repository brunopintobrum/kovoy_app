(() => {
    const state = {
        groups: [],
        group: null,
        groupId: null,
        families: [],
        participants: [],
        airlines: [],
        expenses: [],
        flights: [],
        lodgings: [],
        transports: [],
        tickets: [],
        summary: null,
        canEdit: false,
        editing: {
            flightId: null,
            flightSeatMap: {},
            flightBaggageMap: {},
            lodgingId: null,
            transportId: null,
            ticketId: null,
            expenseId: null,
            expenseConfig: null
        }
    };

    const moduleExpenseConfigs = [
        { prefix: 'flight', toggleId: 'flightLinkExpense', fieldsId: 'flightExpenseFields', payerId: 'flightExpensePayer' },
        { prefix: 'lodging', toggleId: 'lodgingLinkExpense', fieldsId: 'lodgingExpenseFields', payerId: 'lodgingExpensePayer' },
        { prefix: 'transport', toggleId: 'transportLinkExpense', fieldsId: 'transportExpenseFields', payerId: 'transportExpensePayer' },
        { prefix: 'ticket', toggleId: 'ticketLinkExpense', fieldsId: 'ticketExpenseFields', payerId: 'ticketExpensePayer' }
    ];

    const getCookie = (name) => {
        return document.cookie
            .split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith(`${name}=`))
            ?.split('=')[1];
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
            const text = await res.text();
            let payload = null;
            try {
                payload = text ? JSON.parse(text) : null;
            } catch (err) {
                payload = null;
            }
            const message = payload && payload.error ? payload.error : `Request failed: ${res.status}`;
            throw new Error(message);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : {};
    };

    const formatCurrency = (amount, currency) => {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency || 'USD',
                maximumFractionDigits: 2
            }).format(amount || 0);
        } catch (err) {
            return `${currency || 'USD'} ${Number(amount || 0).toFixed(2)}`;
        }
    };

    const formatDate = (value) => {
        if (!value) return '--';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return parsed.toLocaleDateString('en-US');
    };

    const formatDateTime = (value) => {
        if (!value) return '--';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return parsed.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    };

    const formatDateTimeLocal = (value) => {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        const pad = (part) => String(part).padStart(2, '0');
        return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
    };

    const renderAirlineOptions = () => {
        const list = document.getElementById('flightAirlineList');
        if (!list) return;
        list.innerHTML = '';
        state.airlines.forEach((airline) => {
            const option = document.createElement('option');
            option.value = airline.name;
            list.appendChild(option);
        });
        syncFlightAirlineIdFromInput();
    };

    const syncFlightAirlineIdFromInput = () => {
        const input = document.getElementById('flightAirline');
        const hidden = document.getElementById('flightAirlineId');
        if (!input || !hidden) return;
        const value = input.value.trim().toLowerCase();
        if (!value) {
            hidden.value = '';
            return;
        }
        const match = state.airlines.find((item) => item.name.toLowerCase() === value);
        hidden.value = match ? match.id : '';
    };

    const loadAirlines = async () => {
        try {
            const response = await apiRequest('/api/airlines');
            state.airlines = response.data || [];
        } catch (err) {
            console.warn('Failed to load airlines:', err.message);
        } finally {
            renderAirlineOptions();
        }
    };

    const setupFlightAirlineAutocomplete = () => {
        const input = document.getElementById('flightAirline');
        if (!input) return;
        const handler = () => syncFlightAirlineIdFromInput();
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    };

    const formatFlightClassLabel = (value) => {
        if (!value) return '-';
        return value
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    };

    const parseGroupId = () => {
        const params = new URLSearchParams(window.location.search);
        const id = Number(params.get('groupId'));
        return Number.isInteger(id) && id > 0 ? id : null;
    };

    const setUserProfile = async () => {
        try {
            const me = await apiRequest('/api/me');
            const email = me.email || 'Account';
            const userEmail = document.getElementById('userEmail');
            if (userEmail) userEmail.textContent = email;
            if (me.avatarUrl) {
                const avatar = document.getElementById('userAvatar');
                if (avatar) avatar.src = me.avatarUrl;
            }
        } catch (err) {
            window.location.href = '/login';
        }
    };

    const loadGroups = async () => {
        const data = await apiRequest('/api/groups');
        state.groups = data.data || [];
        const groupId = state.groupId || parseGroupId();
        state.groupId = groupId;
        state.group = state.groups.find((group) => group.id === groupId) || null;
        if (!state.group) {
            if (state.groups.length) {
                window.location.href = `/dashboard?groupId=${state.groups[0].id}`;
                return false;
            }
            window.location.href = '/groups';
            return false;
        }
        state.canEdit = ['owner', 'admin'].includes(state.group.role);
        return true;
    };

    const validateForm = (form) => {
        if (!form) return false;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return false;
        }
        form.classList.remove('was-validated');
        return true;
    };

    const loadGroupData = async () => {
        const [families, participants, expenses, flights, lodgings, transports, tickets, summary] = await Promise.all([
            apiRequest(`/api/groups/${state.groupId}/families`),
            apiRequest(`/api/groups/${state.groupId}/participants`),
            apiRequest(`/api/groups/${state.groupId}/expenses`),
            apiRequest(`/api/groups/${state.groupId}/flights`),
            apiRequest(`/api/groups/${state.groupId}/lodgings`),
            apiRequest(`/api/groups/${state.groupId}/transports`),
            apiRequest(`/api/groups/${state.groupId}/tickets`),
            apiRequest(`/api/groups/${state.groupId}/summary`)
        ]);
        state.families = families.data || [];
        state.participants = participants.data || [];
        state.expenses = expenses.data || [];
        state.flights = flights.data || [];
        state.lodgings = lodgings.data || [];
        state.transports = transports.data || [];
        state.tickets = tickets.data || [];
        state.summary = summary.data || {};
    };

    const renderGroupHeader = () => {
        const groupName = document.getElementById('groupName');
        const groupCurrency = document.getElementById('groupCurrency');
        const roleBadge = document.getElementById('groupRoleBadge');
        const selector = document.getElementById('groupSelector');

        if (groupName) groupName.textContent = state.group.name;
        if (groupCurrency) groupCurrency.textContent = state.group.defaultCurrency;
        if (roleBadge) {
            roleBadge.textContent = state.group.role;
            roleBadge.classList.remove('bg-soft-primary', 'text-primary', 'bg-soft-success', 'text-success');
            if (state.group.role === 'owner') {
                roleBadge.classList.add('bg-soft-success', 'text-success');
            } else {
                roleBadge.classList.add('bg-soft-primary', 'text-primary');
            }
        }

        if (selector) {
            selector.innerHTML = '';
            state.groups.forEach((group) => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = `${group.name} (${group.defaultCurrency})`;
                if (group.id === state.groupId) option.selected = true;
                selector.appendChild(option);
            });
        }
    };

    const renderSummary = () => {
        const totalEl = document.getElementById('summaryTotal');
        const participantsEl = document.getElementById('summaryParticipants');
        const familiesEl = document.getElementById('summaryFamilies');
        const debtsEl = document.getElementById('summaryDebts');
        const totalSpend = state.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

        if (totalEl) totalEl.textContent = formatCurrency(totalSpend, state.group.defaultCurrency);
        if (participantsEl) participantsEl.textContent = state.participants.length;
        if (familiesEl) familiesEl.textContent = state.families.length;
        if (debtsEl) debtsEl.textContent = state.summary.debts ? state.summary.debts.length : 0;
    };

    const renderBalances = () => {
        const participantRows = document.getElementById('participantBalances');
        const familyRows = document.getElementById('familyBalances');

        if (participantRows) {
            participantRows.innerHTML = '';
            const balances = state.summary.participantBalances || [];
            if (!balances.length) {
                participantRows.innerHTML = '<tr><td colspan="2" class="text-muted text-center">No data.</td></tr>';
            } else {
                balances.forEach((item) => {
                    const tr = document.createElement('tr');
                    const badgeClass = item.balance >= 0 ? 'text-success' : 'text-danger';
                    tr.innerHTML = `
                        <td>${item.displayName}</td>
                        <td class="text-end ${badgeClass}">${formatCurrency(item.balance, state.group.defaultCurrency)}</td>
                    `;
                    participantRows.appendChild(tr);
                });
            }
        }

        if (familyRows) {
            familyRows.innerHTML = '';
            const balances = state.summary.familyBalances || [];
            if (!balances.length) {
                familyRows.innerHTML = '<tr><td colspan="2" class="text-muted text-center">No data.</td></tr>';
            } else {
                balances.forEach((item) => {
                    const tr = document.createElement('tr');
                    const badgeClass = item.balance >= 0 ? 'text-success' : 'text-danger';
                    tr.innerHTML = `
                        <td>${item.name}</td>
                        <td class="text-end ${badgeClass}">${formatCurrency(item.balance, state.group.defaultCurrency)}</td>
                    `;
                    familyRows.appendChild(tr);
                });
            }
        }
    };

    const renderDebts = () => {
        const list = document.getElementById('debtList');
        if (!list) return;
        list.innerHTML = '';
        const debts = state.summary.debts || [];
        if (!debts.length) {
            list.innerHTML = '<li class="list-group-item text-muted text-center">No debts yet.</li>';
            return;
        }
        debts.forEach((debt) => {
            const from = state.participants.find((p) => p.id === debt.fromParticipantId);
            const to = state.participants.find((p) => p.id === debt.toParticipantId);
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex align-items-center justify-content-between';
            li.innerHTML = `
                <div>
                    <div class="fw-semibold">${from ? from.displayName : `#${debt.fromParticipantId}`}</div>
                    <small class="text-muted">pays ${to ? to.displayName : `#${debt.toParticipantId}`}</small>
                </div>
                <span class="badge bg-soft-danger text-danger">${formatCurrency(debt.amount, state.group.defaultCurrency)}</span>
            `;
            list.appendChild(li);
        });
    };

    const renderFamilies = () => {
        const list = document.getElementById('familyList');
        const select = document.getElementById('participantFamily');
        if (!list || !select) return;
        list.innerHTML = '';
        select.innerHTML = '<option value="">No family</option>';

        if (!state.families.length) {
            list.innerHTML = '<li class="list-group-item text-muted text-center">No families yet.</li>';
            return;
        }

        state.families.forEach((family) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex align-items-center justify-content-between';
            li.innerHTML = `
                <span>${family.name}</span>
                <button class="btn btn-sm btn-outline-danger" data-action="delete-family" data-id="${family.id}">Delete</button>
            `;
            if (!state.canEdit) {
                li.querySelector('button').disabled = true;
            }
            list.appendChild(li);

            const option = document.createElement('option');
            option.value = family.id;
            option.textContent = family.name;
            select.appendChild(option);
        });
    };

    const renderParticipants = () => {
        const list = document.getElementById('participantList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.participants.length) {
            list.innerHTML = '<tr><td colspan="4" class="text-muted text-center">No participants yet.</td></tr>';
            return;
        }
        const familyMap = new Map(state.families.map((family) => [family.id, family.name]));
        state.participants.forEach((participant) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${participant.displayName}</td>
                <td>${participant.familyId ? familyMap.get(participant.familyId) || '-' : '-'}</td>
                <td class="text-capitalize">${participant.type || '-'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-participant" data-id="${participant.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelector('button').disabled = true;
            }
            list.appendChild(tr);
        });
    };

    const renderExpenses = () => {
        const list = document.getElementById('expenseList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.expenses.length) {
            list.innerHTML = '<tr><td colspan="6" class="text-muted text-center">No expenses yet.</td></tr>';
            return;
        }
        const participantMap = new Map(state.participants.map((p) => [p.id, p.displayName]));
        state.expenses.forEach((expense) => {
            const rawSplitType = expense.splits && expense.splits.length ? expense.splits[0].targetType : '-';
            const splitType = rawSplitType === 'participant' ? 'participants'
                : rawSplitType === 'family'
                    ? 'families'
                    : rawSplitType;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${expense.description}</td>
                <td>${formatCurrency(expense.amount, expense.currency)}</td>
                <td>${expense.date}</td>
                <td>${participantMap.get(expense.payerParticipantId) || '-'}</td>
                <td class="text-capitalize">${splitType}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-expense" data-id="${expense.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-expense" data-id="${expense.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelectorAll('button').forEach((button) => {
                    button.disabled = true;
                });
            }
            list.appendChild(tr);
        });
    };

    const renderFlights = () => {
        const list = document.getElementById('flightList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.flights.length) {
            list.innerHTML = '<tr><td colspan="12" class="text-muted text-center">No flights yet.</td></tr>';
            return;
        }
        const participantMap = new Map(state.participants.map((participant) => [participant.id, participant.displayName]));
        state.flights.forEach((flight) => {
            const participantNames = (flight.participantIds || [])
                .map((id) => participantMap.get(id))
                .filter(Boolean);
            const passengersLabel = participantNames.length ? participantNames.join(', ') : '-';
            const seatLabels = (flight.participantIds || [])
                .map((id) => {
                    const name = participantMap.get(id);
                    if (!name) return null;
                    const seat = flight.participantSeats?.[id];
                    return seat ? `${name} (${seat})` : name;
                })
                .filter(Boolean);
            const seatsLabel = seatLabels.length ? seatLabels.join(', ') : '-';
            const baggageLabels = (flight.participantIds || [])
                .map((id) => {
                    const name = participantMap.get(id);
                    if (!name) return null;
                    const baggage = flight.participantBaggage?.[id];
                    return baggage ? `${name} (${baggage})` : name;
                })
                .filter(Boolean);
            const baggageLabel = baggageLabels.length ? baggageLabels.join(', ') : '-';
            const flightLabel = [flight.airline, flight.flightNumber].filter(Boolean).join(' ');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${flightLabel || '-'}</td>
                <td>${flight.pnr || '-'}</td>
                <td>${formatFlightClassLabel(flight.cabinClass)}</td>
                <td>${seatsLabel}</td>
                <td>${baggageLabel}</td>
                <td>${flight.from || '-'} -> ${flight.to || '-'}</td>
                <td>${formatDateTime(flight.departAt)}</td>
                <td>${formatDateTime(flight.arriveAt)}</td>
                <td>${passengersLabel}</td>
                <td class="text-capitalize">${flight.status || 'planned'}</td>
                <td>${formatCurrency(flight.cost, flight.currency)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-flight" data-id="${flight.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-flight" data-id="${flight.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelectorAll('button').forEach((button) => {
                    button.disabled = true;
                });
            }
            list.appendChild(tr);
        });
    };

    const renderLodgings = () => {
        const list = document.getElementById('lodgingList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.lodgings.length) {
            list.innerHTML = '<tr><td colspan="8" class="text-muted text-center">No lodgings yet.</td></tr>';
            return;
        }
        state.lodgings.forEach((lodging) => {
            const location = [lodging.city, lodging.state, lodging.country].filter(Boolean).join(', ');
            const checkIn = `${formatDate(lodging.checkIn)} ${lodging.checkInTime || ''}`.trim();
            const checkOut = `${formatDate(lodging.checkOut)} ${lodging.checkOutTime || ''}`.trim();
            const rooms = lodging.roomType
                ? `${lodging.roomQuantity || 0} x ${lodging.roomType} (occ ${lodging.roomOccupancy || 0})`
                : '-';
            const contactParts = [lodging.contact, lodging.contactPhone, lodging.contactEmail].filter(Boolean);
            const contact = contactParts.length ? contactParts.join(' · ') : '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${lodging.name || '-'}</td>
                <td>${location || '-'}</td>
                <td>${checkIn} -> ${checkOut}</td>
                <td>${rooms}</td>
                <td class="text-capitalize">${lodging.status || 'planned'}</td>
                <td>${formatCurrency(lodging.cost, lodging.currency)}</td>
                <td>${contact}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-lodging" data-id="${lodging.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-lodging" data-id="${lodging.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelectorAll('button').forEach((button) => {
                    button.disabled = true;
                });
            }
            list.appendChild(tr);
        });
    };

    const renderTransports = () => {
        const list = document.getElementById('transportList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.transports.length) {
            list.innerHTML = '<tr><td colspan="8" class="text-muted text-center">No transports yet.</td></tr>';
            return;
        }
        state.transports.forEach((transport) => {
            const route = `${transport.origin || '-'} -> ${transport.destination || '-'}`;
            const provider = transport.provider || '-';
            const locator = transport.locator || '-';
            const providerLine = [provider, locator].filter((value) => value && value !== '-').join(' · ') || '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${transport.type || '-'}</td>
                <td>${route}</td>
                <td>${formatDateTime(transport.departAt)}</td>
                <td>${formatDateTime(transport.arriveAt)}</td>
                <td class="text-capitalize">${transport.status || 'planned'}</td>
                <td>${formatCurrency(transport.amount, transport.currency)}</td>
                <td>${providerLine}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-transport" data-id="${transport.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-transport" data-id="${transport.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelectorAll('button').forEach((button) => {
                    button.disabled = true;
                });
            }
            list.appendChild(tr);
        });
    };

    const renderTickets = () => {
        const list = document.getElementById('ticketList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.tickets.length) {
            list.innerHTML = '<tr><td colspan="7" class="text-muted text-center">No tickets yet.</td></tr>';
            return;
        }
        const participantMap = new Map(state.participants.map((participant) => [participant.id, participant.displayName]));
        state.tickets.forEach((ticket) => {
            const participantNames = (ticket.participantIds || [])
                .map((id) => participantMap.get(id))
                .filter(Boolean);
            const participantsLabel = participantNames.join(', ') || '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${ticket.type || '-'}</td>
                <td>${formatDateTime(ticket.eventAt)}</td>
                <td>${ticket.location || '-'}</td>
                <td class="text-capitalize">${ticket.status || 'planned'}</td>
                <td>${formatCurrency(ticket.amount, ticket.currency)}</td>
                <td>${participantsLabel}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-ticket" data-id="${ticket.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-ticket" data-id="${ticket.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelectorAll('button').forEach((button) => {
                    button.disabled = true;
                });
            }
            list.appendChild(tr);
        });
    };

    const renderSplitTargets = () => {
        const wrapper = document.getElementById('splitTargets');
        const errorEl = document.getElementById('splitTargetsError');
        if (!wrapper) return;
        const type = document.querySelector('input[name="splitType"]:checked')?.value || 'participants';
        const mode = document.querySelector('input[name="splitMode"]:checked')?.value || 'equal';
        const targets = type === 'participants' ? state.participants : state.families;
        const editingConfig = state.editing.expenseConfig;
        const selectedIds = editingConfig?.targetIds || null;
        const manualMap = editingConfig?.manualAmounts || null;

        if (!targets.length) {
            wrapper.innerHTML = '<div class="text-muted">No targets available.</div>';
            if (errorEl) errorEl.classList.add('d-none');
            const summary = document.getElementById('splitSummary');
            if (summary) {
                summary.textContent = 'No targets available yet.';
            }
            return;
        }
        wrapper.innerHTML = '';
        if (errorEl) errorEl.classList.add('d-none');
        if (errorEl) {
            errorEl.textContent = 'Select at least one target.';
        }
        targets.forEach((target) => {
            const label = document.createElement('label');
            label.className = 'form-check d-flex align-items-center gap-2';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-check-input';
            input.value = target.id;
            if (selectedIds) {
                input.checked = selectedIds.includes(target.id);
            } else if (mode === 'manual') {
                input.checked = true;
            }
            input.addEventListener('change', () => {
                if (errorEl) errorEl.classList.add('d-none');
                updateSplitSummary();
            });
            label.appendChild(input);
            const span = document.createElement('span');
            span.textContent = target.displayName || target.name;
            label.appendChild(span);
            if (mode === 'manual') {
                const amountInput = document.createElement('input');
                amountInput.type = 'number';
                amountInput.step = '0.01';
                amountInput.min = '0';
                amountInput.placeholder = '0.00';
                amountInput.className = 'form-control form-control-sm ms-auto';
                amountInput.dataset.targetId = String(target.id);
                if (manualMap && manualMap[target.id] != null) {
                    amountInput.value = manualMap[target.id];
                }
                amountInput.addEventListener('input', () => {
                    if (errorEl) errorEl.classList.add('d-none');
                    updateSplitSummary();
                });
                label.appendChild(amountInput);
            }
            wrapper.appendChild(label);
        });
        updateSplitSummary();
        updateExpenseAvailability();
    };

    const updateSplitSummary = () => {
        const summary = document.getElementById('splitSummary');
        if (!summary) return;
        const amountValue = Number(document.getElementById('expenseAmount')?.value || 0);
        const currencyValue = document.getElementById('expenseCurrency')?.value || state.group?.defaultCurrency || 'USD';
        const mode = document.querySelector('input[name="splitMode"]:checked')?.value || 'equal';
        const checkedTargets = Array.from(document.querySelectorAll('#splitTargets input[type="checkbox"]:checked'));
        if (!checkedTargets.length) {
            summary.textContent = 'Select at least one target to preview the split.';
            return;
        }
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            summary.textContent = 'Set an amount to preview the split.';
            return;
        }
        if (mode === 'manual') {
            let total = 0;
            checkedTargets.forEach((checkbox) => {
                const amountInput = checkbox.closest('label')?.querySelector('input[type="number"]');
                const value = Number(amountInput?.value || 0);
                if (Number.isFinite(value)) {
                    total += value;
                }
            });
            const formattedTotal = formatCurrency(total, currencyValue);
            const formattedAmount = formatCurrency(amountValue, currencyValue);
            if (Number(total.toFixed(2)) === Number(amountValue.toFixed(2))) {
                summary.textContent = `Manual split total: ${formattedTotal}.`;
            } else {
                summary.textContent = `Manual split total: ${formattedTotal} (must match ${formattedAmount}).`;
            }
            return;
        }
        const perTarget = amountValue / checkedTargets.length;
        summary.textContent = `Selected ${checkedTargets.length} targets. Estimated per target: ${formatCurrency(perTarget, currencyValue)}.`;
    };

    const populateExpenseSelectors = () => {
        const payerSelect = document.getElementById('expensePayer');
        const currencySelect = document.getElementById('expenseCurrency');
        if (!payerSelect) return;
        payerSelect.innerHTML = '';
        if (!state.participants.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Add a participant first';
            payerSelect.appendChild(option);
        } else {
            state.participants.forEach((participant) => {
                const option = document.createElement('option');
                option.value = participant.id;
                option.textContent = participant.displayName;
                payerSelect.appendChild(option);
            });
        }
        if (currencySelect && state.group) {
            currencySelect.value = state.group.defaultCurrency;
        }
        populateModuleExpensePayers();
        updateExpenseAvailability();
    };

    const populateModuleExpensePayers = () => {
        moduleExpenseConfigs.forEach((config) => {
            const select = document.getElementById(config.payerId);
            if (!select) return;
            select.innerHTML = '';
            if (!state.participants.length) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Add a participant first';
                select.appendChild(option);
                return;
            }
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select payer';
            select.appendChild(placeholder);
            state.participants.forEach((participant) => {
                const option = document.createElement('option');
                option.value = participant.id;
                option.textContent = participant.displayName;
                select.appendChild(option);
            });
        });
    };

    const setMultiSelectValues = (select, values) => {
        if (!select) return;
        const selected = new Set((values || []).map((value) => String(value)));
        Array.from(select.options).forEach((option) => {
            option.selected = selected.has(option.value);
        });
    };

    const applyFlightParticipantSearchFilter = () => {
        const search = document.getElementById('flightParticipantSearch');
        const select = document.getElementById('flightParticipants');
        if (!search || !select) return;
        const query = search.value.trim().toLowerCase();
        Array.from(select.options).forEach((option) => {
            option.hidden = query ? !option.textContent.toLowerCase().includes(query) : false;
        });
    };

    const setupFlightParticipantSearch = () => {
        const search = document.getElementById('flightParticipantSearch');
        const select = document.getElementById('flightParticipants');
        if (!search || !select) return;
        search.addEventListener('input', applyFlightParticipantSearchFilter);
        select.addEventListener('change', () => {
            syncFlightSeatMapWithSelection();
            renderFlightPassengerSeats();
            syncFlightBaggageMapWithSelection();
            renderFlightPassengerBaggage();
        });
    };

    const populateFlightParticipants = () => {
        const select = document.getElementById('flightParticipants');
        if (!select) return;
        select.innerHTML = '';
        if (!state.participants.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Add a participant first';
            select.appendChild(option);
            select.disabled = true;
            return;
        }
        select.disabled = false;
        state.participants.forEach((participant) => {
            const option = document.createElement('option');
            option.value = participant.id;
            option.textContent = participant.displayName;
            select.appendChild(option);
        });
        applyFlightParticipantSearchFilter();
        renderFlightPassengerSeats();
        renderFlightPassengerBaggage();
    };

    const getSelectedFlightParticipantIds = () => {
        const select = document.getElementById('flightParticipants');
        return Array.from(select?.selectedOptions || [])
            .map((option) => Number(option.value))
            .filter((value) => Number.isFinite(value) && value > 0);
    };

    const syncFlightSeatMapWithSelection = () => {
        state.editing.flightSeatMap = state.editing.flightSeatMap || {};
    };

    const syncFlightBaggageMapWithSelection = () => {
        state.editing.flightBaggageMap = state.editing.flightBaggageMap || {};
    };

    const renderFlightPassengerSeats = () => {
        const container = document.getElementById('flightPassengerSeats');
        if (!container) return;
        const selectedIds = getSelectedFlightParticipantIds();
        const nameMap = new Map(state.participants.map((participant) => [participant.id, participant.displayName]));
        if (!selectedIds.length) {
            container.innerHTML = '<div class="text-muted">Select passengers to assign seats.</div>';
            return;
        }
        const seatMap = state.editing.flightSeatMap || {};
        container.innerHTML = '';
        selectedIds.forEach((participantId) => {
            const row = document.createElement('div');
            row.className = 'd-flex align-items-center gap-2 mb-2';
            const label = document.createElement('span');
            label.className = 'flex-grow-1';
            label.textContent = nameMap.get(participantId) || `Participant ${participantId}`;
            const input = document.createElement('input');
            input.className = 'form-control form-control-sm';
            input.placeholder = 'Seat';
            input.value = seatMap[String(participantId)] || '';
            input.dataset.participantId = String(participantId);
            input.addEventListener('input', () => {
                state.editing.flightSeatMap[String(participantId)] = input.value.trim();
            });
            row.appendChild(label);
            row.appendChild(input);
            container.appendChild(row);
        });
    };

    const renderFlightPassengerBaggage = () => {
        const container = document.getElementById('flightPassengerBaggage');
        if (!container) return;
        const selectedIds = getSelectedFlightParticipantIds();
        const nameMap = new Map(state.participants.map((participant) => [participant.id, participant.displayName]));
        if (!selectedIds.length) {
            container.innerHTML = '<div class="text-muted">Select passengers to assign baggage.</div>';
            return;
        }
        const baggageMap = state.editing.flightBaggageMap || {};
        container.innerHTML = '';
        selectedIds.forEach((participantId) => {
            const row = document.createElement('div');
            row.className = 'd-flex align-items-center gap-2 mb-2';
            const label = document.createElement('span');
            label.className = 'flex-grow-1';
            label.textContent = nameMap.get(participantId) || `Participant ${participantId}`;
            const input = document.createElement('input');
            input.className = 'form-control form-control-sm';
            input.placeholder = 'Baggage';
            input.value = baggageMap[String(participantId)] || '';
            input.dataset.participantId = String(participantId);
            input.addEventListener('input', () => {
                state.editing.flightBaggageMap[String(participantId)] = input.value.trim();
            });
            row.appendChild(label);
            row.appendChild(input);
            container.appendChild(row);
        });
    };

    const populateTicketParticipants = () => {
        const select = document.getElementById('ticketParticipants');
        if (!select) return;
        select.innerHTML = '';
        if (!state.participants.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Add a participant first';
            select.appendChild(option);
            select.disabled = true;
            return;
        }
        select.disabled = false;
        state.participants.forEach((participant) => {
            const option = document.createElement('option');
            option.value = participant.id;
            option.textContent = participant.displayName;
            select.appendChild(option);
        });
    };

    const setModuleExpenseVisibility = (prefix, show) => {
        const config = moduleExpenseConfigs.find((item) => item.prefix === prefix);
        if (!config) return;
        const toggle = document.getElementById(config.toggleId);
        const fields = document.getElementById(config.fieldsId);
        if (!toggle || !fields) return;
        toggle.checked = show;
        fields.classList.toggle('d-none', !show);
    };

    const setModuleExpensePayer = (prefix, payerId) => {
        const config = moduleExpenseConfigs.find((item) => item.prefix === prefix);
        if (!config) return;
        const select = document.getElementById(config.payerId);
        if (select) {
            select.value = payerId ? String(payerId) : '';
        }
    };

    const collectLinkedExpenseSplitData = (amountValue) => {
        if (!state.participants.length && !state.families.length) {
            throw new Error('Add participants or families before linking an expense.');
        }
        const payerEl = document.getElementById('expensePayer');
        const payerId = Number(payerEl?.value || 0);
        if (!payerId) {
            throw new Error('Select a payer to link an expense.');
        }
        const splitType = document.querySelector('input[name="splitType"]:checked')?.value || 'participants';
        const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value || 'equal';
        const targetInputs = Array.from(document.querySelectorAll('#splitTargets input[type="checkbox"]:checked'));
        if (!targetInputs.length) {
            throw new Error('Select split targets before linking an expense.');
        }
        const targetIds = targetInputs
            .map((input) => Number(input.value))
            .filter((value) => Number.isFinite(value) && value > 0);
        if (!targetIds.length) {
            throw new Error('Select split targets before linking an expense.');
        }
        const payload = {
            payerParticipantId: payerId,
            splitType,
            splitMode
        };
        if (splitMode === 'manual') {
            const totalAmount = Number(amountValue);
            if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
                throw new Error('Set a valid amount before linking an expense.');
            }
            let sum = 0;
            const splits = [];
            targetInputs.forEach((checkbox) => {
                const label = checkbox.closest('label');
                const amountInput = label?.querySelector('input[type="number"]');
                const value = Number(amountInput?.value || 0);
                if (!Number.isFinite(value) || value <= 0) {
                    throw new Error('Enter manual amounts for each split target.');
                }
                sum += value;
                splits.push({ targetId: Number(checkbox.value), amount: value });
            });
            if (Math.abs(sum - totalAmount) > 0.005) {
                throw new Error('Split totals must match the module amount.');
            }
            payload.splits = splits;
        } else if (splitType === 'participants') {
            payload.participantIds = targetIds;
        } else {
            payload.familyIds = targetIds;
        }
        return payload;
    };

    const buildLinkedExpensePayload = (prefix, defaults) => {
        const config = moduleExpenseConfigs.find((item) => item.prefix === prefix);
        if (!config) return null;
        const toggle = document.getElementById(config.toggleId);
        if (!toggle || !toggle.checked) return null;
        const base = defaults && typeof defaults === 'object' ? defaults : {};
        const amountValue = typeof base.amount === 'number' ? base.amount : Number(base.amount);
        const splitData = collectLinkedExpenseSplitData(amountValue);
        return {
            ...base,
            ...splitData
        };
    };

    const setReadOnlyBanner = (id, show) => {
        const banner = document.getElementById(id);
        if (!banner) return;
        banner.classList.toggle('d-none', !show);
    };

    const updateExpenseAvailability = () => {
        const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
        const hint = document.getElementById('expenseHint');
        if (!submitBtn) return;
        const type = document.querySelector('input[name="splitType"]:checked')?.value || 'participants';
        const mode = document.querySelector('input[name="splitMode"]:checked')?.value || 'equal';
        const targets = type === 'participants' ? state.participants : state.families;
        const hasParticipants = state.participants.length > 0;
        const hasTargets = targets.length > 0;
        const canSubmit = state.canEdit && hasParticipants && hasTargets;
        submitBtn.disabled = !canSubmit;
        if (hint) {
            hint.classList.toggle('d-none', hasParticipants);
        }
    };

    const applyPermissions = () => {
        const forms = [
            'familyForm',
            'participantForm',
            'expenseForm',
            'inviteForm',
            'flightForm',
            'lodgingForm',
            'transportForm',
            'ticketForm'
        ];
        forms.forEach((id) => {
            const form = document.getElementById(id);
            if (!form) return;
            Array.from(form.elements).forEach((el) => {
                el.disabled = !state.canEdit;
            });
        });
        setReadOnlyBanner('familyReadOnly', !state.canEdit);
        setReadOnlyBanner('participantReadOnly', !state.canEdit);
        setReadOnlyBanner('expenseReadOnly', !state.canEdit);
        setReadOnlyBanner('inviteReadOnly', !state.canEdit);
        setReadOnlyBanner('flightReadOnly', !state.canEdit);
        setReadOnlyBanner('lodgingReadOnly', !state.canEdit);
        setReadOnlyBanner('transportReadOnly', !state.canEdit);
        setReadOnlyBanner('ticketReadOnly', !state.canEdit);
        updateExpenseAvailability();
    };

    const setExpenseFormMode = (mode) => {
        const submit = document.getElementById('expenseSubmit');
        const cancel = document.getElementById('expenseCancel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update expense' : 'Add expense';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const resetExpenseForm = () => {
        const form = document.getElementById('expenseForm');
        if (!form) return;
        form.reset();
        form.classList.remove('was-validated');
        state.editing.expenseId = null;
        state.editing.expenseConfig = null;
        const participantsRadio = document.getElementById('splitParticipants');
        const equalRadio = document.getElementById('splitModeEqual');
        if (participantsRadio) participantsRadio.checked = true;
        if (equalRadio) equalRadio.checked = true;
        setExpenseFormMode('create');
        renderSplitTargets();
        updateSplitSummary();
    };

    const populateExpenseForm = (expense) => {
        if (!expense) return;
        const description = document.getElementById('expenseDescription');
        const amount = document.getElementById('expenseAmount');
        const currency = document.getElementById('expenseCurrency');
        const date = document.getElementById('expenseDate');
        const category = document.getElementById('expenseCategory');
        const payer = document.getElementById('expensePayer');

        if (description) description.value = expense.description || '';
        if (amount) amount.value = expense.amount ?? '';
        if (currency) currency.value = expense.currency || state.group?.defaultCurrency || 'USD';
        if (date) date.value = expense.date || '';
        if (category) category.value = expense.category || '';
        if (payer) payer.value = expense.payerParticipantId ? String(expense.payerParticipantId) : '';

        const rawSplitType = expense.splits && expense.splits.length ? expense.splits[0].targetType : 'participant';
        const splitType = rawSplitType === 'family' ? 'families' : 'participants';
        const splitTypeInput = document.getElementById(splitType === 'families' ? 'splitFamilies' : 'splitParticipants');
        if (splitTypeInput) splitTypeInput.checked = true;

        const targetIds = (expense.splits || []).map((split) => split.targetId);
        const total = Number(expense.amount || 0);
        const expected = targetIds.length ? total / targetIds.length : null;
        const amounts = (expense.splits || []).map((split) => Number(split.amount || 0));
        const isEqualSplit = expected != null && amounts.every((value) => Math.abs(value - expected) < 0.01);
        const splitModeInput = document.getElementById(isEqualSplit ? 'splitModeEqual' : 'splitModeManual');
        if (splitModeInput) splitModeInput.checked = true;

        const manualAmounts = {};
        amounts.forEach((value, index) => {
            manualAmounts[targetIds[index]] = value;
        });
        state.editing.expenseConfig = {
            targetIds,
            manualAmounts
        };
        setExpenseFormMode('edit');
        renderSplitTargets();
        updateSplitSummary();
    };

    const ensureLinkedExpense = (response, errorEl) => {
        if (response && response.expenseId) {
            return true;
        }
        if (errorEl) {
            errorEl.textContent = 'Linked expense was not created. Please retry or restart the server.';
            errorEl.classList.remove('d-none');
        }
        return false;
    };

    const setFlightFormMode = (mode) => {
        const submit = document.getElementById('flightSubmit');
        const cancel = document.getElementById('flightCancel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update flight' : 'Add flight';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const resetFlightForm = () => {
        const form = document.getElementById('flightForm');
        if (!form) return;
        form.reset();
        form.classList.remove('was-validated');
        state.editing.flightId = null;
        state.editing.flightSeatMap = {};
        state.editing.flightBaggageMap = {};
        setFlightFormMode('create');
        setModuleExpenseVisibility('flight', false);
        setModuleExpensePayer('flight', null);
        const status = document.getElementById('flightStatus');
        if (status) status.value = 'planned';
        const passengers = document.getElementById('flightParticipants');
        if (passengers) setMultiSelectValues(passengers, []);
        const participantSearch = document.getElementById('flightParticipantSearch');
        if (participantSearch) {
            participantSearch.value = '';
            applyFlightParticipantSearchFilter();
        }
        renderFlightPassengerSeats();
        renderFlightPassengerBaggage();
        const airlineIdInput = document.getElementById('flightAirlineId');
        if (airlineIdInput) airlineIdInput.value = '';
        syncFlightAirlineIdFromInput();
    };

    const populateFlightForm = (flight) => {
        if (!flight) return;
        const airline = document.getElementById('flightAirline');
        const flightNumber = document.getElementById('flightNumber');
        const pnr = document.getElementById('flightPnr');
        const status = document.getElementById('flightStatus');
        const cost = document.getElementById('flightCost');
        const currency = document.getElementById('flightCurrency');
        const cabinClass = document.getElementById('flightClass');
        const from = document.getElementById('flightFrom');
        const to = document.getElementById('flightTo');
        const depart = document.getElementById('flightDepart');
        const arrive = document.getElementById('flightArrive');
        const passengers = document.getElementById('flightParticipants');
        const notes = document.getElementById('flightNotes');
        if (airline) airline.value = flight.airline || '';
        if (flightNumber) flightNumber.value = flight.flightNumber || '';
        if (pnr) pnr.value = flight.pnr || '';
        if (status) status.value = flight.status || 'planned';
        if (cost) cost.value = flight.cost ?? '';
        if (currency) currency.value = flight.currency || state.group?.defaultCurrency || 'USD';
        if (cabinClass) cabinClass.value = flight.cabinClass || '';
        if (from) from.value = flight.from || '';
        if (to) to.value = flight.to || '';
        if (depart) depart.value = formatDateTimeLocal(flight.departAt);
        if (arrive) arrive.value = formatDateTimeLocal(flight.arriveAt);
        if (passengers) setMultiSelectValues(passengers, flight.participantIds || []);
        if (notes) notes.value = flight.notes || '';
        state.editing.flightSeatMap = { ...(flight.participantSeats || {}) };
        renderFlightPassengerSeats();
        state.editing.flightBaggageMap = { ...(flight.participantBaggage || {}) };
        renderFlightPassengerBaggage();
        const airlineIdInput = document.getElementById('flightAirlineId');
        if (airlineIdInput) airlineIdInput.value = flight.airlineId || '';
        syncFlightAirlineIdFromInput();
        const expense = flight.expenseId ? state.expenses.find((item) => item.id === flight.expenseId) : null;
        setModuleExpenseVisibility('flight', !!expense);
        setModuleExpensePayer('flight', expense?.payerParticipantId || null);
    };

    const setLodgingFormMode = (mode) => {
        const submit = document.getElementById('lodgingSubmit');
        const cancel = document.getElementById('lodgingCancel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update lodging' : 'Add lodging';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const resetLodgingForm = () => {
        const form = document.getElementById('lodgingForm');
        if (!form) return;
        form.reset();
        form.classList.remove('was-validated');
        state.editing.lodgingId = null;
        setLodgingFormMode('create');
        setModuleExpenseVisibility('lodging', false);
        setModuleExpensePayer('lodging', null);
        const status = document.getElementById('lodgingStatus');
        if (status) status.value = 'planned';
    };

    const populateLodgingForm = (lodging) => {
        if (!lodging) return;
        const name = document.getElementById('lodgingName');
        const address = document.getElementById('lodgingAddress');
        const addressLine2 = document.getElementById('lodgingAddressLine2');
        const city = document.getElementById('lodgingCity');
        const state = document.getElementById('lodgingState');
        const postalCode = document.getElementById('lodgingPostalCode');
        const country = document.getElementById('lodgingCountry');
        const checkIn = document.getElementById('lodgingCheckIn');
        const checkInTime = document.getElementById('lodgingCheckInTime');
        const checkOut = document.getElementById('lodgingCheckOut');
        const checkOutTime = document.getElementById('lodgingCheckOutTime');
        const status = document.getElementById('lodgingStatus');
        const cost = document.getElementById('lodgingCost');
        const currency = document.getElementById('lodgingCurrency');
        const roomType = document.getElementById('lodgingRoomType');
        const roomQuantity = document.getElementById('lodgingRoomQuantity');
        const roomOccupancy = document.getElementById('lodgingRoomOccupancy');
        const host = document.getElementById('lodgingHost');
        const contact = document.getElementById('lodgingContact');
        const contactPhone = document.getElementById('lodgingContactPhone');
        const contactEmail = document.getElementById('lodgingContactEmail');
        const notes = document.getElementById('lodgingNotes');
        if (name) name.value = lodging.name || '';
        if (address) address.value = lodging.address || '';
        if (addressLine2) addressLine2.value = lodging.addressLine2 || '';
        if (city) city.value = lodging.city || '';
        if (state) state.value = lodging.state || '';
        if (postalCode) postalCode.value = lodging.postalCode || '';
        if (country) country.value = lodging.country || '';
        if (checkIn) checkIn.value = lodging.checkIn || '';
        if (checkInTime) checkInTime.value = lodging.checkInTime || '';
        if (checkOut) checkOut.value = lodging.checkOut || '';
        if (checkOutTime) checkOutTime.value = lodging.checkOutTime || '';
        if (status) status.value = lodging.status || 'planned';
        if (cost) cost.value = lodging.cost ?? '';
        if (currency) currency.value = lodging.currency || state.group?.defaultCurrency || 'USD';
        if (roomType) roomType.value = lodging.roomType || '';
        if (roomQuantity) roomQuantity.value = lodging.roomQuantity ?? '';
        if (roomOccupancy) roomOccupancy.value = lodging.roomOccupancy ?? '';
        if (host) host.value = lodging.host || '';
        if (contact) contact.value = lodging.contact || '';
        if (contactPhone) contactPhone.value = lodging.contactPhone || '';
        if (contactEmail) contactEmail.value = lodging.contactEmail || '';
        if (notes) notes.value = lodging.notes || '';
        const expense = lodging.expenseId ? state.expenses.find((item) => item.id === lodging.expenseId) : null;
        setModuleExpenseVisibility('lodging', !!expense);
        setModuleExpensePayer('lodging', expense?.payerParticipantId || null);
    };

    const setTransportFormMode = (mode) => {
        const submit = document.getElementById('transportSubmit');
        const cancel = document.getElementById('transportCancel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update transport' : 'Add transport';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const resetTransportForm = () => {
        const form = document.getElementById('transportForm');
        if (!form) return;
        form.reset();
        form.classList.remove('was-validated');
        state.editing.transportId = null;
        setTransportFormMode('create');
        setModuleExpenseVisibility('transport', false);
        setModuleExpensePayer('transport', null);
        const status = document.getElementById('transportStatus');
        if (status) status.value = 'planned';
    };

    const populateTransportForm = (transport) => {
        if (!transport) return;
        const type = document.getElementById('transportType');
        const origin = document.getElementById('transportOrigin');
        const destination = document.getElementById('transportDestination');
        const depart = document.getElementById('transportDepart');
        const arrive = document.getElementById('transportArrive');
        const provider = document.getElementById('transportProvider');
        const locator = document.getElementById('transportLocator');
        const status = document.getElementById('transportStatus');
        const amount = document.getElementById('transportAmount');
        const currency = document.getElementById('transportCurrency');
        const notes = document.getElementById('transportNotes');
        if (type) type.value = transport.type || '';
        if (origin) origin.value = transport.origin || '';
        if (destination) destination.value = transport.destination || '';
        if (depart) depart.value = formatDateTimeLocal(transport.departAt);
        if (arrive) arrive.value = formatDateTimeLocal(transport.arriveAt);
        if (provider) provider.value = transport.provider || '';
        if (locator) locator.value = transport.locator || '';
        if (status) status.value = transport.status || 'planned';
        if (amount) amount.value = transport.amount ?? '';
        if (currency) currency.value = transport.currency || state.group?.defaultCurrency || 'USD';
        if (notes) notes.value = transport.notes || '';
        const expense = transport.expenseId ? state.expenses.find((item) => item.id === transport.expenseId) : null;
        setModuleExpenseVisibility('transport', !!expense);
        setModuleExpensePayer('transport', expense?.payerParticipantId || null);
    };

    const setTicketFormMode = (mode) => {
        const submit = document.getElementById('ticketSubmit');
        const cancel = document.getElementById('ticketCancel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update ticket' : 'Add ticket';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const resetTicketForm = () => {
        const form = document.getElementById('ticketForm');
        if (!form) return;
        form.reset();
        form.classList.remove('was-validated');
        state.editing.ticketId = null;
        setTicketFormMode('create');
        setModuleExpenseVisibility('ticket', false);
        setModuleExpensePayer('ticket', null);
        const status = document.getElementById('ticketStatus');
        if (status) status.value = 'planned';
        const participants = document.getElementById('ticketParticipants');
        if (participants) setMultiSelectValues(participants, []);
    };

    const populateTicketForm = (ticket) => {
        if (!ticket) return;
        const type = document.getElementById('ticketType');
        const eventAt = document.getElementById('ticketEventAt');
        const location = document.getElementById('ticketLocation');
        const status = document.getElementById('ticketStatus');
        const amount = document.getElementById('ticketAmount');
        const currency = document.getElementById('ticketCurrency');
        const participants = document.getElementById('ticketParticipants');
        const notes = document.getElementById('ticketNotes');
        if (type) type.value = ticket.type || '';
        if (eventAt) eventAt.value = formatDateTimeLocal(ticket.eventAt);
        if (location) location.value = ticket.location || '';
        if (status) status.value = ticket.status || 'planned';
        if (amount) amount.value = ticket.amount ?? '';
        if (currency) currency.value = ticket.currency || state.group?.defaultCurrency || 'USD';
        if (participants) setMultiSelectValues(participants, ticket.participantIds || []);
        if (notes) notes.value = ticket.notes || '';
        const expense = ticket.expenseId ? state.expenses.find((item) => item.id === ticket.expenseId) : null;
        setModuleExpenseVisibility('ticket', !!expense);
        setModuleExpensePayer('ticket', expense?.payerParticipantId || null);
    };

    const bindGroupSelector = () => {
        const selector = document.getElementById('groupSelector');
        if (!selector) return;
        selector.addEventListener('change', () => {
            const nextId = selector.value;
            window.location.href = `/dashboard?groupId=${nextId}`;
        });
    };

    const bindForms = () => {
        const familyForm = document.getElementById('familyForm');
        const familyError = document.getElementById('familyError');
        if (familyForm) {
            familyForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (familyError) familyError.classList.add('d-none');
                if (!validateForm(familyForm)) return;
                const name = document.getElementById('familyName')?.value || '';
                try {
                    await apiRequest(`/api/groups/${state.groupId}/families`, {
                        method: 'POST',
                        body: JSON.stringify({ name })
                    });
                    familyForm.reset();
                    familyForm.classList.remove('was-validated');
                    await refreshData();
                } catch (err) {
                    if (familyError) {
                        familyError.textContent = err.message;
                        familyError.classList.remove('d-none');
                    }
                }
            });
        }

        const flightForm = document.getElementById('flightForm');
        const flightError = document.getElementById('flightError');
        if (flightForm) {
            flightForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (flightError) flightError.classList.add('d-none');
                if (!validateForm(flightForm)) return;
                const passengerValues = Array.from(
                    document.getElementById('flightParticipants')?.selectedOptions || []
                )
                    .map((option) => Number(option.value))
                    .filter((value) => Number.isFinite(value) && value > 0);
                const seatMap = {};
                passengerValues.forEach((participantId) => {
                    const input = document.querySelector(
                        `#flightPassengerSeats [data-participant-id="${participantId}"]`
                    );
                    seatMap[participantId] = input ? input.value.trim() : '';
                });
                const baggageMap = {};
                passengerValues.forEach((participantId) => {
                    const input = document.querySelector(
                        `#flightPassengerBaggage [data-participant-id="${participantId}"]`
                    );
                    baggageMap[participantId] = input ? input.value.trim() : '';
                });
                const payload = {
                    airline: document.getElementById('flightAirline')?.value || '',
                    airlineId: document.getElementById('flightAirlineId')?.value || '',
                    flightNumber: document.getElementById('flightNumber')?.value || '',
                    pnr: document.getElementById('flightPnr')?.value || '',
                    status: document.getElementById('flightStatus')?.value || 'planned',
                    cost: document.getElementById('flightCost')?.value || '',
                    currency: document.getElementById('flightCurrency')?.value || '',
                    cabinClass: document.getElementById('flightClass')?.value || '',
                    from: document.getElementById('flightFrom')?.value || '',
                    to: document.getElementById('flightTo')?.value || '',
                    departAt: document.getElementById('flightDepart')?.value || '',
                    arriveAt: document.getElementById('flightArrive')?.value || '',
                    notes: document.getElementById('flightNotes')?.value || '',
                    participantIds: passengerValues,
                    participantSeats: seatMap,
                    participantBaggage: baggageMap
                };
                const expenseDefaults = {
                    description: `Flight: ${payload.from || '-'} -> ${payload.to || '-'}`,
                    amount: payload.cost,
                    currency: payload.currency,
                    date: payload.departAt,
                    category: 'Flight'
                };
                let expensePayload = null;
                try {
                    expensePayload = buildLinkedExpensePayload('flight', expenseDefaults);
                } catch (err) {
                    if (flightError) {
                        flightError.textContent = err.message;
                        flightError.classList.remove('d-none');
                    }
                    return;
                }
                if (expensePayload) {
                    payload.expense = expensePayload;
                }
                try {
                    const flightId = state.editing.flightId;
                    const endpoint = flightId
                        ? `/api/groups/${state.groupId}/flights/${flightId}`
                        : `/api/groups/${state.groupId}/flights`;
                    const method = flightId ? 'PUT' : 'POST';
                    const response = await apiRequest(endpoint, {
                        method,
                        body: JSON.stringify(payload)
                    });
                    if (expensePayload && !ensureLinkedExpense(response, flightError)) {
                        return;
                    }
                    resetFlightForm();
                    await refreshData();
                } catch (err) {
                    if (flightError) {
                        flightError.textContent = err.message;
                        flightError.classList.remove('d-none');
                    }
                }
            });
        }
        const flightCancel = document.getElementById('flightCancel');
        if (flightCancel) {
            flightCancel.addEventListener('click', () => {
                resetFlightForm();
            });
        }

        const lodgingForm = document.getElementById('lodgingForm');
        const lodgingError = document.getElementById('lodgingError');
        if (lodgingForm) {
            lodgingForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (lodgingError) lodgingError.classList.add('d-none');
                if (!validateForm(lodgingForm)) return;
                const payload = {
                    name: document.getElementById('lodgingName')?.value || '',
                    address: document.getElementById('lodgingAddress')?.value || '',
                    addressLine2: document.getElementById('lodgingAddressLine2')?.value || '',
                    city: document.getElementById('lodgingCity')?.value || '',
                    state: document.getElementById('lodgingState')?.value || '',
                    postalCode: document.getElementById('lodgingPostalCode')?.value || '',
                    country: document.getElementById('lodgingCountry')?.value || '',
                    checkIn: document.getElementById('lodgingCheckIn')?.value || '',
                    checkInTime: document.getElementById('lodgingCheckInTime')?.value || '',
                    checkOut: document.getElementById('lodgingCheckOut')?.value || '',
                    checkOutTime: document.getElementById('lodgingCheckOutTime')?.value || '',
                    status: document.getElementById('lodgingStatus')?.value || 'planned',
                    cost: document.getElementById('lodgingCost')?.value || '',
                    currency: document.getElementById('lodgingCurrency')?.value || '',
                    roomType: document.getElementById('lodgingRoomType')?.value || '',
                    roomQuantity: document.getElementById('lodgingRoomQuantity')?.value || '',
                    roomOccupancy: document.getElementById('lodgingRoomOccupancy')?.value || '',
                    host: document.getElementById('lodgingHost')?.value || '',
                    contact: document.getElementById('lodgingContact')?.value || '',
                    contactPhone: document.getElementById('lodgingContactPhone')?.value || '',
                    contactEmail: document.getElementById('lodgingContactEmail')?.value || '',
                    notes: document.getElementById('lodgingNotes')?.value || ''
                };
                const expenseDefaults = {
                    description: `Lodging: ${payload.name || '-'}`,
                    amount: payload.cost,
                    currency: payload.currency,
                    date: payload.checkIn,
                    category: 'Lodging'
                };
                let expensePayload = null;
                try {
                    expensePayload = buildLinkedExpensePayload('lodging', expenseDefaults);
                } catch (err) {
                    if (lodgingError) {
                        lodgingError.textContent = err.message;
                        lodgingError.classList.remove('d-none');
                    }
                    return;
                }
                if (expensePayload) {
                    payload.expense = expensePayload;
                }
                try {
                    const lodgingId = state.editing.lodgingId;
                    const endpoint = lodgingId
                        ? `/api/groups/${state.groupId}/lodgings/${lodgingId}`
                        : `/api/groups/${state.groupId}/lodgings`;
                    const method = lodgingId ? 'PUT' : 'POST';
                    const response = await apiRequest(endpoint, {
                        method,
                        body: JSON.stringify(payload)
                    });
                    if (expensePayload && !ensureLinkedExpense(response, lodgingError)) {
                        return;
                    }
                    resetLodgingForm();
                    await refreshData();
                } catch (err) {
                    if (lodgingError) {
                        lodgingError.textContent = err.message;
                        lodgingError.classList.remove('d-none');
                    }
                }
            });
        }
        const lodgingCancel = document.getElementById('lodgingCancel');
        if (lodgingCancel) {
            lodgingCancel.addEventListener('click', () => {
                resetLodgingForm();
            });
        }

        const transportForm = document.getElementById('transportForm');
        const transportError = document.getElementById('transportError');
        if (transportForm) {
            transportForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (transportError) transportError.classList.add('d-none');
                if (!validateForm(transportForm)) return;
                const payload = {
                    type: document.getElementById('transportType')?.value || '',
                    origin: document.getElementById('transportOrigin')?.value || '',
                    destination: document.getElementById('transportDestination')?.value || '',
                    departAt: document.getElementById('transportDepart')?.value || '',
                    arriveAt: document.getElementById('transportArrive')?.value || '',
                    provider: document.getElementById('transportProvider')?.value || '',
                    locator: document.getElementById('transportLocator')?.value || '',
                    status: document.getElementById('transportStatus')?.value || 'planned',
                    amount: document.getElementById('transportAmount')?.value || '',
                    currency: document.getElementById('transportCurrency')?.value || '',
                    notes: document.getElementById('transportNotes')?.value || ''
                };
                const expenseDefaults = {
                    description: `Transport: ${payload.type || '-'}`,
                    amount: payload.amount,
                    currency: payload.currency,
                    date: payload.departAt,
                    category: 'Transport'
                };
                let expensePayload = null;
                try {
                    expensePayload = buildLinkedExpensePayload('transport', expenseDefaults);
                } catch (err) {
                    if (transportError) {
                        transportError.textContent = err.message;
                        transportError.classList.remove('d-none');
                    }
                    return;
                }
                if (expensePayload) {
                    payload.expense = expensePayload;
                }
                try {
                    const transportId = state.editing.transportId;
                    const endpoint = transportId
                        ? `/api/groups/${state.groupId}/transports/${transportId}`
                        : `/api/groups/${state.groupId}/transports`;
                    const method = transportId ? 'PUT' : 'POST';
                    const response = await apiRequest(endpoint, {
                        method,
                        body: JSON.stringify(payload)
                    });
                    if (expensePayload && !ensureLinkedExpense(response, transportError)) {
                        return;
                    }
                    resetTransportForm();
                    await refreshData();
                } catch (err) {
                    if (transportError) {
                        transportError.textContent = err.message;
                        transportError.classList.remove('d-none');
                    }
                }
            });
        }
        const transportCancel = document.getElementById('transportCancel');
        if (transportCancel) {
            transportCancel.addEventListener('click', () => {
                resetTransportForm();
            });
        }

        const ticketForm = document.getElementById('ticketForm');
        const ticketError = document.getElementById('ticketError');
        if (ticketForm) {
            ticketForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (ticketError) ticketError.classList.add('d-none');
                if (!validateForm(ticketForm)) return;
                const ticketParticipantValues = Array.from(
                    document.getElementById('ticketParticipants')?.selectedOptions || []
                )
                    .map((option) => Number(option.value))
                    .filter((value) => Number.isFinite(value) && value > 0);
                const payload = {
                    type: document.getElementById('ticketType')?.value || '',
                    eventAt: document.getElementById('ticketEventAt')?.value || '',
                    location: document.getElementById('ticketLocation')?.value || '',
                    status: document.getElementById('ticketStatus')?.value || 'planned',
                    amount: document.getElementById('ticketAmount')?.value || '',
                    currency: document.getElementById('ticketCurrency')?.value || '',
                    notes: document.getElementById('ticketNotes')?.value || '',
                    participantIds: ticketParticipantValues
                };
                const expenseDefaults = {
                    description: `Ticket: ${payload.type || '-'}`,
                    amount: payload.amount,
                    currency: payload.currency,
                    date: payload.eventAt,
                    category: 'Ticket'
                };
                let expensePayload = null;
                try {
                    expensePayload = buildLinkedExpensePayload('ticket', expenseDefaults);
                } catch (err) {
                    if (ticketError) {
                        ticketError.textContent = err.message;
                        ticketError.classList.remove('d-none');
                    }
                    return;
                }
                if (expensePayload) {
                    payload.expense = expensePayload;
                }
                try {
                    const ticketId = state.editing.ticketId;
                    const endpoint = ticketId
                        ? `/api/groups/${state.groupId}/tickets/${ticketId}`
                        : `/api/groups/${state.groupId}/tickets`;
                    const method = ticketId ? 'PUT' : 'POST';
                    const response = await apiRequest(endpoint, {
                        method,
                        body: JSON.stringify(payload)
                    });
                    if (expensePayload && !ensureLinkedExpense(response, ticketError)) {
                        return;
                    }
                    resetTicketForm();
                    await refreshData();
                } catch (err) {
                    if (ticketError) {
                        ticketError.textContent = err.message;
                        ticketError.classList.remove('d-none');
                    }
                }
            });
        }
        const ticketCancel = document.getElementById('ticketCancel');
        if (ticketCancel) {
            ticketCancel.addEventListener('click', () => {
                resetTicketForm();
            });
        }

        const participantForm = document.getElementById('participantForm');
        const participantError = document.getElementById('participantError');
        if (participantForm) {
            participantForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (participantError) participantError.classList.add('d-none');
                if (!validateForm(participantForm)) return;
                const displayName = document.getElementById('participantName')?.value || '';
                const type = document.getElementById('participantType')?.value || '';
                const familyIdValue = document.getElementById('participantFamily')?.value || '';
                const familyId = familyIdValue ? Number(familyIdValue) : null;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/participants`, {
                        method: 'POST',
                        body: JSON.stringify({ displayName, type, familyId })
                    });
                    participantForm.reset();
                    participantForm.classList.remove('was-validated');
                    await refreshData();
                } catch (err) {
                    if (participantError) {
                        participantError.textContent = err.message;
                        participantError.classList.remove('d-none');
                    }
                }
            });
        }

        const expenseForm = document.getElementById('expenseForm');
        const expenseError = document.getElementById('expenseError');
        const splitTargetsError = document.getElementById('splitTargetsError');
        if (expenseForm) {
            expenseForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (expenseError) expenseError.classList.add('d-none');
                if (splitTargetsError) splitTargetsError.classList.add('d-none');
                if (!validateForm(expenseForm)) return;
                const description = document.getElementById('expenseDescription')?.value || '';
                const amount = document.getElementById('expenseAmount')?.value || '';
                const currency = document.getElementById('expenseCurrency')?.value || '';
                const date = document.getElementById('expenseDate')?.value || '';
                const category = document.getElementById('expenseCategory')?.value || '';
                const payerParticipantId = Number(document.getElementById('expensePayer')?.value || 0);
                const splitType = document.querySelector('input[name="splitType"]:checked')?.value || 'participants';
                const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value || 'equal';
                const selectedTargets = Array.from(document.querySelectorAll('#splitTargets input[type="checkbox"]:checked'));
                const targetIds = selectedTargets
                    .map((input) => Number(input.value))
                    .filter((value) => value);
                if (!targetIds.length) {
                    if (splitTargetsError) splitTargetsError.classList.remove('d-none');
                    return;
                }

                const payload = {
                    description,
                    amount,
                    currency,
                    date,
                    category,
                    payerParticipantId,
                    splitType,
                    splitMode
                };
                if (splitMode === 'manual') {
                    let total = 0;
                    const splits = [];
                    let hasInvalidAmount = false;
                    selectedTargets.forEach((checkbox) => {
                        const amountInput = checkbox.closest('label')?.querySelector('input[type="number"]');
                        const value = Number(amountInput?.value);
                        if (!Number.isFinite(value) || value <= 0) {
                            hasInvalidAmount = true;
                            return;
                        }
                        total += value;
                        splits.push({ targetId: Number(checkbox.value), amount: value });
                    });
                    if (hasInvalidAmount || !splits.length) {
                        if (splitTargetsError) {
                            splitTargetsError.textContent = 'Enter amounts for the selected targets.';
                            splitTargetsError.classList.remove('d-none');
                        }
                        return;
                    }
                    if (Number(amount) !== Number(total.toFixed(2))) {
                        if (splitTargetsError) {
                            splitTargetsError.textContent = 'Split totals must match the expense amount.';
                            splitTargetsError.classList.remove('d-none');
                        }
                        return;
                    }
                    payload.splits = splits;
                } else if (splitType === 'participants') {
                    payload.participantIds = targetIds;
                } else {
                    payload.familyIds = targetIds;
                }

                try {
                    const expenseId = state.editing.expenseId;
                    const endpoint = expenseId
                        ? `/api/groups/${state.groupId}/expenses/${expenseId}`
                        : `/api/groups/${state.groupId}/expenses`;
                    const method = expenseId ? 'PUT' : 'POST';
                    await apiRequest(endpoint, {
                        method,
                        body: JSON.stringify(payload)
                    });
                    resetExpenseForm();
                    await refreshData();
                } catch (err) {
                    if (expenseError) {
                        expenseError.textContent = err.message;
                        expenseError.classList.remove('d-none');
                    }
                }
            });

            const amountInput = document.getElementById('expenseAmount');
            const currencyInput = document.getElementById('expenseCurrency');
            if (amountInput) {
                amountInput.addEventListener('input', () => {
                    updateSplitSummary();
                });
            }
            if (currencyInput) {
                currencyInput.addEventListener('change', () => {
                    updateSplitSummary();
                });
            }

            const expenseCancel = document.getElementById('expenseCancel');
            if (expenseCancel) {
                expenseCancel.addEventListener('click', () => {
                    resetExpenseForm();
                });
            }
        }
    };

    const bindInviteForm = () => {
        const form = document.getElementById('inviteForm');
        const errorEl = document.getElementById('inviteError');
        const successEl = document.getElementById('inviteSuccess');
        const linkEl = document.getElementById('inviteLink');
        const tokenEl = document.getElementById('inviteToken');
        const expiresEl = document.getElementById('inviteExpires');
        if (!form) return;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (errorEl) errorEl.classList.add('d-none');
            if (successEl) successEl.classList.add('d-none');
            if (!validateForm(form)) return;
            const email = document.getElementById('inviteEmail')?.value || '';
            const role = document.getElementById('inviteRole')?.value || 'member';
            try {
                const res = await apiRequest(`/api/groups/${state.groupId}/invitations`, {
                    method: 'POST',
                    body: JSON.stringify({ email, role })
                });
                if (linkEl) {
                    linkEl.href = res.inviteUrl || '#';
                    linkEl.textContent = res.inviteUrl || 'Invite link';
                }
                if (tokenEl) tokenEl.textContent = res.token || '';
                if (expiresEl && res.expiresAt) {
                    expiresEl.textContent = `Expires on ${new Date(res.expiresAt).toLocaleDateString('en-US')}`;
                }
                if (successEl) successEl.classList.remove('d-none');
                form.reset();
                form.classList.remove('was-validated');
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message;
                    errorEl.classList.remove('d-none');
                }
            }
        });
    };

    const bindDeleteActions = () => {
        const familyList = document.getElementById('familyList');
        const participantList = document.getElementById('participantList');
        const expenseList = document.getElementById('expenseList');
        const flightList = document.getElementById('flightList');
        const flightForm = document.getElementById('flightForm');
        const lodgingList = document.getElementById('lodgingList');
        const lodgingForm = document.getElementById('lodgingForm');
        const transportList = document.getElementById('transportList');
        const ticketList = document.getElementById('ticketList');

        if (familyList) {
            familyList.addEventListener('click', async (event) => {
                const target = event.target;
                if (!(target instanceof HTMLButtonElement)) return;
                if (target.dataset.action !== 'delete-family') return;
                const id = target.dataset.id;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/families/${id}`, { method: 'DELETE' });
                    await refreshData();
                } catch (err) {
                    const familyError = document.getElementById('familyError');
                    if (familyError) {
                        familyError.textContent = err.message;
                        familyError.classList.remove('d-none');
                    }
                }
            });
        }

        if (participantList) {
            participantList.addEventListener('click', async (event) => {
                const target = event.target;
                if (!(target instanceof HTMLButtonElement)) return;
                if (target.dataset.action !== 'delete-participant') return;
                const id = target.dataset.id;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/participants/${id}`, { method: 'DELETE' });
                    await refreshData();
                } catch (err) {
                    const participantError = document.getElementById('participantError');
                    if (participantError) {
                        participantError.textContent = err.message;
                        participantError.classList.remove('d-none');
                    }
                }
            });
        }

        if (expenseList) {
            expenseList.addEventListener('click', async (event) => {
                const button = event.target.closest('button');
                if (!(button instanceof HTMLButtonElement)) return;
                const action = button.dataset.action;
                const id = Number(button.dataset.id);
                if (!id) return;
                if (action === 'edit-expense') {
                    if (!state.canEdit) return;
                    const expense = state.expenses.find((item) => item.id === id);
                    if (!expense) return;
                    state.editing.expenseId = id;
                    populateExpenseForm(expense);
                    document.getElementById('expenseForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                if (action !== 'delete-expense') return;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/expenses/${id}`, { method: 'DELETE' });
                    if (state.editing.expenseId === id) {
                        resetExpenseForm();
                    }
                    await refreshData();
                } catch (err) {
                    const expenseError = document.getElementById('expenseError');
                    if (expenseError) {
                        expenseError.textContent = err.message;
                        expenseError.classList.remove('d-none');
                    }
                }
            });
        }

        if (flightList) {
            flightList.addEventListener('click', async (event) => {
                const button = event.target.closest('button');
                if (!(button instanceof HTMLButtonElement)) return;
                const action = button.dataset.action;
                const id = button.dataset.id;
                if (!id) return;
                if (action === 'edit-flight') {
                    if (!state.canEdit) return;
                    const flight = state.flights.find((item) => item.id === id);
                    if (!flight) return;
                    state.editing.flightId = id;
                    populateFlightForm(flight);
                    setFlightFormMode('edit');
                    flightForm?.classList.remove('was-validated');
                    return;
                }
                if (action !== 'delete-flight') return;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/flights/${id}`, { method: 'DELETE' });
                    resetFlightForm();
                    await refreshData();
                } catch (err) {
                    const flightError = document.getElementById('flightError');
                    if (flightError) {
                        flightError.textContent = err.message;
                        flightError.classList.remove('d-none');
                    }
                }
            });
        }

        if (lodgingList) {
            lodgingList.addEventListener('click', async (event) => {
                const button = event.target.closest('button');
                if (!(button instanceof HTMLButtonElement)) return;
                const action = button.dataset.action;
                const id = button.dataset.id;
                if (!id) return;
                if (action === 'edit-lodging') {
                    if (!state.canEdit) return;
                    const lodging = state.lodgings.find((item) => item.id === id);
                    if (!lodging) return;
                    state.editing.lodgingId = id;
                    populateLodgingForm(lodging);
                    setLodgingFormMode('edit');
                    lodgingForm?.classList.remove('was-validated');
                    lodgingForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                if (action !== 'delete-lodging') return;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/lodgings/${id}`, { method: 'DELETE' });
                    if (state.editing.lodgingId === id) {
                        resetLodgingForm();
                    }
                    await refreshData();
                } catch (err) {
                    const lodgingError = document.getElementById('lodgingError');
                    if (lodgingError) {
                        lodgingError.textContent = err.message;
                        lodgingError.classList.remove('d-none');
                    }
                }
            });
        }

        if (transportList) {
            transportList.addEventListener('click', async (event) => {
                const button = event.target.closest('button');
                if (!(button instanceof HTMLButtonElement)) return;
                const action = button.dataset.action;
                const id = button.dataset.id;
                if (!id) return;
                if (action === 'edit-transport') {
                    if (!state.canEdit) return;
                    const transport = state.transports.find((item) => item.id === id);
                    if (!transport) return;
                    state.editing.transportId = id;
                    populateTransportForm(transport);
                    setTransportFormMode('edit');
                    const transportForm = document.getElementById('transportForm');
                    transportForm?.classList.remove('was-validated');
                    transportForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                if (action !== 'delete-transport') return;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/transports/${id}`, { method: 'DELETE' });
                    if (state.editing.transportId === id) {
                        resetTransportForm();
                    }
                    await refreshData();
                } catch (err) {
                    const transportError = document.getElementById('transportError');
                    if (transportError) {
                        transportError.textContent = err.message;
                        transportError.classList.remove('d-none');
                    }
                }
            });
        }

        if (ticketList) {
            ticketList.addEventListener('click', async (event) => {
                const button = event.target.closest('button');
                if (!(button instanceof HTMLButtonElement)) return;
                const action = button.dataset.action;
                const id = button.dataset.id;
                if (!id) return;
                if (action === 'edit-ticket') {
                    if (!state.canEdit) return;
                    const ticket = state.tickets.find((item) => item.id === id);
                    if (!ticket) return;
                    state.editing.ticketId = id;
                    populateTicketForm(ticket);
                    setTicketFormMode('edit');
                    const ticketForm = document.getElementById('ticketForm');
                    ticketForm?.classList.remove('was-validated');
                    ticketForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                if (action !== 'delete-ticket') return;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/tickets/${id}`, { method: 'DELETE' });
                    if (state.editing.ticketId === id) {
                        resetTicketForm();
                    }
                    await refreshData();
                } catch (err) {
                    const ticketError = document.getElementById('ticketError');
                    if (ticketError) {
                        ticketError.textContent = err.message;
                        ticketError.classList.remove('d-none');
                    }
                }
            });
        }
    };

    const bindSplitTypeToggle = () => {
        const inputs = document.querySelectorAll('input[name="splitType"]');
        inputs.forEach((input) => {
            input.addEventListener('change', () => {
                state.editing.expenseConfig = null;
                renderSplitTargets();
            });
        });
    };

    const bindSplitModeToggle = () => {
        const inputs = document.querySelectorAll('input[name="splitMode"]');
        inputs.forEach((input) => {
            input.addEventListener('change', () => {
                state.editing.expenseConfig = null;
                renderSplitTargets();
            });
        });
    };

    const bindModuleExpenseToggles = () => {
        moduleExpenseConfigs.forEach((config) => {
            const toggle = document.getElementById(config.toggleId);
            const fields = document.getElementById(config.fieldsId);
            if (!toggle || !fields) return;
            toggle.addEventListener('change', () => {
                fields.classList.toggle('d-none', !toggle.checked);
            });
        });
    };

    const bindLogout = () => {
        const link = document.getElementById('logoutLink');
        if (!link) return;
        link.addEventListener('click', async () => {
            try {
                await apiRequest('/api/logout', { method: 'POST' });
            } finally {
                window.location.href = '/login';
            }
        });
    };

    const refreshData = async () => {
        await loadAirlines();
        await loadGroupData();
        renderGroupHeader();
        renderSummary();
        renderBalances();
        renderDebts();
        renderFamilies();
        renderParticipants();
        renderExpenses();
        renderFlights();
        renderLodgings();
        renderTransports();
        renderTickets();
        populateExpenseSelectors();
        populateFlightParticipants();
        populateTicketParticipants();
        renderSplitTargets();
        applyPermissions();
    };

    const init = async () => {
        await setUserProfile();
        const ok = await loadGroups();
        if (!ok) return;
        bindGroupSelector();
        bindForms();
        setupFlightAirlineAutocomplete();
        setupFlightParticipantSearch();
        bindInviteForm();
        bindDeleteActions();
        bindSplitTypeToggle();
        bindSplitModeToggle();
        bindModuleExpenseToggles();
        bindLogout();
        await refreshData();
    };

    init();
})();
