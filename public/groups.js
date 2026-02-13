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

    const getGroupInitials = (name) => {
        if (!name) return '?';
        const words = name.trim().split(/\s+/);
        if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    };

    const getGroupAvatarColor = (name) => {
        const colors = [
            { bg: '#667eea', text: '#fff' }, // Purple
            { bg: '#764ba2', text: '#fff' }, // Deep purple
            { bg: '#f093fb', text: '#fff' }, // Pink
            { bg: '#4facfe', text: '#fff' }, // Blue
            { bg: '#43e97b', text: '#fff' }, // Green
            { bg: '#fa709a', text: '#fff' }, // Rose
            { bg: '#feca57', text: '#2c3e50' }, // Yellow
            { bg: '#ff6b6b', text: '#fff' }  // Red
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
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
            const email = me.email || '';

            // Display name: use display_name, or first_name + last_name, or email
            let displayName = me.display_name || me.displayName;
            if (!displayName && (me.first_name || me.firstName || me.last_name || me.lastName)) {
                const firstName = me.first_name || me.firstName || '';
                const lastName = me.last_name || me.lastName || '';
                displayName = `${firstName} ${lastName}`.trim();
            }
            if (!displayName) {
                displayName = email.split('@')[0]; // Use email username as fallback
            }

            // Set header display name
            const userDisplayName = document.getElementById('userDisplayName');
            if (userDisplayName) userDisplayName.textContent = displayName;

            // Set dropdown name and email
            const dropdownUserName = document.getElementById('dropdownUserName');
            if (dropdownUserName) dropdownUserName.textContent = displayName;

            const dropdownUserEmail = document.getElementById('dropdownUserEmail');
            if (dropdownUserEmail) dropdownUserEmail.textContent = email;

            // Set avatar
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
        if (!rows && !cards) return;
        if (rows) rows.innerHTML = '';
        if (cards) cards.innerHTML = '';
        if (count) count.textContent = `${groups.length} group${groups.length === 1 ? '' : 's'}`;

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
            if (rows) rows.innerHTML = `<tr><td colspan="5">${emptyState}</td></tr>`;
            if (cards) cards.innerHTML = emptyState;
            return;
        }

        groups.forEach((group) => {
            const roleLabel = group.role === 'admin' ? 'member' : group.role;
            const isOwner = group.role === 'owner';
            const roleBadgeClass = isOwner
                ? 'bg-soft-success text-success'
                : 'bg-soft-primary text-primary';
            const canLeave = group.role !== 'owner';
            const leaveMenuItem = canLeave
                ? `<li><hr class="dropdown-divider"></li>
                   <li><a class="dropdown-item text-danger" href="javascript:void(0);" data-action="leave" data-id="${group.id}" data-name="${group.name}">
                        <i class="bx bx-log-out me-2"></i>Leave group
                   </a></li>`
                : '';
            const tr = document.createElement('tr');
            const memberCount = group.memberCount || 0;
            const memberText = memberCount === 1 ? 'member' : 'members';
            const initials = getGroupInitials(group.name);
            const avatarColor = getGroupAvatarColor(group.name);

            const nameDiv = document.createElement('div');
            nameDiv.className = 'fw-semibold';
            nameDiv.textContent = group.name;

            const memberInfoDiv = document.createElement('div');
            memberInfoDiv.className = 'text-muted small';
            memberInfoDiv.innerHTML = `<i class="bx bx-user"></i> ${memberCount} ${memberText}`;

            const infoDiv = document.createElement('div');
            infoDiv.appendChild(nameDiv);
            infoDiv.appendChild(memberInfoDiv);

            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'avatar-sm rounded-circle d-flex align-items-center justify-content-center me-2 flex-shrink-0';
            avatarDiv.style.background = avatarColor.bg;
            avatarDiv.style.color = avatarColor.text;
            avatarDiv.style.fontWeight = '600';
            avatarDiv.style.fontSize = '14px';
            avatarDiv.textContent = initials;

            const containerDiv = document.createElement('div');
            containerDiv.className = 'd-flex align-items-center';
            containerDiv.appendChild(avatarDiv);
            containerDiv.appendChild(infoDiv);

            const td1 = document.createElement('td');
            td1.appendChild(containerDiv);

            const td2 = document.createElement('td');
            td2.textContent = group.defaultCurrency;

            const badgeSpan = document.createElement('span');
            badgeSpan.className = `badge ${roleBadgeClass} text-uppercase`;
            badgeSpan.textContent = roleLabel;

            const td3 = document.createElement('td');
            td3.appendChild(badgeSpan);

            const td4 = document.createElement('td');
            td4.className = 'text-muted';
            td4.textContent = new Date(group.createdAt).toLocaleDateString();

            const openLink = document.createElement('a');
            openLink.className = 'btn btn-sm btn-primary';
            openLink.href = `/dashboard?groupId=${group.id}`;
            openLink.innerHTML = `<i class="bx bx-right-arrow-alt me-1"></i> Open Group`;

            const dropdownBtn = document.createElement('button');
            dropdownBtn.type = 'button';
            dropdownBtn.className = 'btn btn-sm btn-light dropdown-toggle';
            dropdownBtn.setAttribute('data-bs-toggle', 'dropdown');
            dropdownBtn.setAttribute('aria-expanded', 'false');
            dropdownBtn.innerHTML = `<i class="bx bx-dots-vertical-rounded"></i>`;

            const settingsLink = document.createElement('a');
            settingsLink.className = 'dropdown-item';
            settingsLink.href = `/dashboard?groupId=${group.id}`;
            settingsLink.innerHTML = `<i class="bx bx-cog me-2"></i>Group settings`;

            const menuLi = document.createElement('li');
            menuLi.appendChild(settingsLink);

            const menuUl = document.createElement('ul');
            menuUl.className = 'dropdown-menu dropdown-menu-end';
            menuUl.appendChild(menuLi);
            if (leaveMenuItem) {
                menuUl.innerHTML += leaveMenuItem;
            }

            const btnGroup = document.createElement('div');
            btnGroup.className = 'btn-group ms-1';
            btnGroup.appendChild(dropdownBtn);
            btnGroup.appendChild(menuUl);

            const td5 = document.createElement('td');
            td5.className = 'text-end';
            td5.appendChild(openLink);
            td5.appendChild(btnGroup);

            tr.appendChild(td1);
            tr.appendChild(td2);
            tr.appendChild(td3);
            tr.appendChild(td4);
            tr.appendChild(td5);
            if (rows) rows.appendChild(tr);

            // Render card for mobile
            if (cards) {
                const card = document.createElement('div');
                card.className = 'card mb-3 group-card';

                const cardBody = document.createElement('div');
                cardBody.className = 'card-body';

                const cardAvatar = document.createElement('div');
                cardAvatar.className = 'avatar-md rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0';
                cardAvatar.style.background = avatarColor.bg;
                cardAvatar.style.color = avatarColor.text;
                cardAvatar.style.fontWeight = '600';
                cardAvatar.style.fontSize = '20px';
                cardAvatar.textContent = initials;

                const cardTitle = document.createElement('h5');
                cardTitle.className = 'mb-2 fw-bold';
                cardTitle.textContent = group.name;

                const cardBadgeSpan = document.createElement('span');
                cardBadgeSpan.className = `badge ${roleBadgeClass} text-uppercase`;
                cardBadgeSpan.innerHTML = `<i class="bx ${isOwner ? 'bx-crown' : 'bx-user'} me-1"></i>${roleLabel}`;

                const cardBadgeDiv = document.createElement('div');
                cardBadgeDiv.className = 'd-flex flex-wrap gap-2 mb-2';
                cardBadgeDiv.appendChild(cardBadgeSpan);

                const cardInfoDiv = document.createElement('div');
                cardInfoDiv.className = 'text-muted small';
                cardInfoDiv.innerHTML = `
                    <div class="mb-1"><i class="bx bx-user text-primary"></i> ${memberCount} ${memberText}</div>
                    <div class="mb-1"><i class="bx bx-dollar text-primary"></i> ${group.defaultCurrency}</div>
                    <div><i class="bx bx-calendar text-primary"></i> ${new Date(group.createdAt).toLocaleDateString()}</div>
                `;

                const cardInfoCol = document.createElement('div');
                cardInfoCol.className = 'flex-grow-1';
                cardInfoCol.appendChild(cardTitle);
                cardInfoCol.appendChild(cardBadgeDiv);
                cardInfoCol.appendChild(cardInfoDiv);

                const cardHeader = document.createElement('div');
                cardHeader.className = 'd-flex align-items-start mb-3';
                cardHeader.appendChild(cardAvatar);
                cardHeader.appendChild(cardInfoCol);

                const cardOpenLink = document.createElement('a');
                cardOpenLink.className = 'btn btn-primary btn-sm flex-grow-1';
                cardOpenLink.href = `/dashboard?groupId=${group.id}`;
                cardOpenLink.innerHTML = `<i class="bx bx-right-arrow-alt me-1"></i> Open Group`;

                const cardDropdownBtn = document.createElement('button');
                cardDropdownBtn.type = 'button';
                cardDropdownBtn.className = 'btn btn-sm btn-light dropdown-toggle';
                cardDropdownBtn.setAttribute('data-bs-toggle', 'dropdown');
                cardDropdownBtn.setAttribute('aria-expanded', 'false');
                cardDropdownBtn.innerHTML = `<i class="bx bx-dots-vertical-rounded"></i>`;

                const cardSettingsLink = document.createElement('a');
                cardSettingsLink.className = 'dropdown-item';
                cardSettingsLink.href = `/dashboard?groupId=${group.id}`;
                cardSettingsLink.innerHTML = `<i class="bx bx-cog me-2"></i>Group settings`;

                const cardMenuLi = document.createElement('li');
                cardMenuLi.appendChild(cardSettingsLink);

                const cardMenuUl = document.createElement('ul');
                cardMenuUl.className = 'dropdown-menu dropdown-menu-end';
                cardMenuUl.appendChild(cardMenuLi);
                if (leaveMenuItem) {
                    cardMenuUl.innerHTML += leaveMenuItem;
                }

                const cardBtnGroup = document.createElement('div');
                cardBtnGroup.className = 'btn-group';
                cardBtnGroup.appendChild(cardDropdownBtn);
                cardBtnGroup.appendChild(cardMenuUl);

                const cardFooter = document.createElement('div');
                cardFooter.className = 'd-flex gap-2';
                cardFooter.appendChild(cardOpenLink);
                cardFooter.appendChild(cardBtnGroup);

                cardBody.appendChild(cardHeader);
                cardBody.appendChild(cardFooter);
                card.appendChild(cardBody);
                cards.appendChild(card);
            }
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
