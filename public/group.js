(() => {
    const state = {
        groups: [],
        group: null,
        groupId: null,
        families: [],
        participants: [],
        expenses: [],
        summary: null,
        canEdit: false
    };

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

    const loadGroupData = async () => {
        const [families, participants, expenses, summary] = await Promise.all([
            apiRequest(`/api/groups/${state.groupId}/families`),
            apiRequest(`/api/groups/${state.groupId}/participants`),
            apiRequest(`/api/groups/${state.groupId}/expenses`),
            apiRequest(`/api/groups/${state.groupId}/summary`)
        ]);
        state.families = families.data || [];
        state.participants = participants.data || [];
        state.expenses = expenses.data || [];
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
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-expense" data-id="${expense.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelector('button').disabled = true;
            }
            list.appendChild(tr);
        });
    };

    const renderSplitTargets = () => {
        const wrapper = document.getElementById('splitTargets');
        if (!wrapper) return;
        const type = document.querySelector('input[name="splitType"]:checked')?.value || 'participants';
        const targets = type === 'participants' ? state.participants : state.families;

        if (!targets.length) {
            wrapper.innerHTML = '<div class="text-muted">No targets available.</div>';
            return;
        }
        wrapper.innerHTML = '';
        targets.forEach((target) => {
            const label = document.createElement('label');
            label.className = 'form-check d-flex align-items-center gap-2';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-check-input';
            input.value = target.id;
            label.appendChild(input);
            const span = document.createElement('span');
            span.textContent = target.displayName || target.name;
            label.appendChild(span);
            wrapper.appendChild(label);
        });
    };

    const populateExpenseSelectors = () => {
        const payerSelect = document.getElementById('expensePayer');
        const currencySelect = document.getElementById('expenseCurrency');
        if (!payerSelect) return;
        payerSelect.innerHTML = '';
        state.participants.forEach((participant) => {
            const option = document.createElement('option');
            option.value = participant.id;
            option.textContent = participant.displayName;
            payerSelect.appendChild(option);
        });
        if (currencySelect && state.group) {
            currencySelect.value = state.group.defaultCurrency;
        }
    };

    const applyPermissions = () => {
        const forms = ['familyForm', 'participantForm', 'expenseForm'];
        forms.forEach((id) => {
            const form = document.getElementById(id);
            if (!form) return;
            Array.from(form.elements).forEach((el) => {
                el.disabled = !state.canEdit;
            });
        });
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
                const name = document.getElementById('familyName')?.value || '';
                try {
                    await apiRequest(`/api/groups/${state.groupId}/families`, {
                        method: 'POST',
                        body: JSON.stringify({ name })
                    });
                    familyForm.reset();
                    await refreshData();
                } catch (err) {
                    if (familyError) {
                        familyError.textContent = err.message;
                        familyError.classList.remove('d-none');
                    }
                }
            });
        }

        const participantForm = document.getElementById('participantForm');
        const participantError = document.getElementById('participantError');
        if (participantForm) {
            participantForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (participantError) participantError.classList.add('d-none');
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
        if (expenseForm) {
            expenseForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (expenseError) expenseError.classList.add('d-none');
                const description = document.getElementById('expenseDescription')?.value || '';
                const amount = document.getElementById('expenseAmount')?.value || '';
                const currency = document.getElementById('expenseCurrency')?.value || '';
                const date = document.getElementById('expenseDate')?.value || '';
                const category = document.getElementById('expenseCategory')?.value || '';
                const payerParticipantId = Number(document.getElementById('expensePayer')?.value || 0);
                const splitType = document.querySelector('input[name="splitType"]:checked')?.value || 'participants';
                const targetIds = Array.from(document.querySelectorAll('#splitTargets input:checked'))
                    .map((input) => Number(input.value))
                    .filter((value) => value);

                const payload = {
                    description,
                    amount,
                    currency,
                    date,
                    category,
                    payerParticipantId,
                    splitType
                };
                if (splitType === 'participants') {
                    payload.participantIds = targetIds;
                } else {
                    payload.familyIds = targetIds;
                }

                try {
                    await apiRequest(`/api/groups/${state.groupId}/expenses`, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    expenseForm.reset();
                    await refreshData();
                } catch (err) {
                    if (expenseError) {
                        expenseError.textContent = err.message;
                        expenseError.classList.remove('d-none');
                    }
                }
            });
        }
    };

    const bindDeleteActions = () => {
        const familyList = document.getElementById('familyList');
        const participantList = document.getElementById('participantList');
        const expenseList = document.getElementById('expenseList');

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
                const target = event.target;
                if (!(target instanceof HTMLButtonElement)) return;
                if (target.dataset.action !== 'delete-expense') return;
                const id = target.dataset.id;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/expenses/${id}`, { method: 'DELETE' });
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
    };

    const bindSplitTypeToggle = () => {
        const inputs = document.querySelectorAll('input[name="splitType"]');
        inputs.forEach((input) => {
            input.addEventListener('change', () => {
                renderSplitTargets();
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
        await loadGroupData();
        renderGroupHeader();
        renderSummary();
        renderBalances();
        renderDebts();
        renderFamilies();
        renderParticipants();
        renderExpenses();
        populateExpenseSelectors();
        renderSplitTargets();
        applyPermissions();
    };

    const init = async () => {
        await setUserProfile();
        const ok = await loadGroups();
        if (!ok) return;
        bindGroupSelector();
        bindForms();
        bindDeleteActions();
        bindSplitTypeToggle();
        bindLogout();
        await refreshData();
    };

    init();
})();
