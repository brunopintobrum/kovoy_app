(() => {
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

    const renderGroups = (groups) => {
        const rows = document.getElementById('groupRows');
        const count = document.getElementById('groupCount');
        if (!rows || !count) return;
        rows.innerHTML = '';
        count.textContent = `${groups.length} group${groups.length === 1 ? '' : 's'}`;

        if (!groups.length) {
            rows.innerHTML = '<tr><td colspan="5" class="text-muted text-center">No groups yet.</td></tr>';
            return;
        }

        groups.forEach((group) => {
            const roleLabel = group.role === 'admin' ? 'member' : group.role;
            const elevatedRole = group.role === 'owner';
            const roleBadgeClass = elevatedRole
                ? 'bg-soft-success text-success'
                : 'bg-soft-primary text-primary';
            const canLeave = !elevatedRole;
            const leaveButton = canLeave
                ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="leave" data-id="${group.id}" data-name="${group.name}">Leave</button>`
                : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="fw-semibold">${group.name}</div>
                </td>
                <td>${group.defaultCurrency}</td>
                <td><span class="badge ${roleBadgeClass} text-uppercase">${roleLabel}</span></td>
                <td class="text-muted">${new Date(group.createdAt).toLocaleDateString()}</td>
                <td class="text-end">
                    <a class="btn btn-sm btn-outline-primary" href="/dashboard?groupId=${group.id}">Open</a>${leaveButton}
                </td>
            `;
            rows.appendChild(tr);
        });
    };

    const loadGroups = async () => {
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
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message;
                    errorEl.classList.remove('d-none');
                }
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
                if (successEl) {
                    successEl.textContent = 'Invite accepted. Redirecting to the group...';
                    successEl.classList.remove('d-none');
                }
                setTimeout(() => {
                    window.location.href = `/dashboard?groupId=${res.groupId}`;
                }, 800);
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message;
                    errorEl.classList.remove('d-none');
                }
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
            const button = event.target.closest('button[data-action="leave"]');
            if (!button) return;
            const groupId = button.dataset.id;
            const groupName = button.dataset.name || 'this group';
            if (!groupId) return;
            if (!confirm(`Are you sure you want to leave "${groupName}"?`)) return;
            try {
                await apiRequest(`/api/groups/${groupId}/members/me`, { method: 'DELETE' });
                await loadGroups();
            } catch (err) {
                alert(err.message || 'Failed to leave group.');
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
