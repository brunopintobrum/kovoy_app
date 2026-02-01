(() => {
    const getCookie = (name) => {
        return document.cookie
            .split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith(`${name}=`))
            ?.split('=')[1];
    };

    const showToast = (type, message) => {
        const toastId = type === 'success' ? 'successToast' : 'errorToast';
        const messageId = type === 'success' ? 'successToastMessage' : 'errorToastMessage';
        const toastEl = document.getElementById(toastId);
        const messageEl = document.getElementById(messageId);
        if (!toastEl || !messageEl) return;
        messageEl.textContent = message;
        const toast = new window.bootstrap.Toast(toastEl, { delay: 3000 });
        toast.show();
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

    const showLoadingSkeleton = () => {
        const rows = document.getElementById('groupRows');
        const cards = document.getElementById('groupCards');

        if (rows) {
            rows.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="placeholder-glow">
                            <span class="placeholder col-6"></span>
                            <span class="placeholder col-4"></span>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td colspan="5">
                        <div class="placeholder-glow">
                            <span class="placeholder col-7"></span>
                            <span class="placeholder col-3"></span>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td colspan="5">
                        <div class="placeholder-glow">
                            <span class="placeholder col-5"></span>
                            <span class="placeholder col-5"></span>
                        </div>
                    </td>
                </tr>
            `;
        }

        if (cards) {
            cards.innerHTML = `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="placeholder-glow">
                            <span class="placeholder col-6 mb-2"></span><br>
                            <span class="placeholder col-4"></span>
                        </div>
                    </div>
                </div>
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="placeholder-glow">
                            <span class="placeholder col-7 mb-2"></span><br>
                            <span class="placeholder col-5"></span>
                        </div>
                    </div>
                </div>
            `;
        }
    };

    const renderGroups = (groups) => {
        const rows = document.getElementById('groupRows');
        const cards = document.getElementById('groupCards');
        const count = document.getElementById('groupCount');
        if (!rows || !cards || !count) return;
        rows.innerHTML = '';
        cards.innerHTML = '';
        count.textContent = `${groups.length} group${groups.length === 1 ? '' : 's'}`;

        if (!groups.length) {
            const emptyState = `
                <div class="text-center py-5">
                    <div class="mb-3">
                        <i class="bx bx-briefcase-alt text-primary" style="font-size: 72px; opacity: 0.5;"></i>
                    </div>
                    <h5 class="text-muted mb-2">No groups yet</h5>
                    <p class="text-muted mb-3">Create your first trip group to get started</p>
                    <a href="#createGroup" class="btn btn-primary btn-sm">
                        <i class="bx bx-plus me-1"></i>Create group
                    </a>
                </div>
            `;
            rows.innerHTML = `<tr><td colspan="5">${emptyState}</td></tr>`;
            cards.innerHTML = emptyState;
            return;
        }

        groups.forEach((group) => {
            const roleLabel = group.role === 'admin' ? 'member' : group.role;
            const elevatedRole = group.role === 'owner';
            const roleBadgeClass = elevatedRole
                ? 'bg-soft-success text-success'
                : 'bg-soft-primary text-primary';
            const canLeave = !elevatedRole;
            const leaveMenuItem = canLeave
                ? `<li><a class="dropdown-item text-danger" href="javascript:void(0);" data-action="leave" data-id="${group.id}" data-name="${group.name}">
                        <i class="bx bx-log-out me-2"></i>Leave group
                   </a></li>`
                : '';
            const tr = document.createElement('tr');
            const memberCount = group.memberCount || 0;
            const memberText = memberCount === 1 ? 'member' : 'members';
            tr.innerHTML = `
                <td>
                    <div class="fw-semibold">${group.name}</div>
                    <div class="text-muted small">
                        <i class="bx bx-user"></i> ${memberCount} ${memberText}
                    </div>
                </td>
                <td>${group.defaultCurrency}</td>
                <td><span class="badge ${roleBadgeClass} text-uppercase">${roleLabel}</span></td>
                <td class="text-muted">${new Date(group.createdAt).toLocaleDateString()}</td>
                <td class="text-end">
                    <a class="btn btn-sm btn-primary" href="/dashboard?groupId=${group.id}">
                        <i class="bx bx-right-arrow-alt"></i> Open
                    </a>
                    <div class="btn-group ms-1">
                        <button type="button" class="btn btn-sm btn-light dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bx bx-dots-vertical-rounded"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="/dashboard?groupId=${group.id}">
                                <i class="bx bx-cog me-2"></i>Group settings
                            </a></li>
                            ${leaveMenuItem}
                        </ul>
                    </div>
                </td>
            `;
            rows.appendChild(tr);

            // Render card for mobile
            const card = document.createElement('div');
            card.className = 'card mb-3';
            card.innerHTML = `
                <div class="card-body">
                    <div class="d-flex align-items-start justify-content-between mb-2">
                        <div class="flex-grow-1">
                            <h5 class="mb-1">${group.name}</h5>
                            <div class="text-muted small mb-2">
                                <i class="bx bx-user"></i> ${memberCount} ${memberText}
                                <span class="mx-1">•</span>
                                ${group.defaultCurrency}
                            </div>
                            <div>
                                <span class="badge ${roleBadgeClass} text-uppercase me-2">${roleLabel}</span>
                                <span class="text-muted small">
                                    <i class="bx bx-calendar"></i> ${new Date(group.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex gap-2 mt-3">
                        <a class="btn btn-primary btn-sm flex-grow-1" href="/dashboard?groupId=${group.id}">
                            <i class="bx bx-right-arrow-alt"></i> Open
                        </a>
                        <div class="btn-group">
                            <button type="button" class="btn btn-sm btn-light dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="bx bx-dots-vertical-rounded"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li><a class="dropdown-item" href="/dashboard?groupId=${group.id}">
                                    <i class="bx bx-cog me-2"></i>Group settings
                                </a></li>
                                ${leaveMenuItem}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
            cards.appendChild(card);
        });
    };

    const loadGroups = async () => {
        showLoadingSkeleton();
        const data = await apiRequest('/api/groups');
        renderGroups(data.data || []);
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

    const bindCreateGroup = () => {
        const form = document.getElementById('createGroupForm');
        const errorEl = document.getElementById('createGroupError');
        if (!form) return;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (errorEl) errorEl.classList.add('d-none');
            if (!validateForm(form)) return;
            const name = document.getElementById('groupName')?.value || '';
            const defaultCurrency = document.getElementById('groupCurrency')?.value || '';
            try {
                const res = await apiRequest('/api/groups', {
                    method: 'POST',
                    body: JSON.stringify({ name, defaultCurrency })
                });
                form.reset();
                form.classList.remove('was-validated');
                if (res && res.groupId) {
                    window.location.href = `/dashboard?groupId=${res.groupId}`;
                    return;
                }
                await loadGroups();
                showToast('success', 'Group created successfully!');
            } catch (err) {
                showToast('error', err.message || 'Failed to create group');
            }
        });
    };

    const bindAcceptInvite = () => {
        const form = document.getElementById('acceptInviteForm');
        const errorEl = document.getElementById('acceptInviteError');
        const successEl = document.getElementById('acceptInviteSuccess');
        if (!form) return;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (errorEl) errorEl.classList.add('d-none');
            if (successEl) successEl.classList.add('d-none');
            if (!validateForm(form)) return;
            const token = document.getElementById('inviteToken')?.value || '';
            try {
                const res = await apiRequest('/api/invitations/accept', {
                    method: 'POST',
                    body: JSON.stringify({ token })
                });
                showToast('success', 'Invite accepted! Redirecting to the group...');
                setTimeout(() => {
                    window.location.href = `/dashboard?groupId=${res.groupId}`;
                }, 1500);
            } catch (err) {
                showToast('error', err.message || 'Failed to accept invite');
            }
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

    const bindAvatarChange = () => {
        const trigger = document.getElementById('changeAvatarLink');
        const modalEl = document.getElementById('avatarModal');
        const fileInput = document.getElementById('avatarFile');
        const preview = document.getElementById('avatarPreview');
        const saveButton = document.getElementById('avatarSaveBtn');
        const errorEl = document.getElementById('avatarError');

        if (!trigger || !modalEl || !fileInput || !preview || !saveButton) return;

        let selectedFile = null;

        const showModal = () => {
            if (window.jQuery) {
                window.jQuery(modalEl).modal('show');
            } else if (window.bootstrap && window.bootstrap.Modal) {
                new window.bootstrap.Modal(modalEl).show();
            }
        };

        const hideModal = () => {
            if (window.jQuery) {
                window.jQuery(modalEl).modal('hide');
            } else if (window.bootstrap && window.bootstrap.Modal) {
                const modal = window.bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
        };

        const setError = (msg) => {
            if (!errorEl) return;
            if (msg) {
                errorEl.textContent = msg;
                errorEl.classList.remove('d-none');
            } else {
                errorEl.classList.add('d-none');
            }
        };

        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setError('');
            selectedFile = null;
            fileInput.value = '';
            const currentAvatar = document.getElementById('userAvatar');
            preview.src = currentAvatar ? currentAvatar.src : '/assets/images/users/default-avatar.svg';
            showModal();
        });

        fileInput.addEventListener('change', () => {
            setError('');
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                setError('The file is too large. Max size is 2MB.');
                fileInput.value = '';
                return;
            }
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });

        saveButton.addEventListener('click', async () => {
            setError('');
            const file = selectedFile;
            if (!file) {
                setError('Select an image first.');
                return;
            }
            const originalLabel = saveButton.textContent;
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';
            try {
                const formData = new FormData();
                formData.append('avatar', file);
                const res = await fetch('/api/me/avatar', {
                    method: 'POST',
                    body: formData,
                    headers: { 'x-csrf-token': getCookie('csrf_token') || '' }
                });
                if (!res.ok) throw new Error('Failed to upload');
                const data = await res.json();
                if (data && data.avatarUrl) {
                    const avatar = document.getElementById('userAvatar');
                    if (avatar) avatar.src = data.avatarUrl;
                    preview.src = data.avatarUrl;
                }
                hideModal();
            } catch (err) {
                setError('Unable to update the photo. Please try again.');
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = originalLabel;
            }
        });
    };

    const bindMobileMenuToggleFallback = () => {
        const btn = document.getElementById('vertical-menu-btn');
        if (!btn) return;
        btn.addEventListener('click', (event) => {
            if (window.innerWidth >= 992) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            document.body.classList.toggle('sidebar-enable');
        }, true);
    };

    const bindMobileMenuAutoClose = () => {
        const menu = document.getElementById('side-menu');
        if (!menu) return;
        menu.addEventListener('click', (event) => {
            const target = event.target.closest('a');
            if (!target) return;
            if (window.innerWidth >= 992) return;
            document.body.classList.remove('sidebar-enable');
        });
    };

    const bindLeaveGroup = () => {
        const rows = document.getElementById('groupRows');
        if (!rows) return;
        rows.addEventListener('click', async (event) => {
            const link = event.target.closest('a[data-action="leave"]');
            if (!link) return;
            event.preventDefault();
            const groupId = link.dataset.id;
            const groupName = link.dataset.name || 'this group';
            if (!groupId) return;
            if (!confirm(`Are you sure you want to leave "${groupName}"?`)) return;
            try {
                await apiRequest(`/api/groups/${groupId}/members/me`, { method: 'DELETE' });
                await loadGroups();
                showToast('success', `You have left "${groupName}"`);
            } catch (err) {
                showToast('error', err.message || 'Failed to leave group');
            }
        });
    };

    const init = async () => {
        await setUserProfile();
        await loadGroups();
        bindCreateGroup();
        bindAcceptInvite();
        bindLeaveGroup();
        bindLogout();
        bindAvatarChange();
        bindMobileMenuToggleFallback();
        bindMobileMenuAutoClose();
    };

    init();
})();
