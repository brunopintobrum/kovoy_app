(() => {
    const getToken = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('token') || '';
    };

    const getCookie = (name) => {
        return document.cookie
            .split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith(`${name}=`))
            ?.split('=')[1];
    };

    const showState = (stateId) => {
        ['loadingState', 'errorState', 'inviteState', 'successState'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('d-none', id !== stateId);
        });
    };

    const showError = (title, message) => {
        document.getElementById('errorTitle').textContent = title;
        document.getElementById('errorMessage').textContent = message;
        showState('errorState');
    };

    const checkAuth = async () => {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                const data = await res.json();
                return data;
            }
        } catch (err) {}
        return null;
    };

    const fetchInviteInfo = async (token) => {
        try {
            const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/info`);
            if (res.ok) {
                return await res.json();
            }
            const err = await res.json().catch(() => ({}));
            return { error: err.error || 'Invalid invitation' };
        } catch (err) {
            return { error: 'Failed to load invitation' };
        }
    };

    const acceptInvite = async (token) => {
        const res = await fetch('/api/invitations/accept', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': getCookie('csrf_token') || ''
            },
            body: JSON.stringify({ token })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to accept invitation');
        }
        return await res.json();
    };

    const init = async () => {
        const token = getToken();
        if (!token) {
            showError('Missing Invitation', 'No invitation token provided. Please check your link.');
            return;
        }

        const inviteInfo = await fetchInviteInfo(token);
        if (inviteInfo.error) {
            showError('Invalid Invitation', inviteInfo.error);
            return;
        }

        document.getElementById('groupName').textContent = inviteInfo.groupName || 'Unknown Group';
        document.getElementById('inviteRole').textContent = (inviteInfo.role || 'member').toUpperCase();
        document.getElementById('inviteExpires').textContent = inviteInfo.expiresAt
            ? new Date(inviteInfo.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : '--';

        const user = await checkAuth();

        showState('inviteState');

        if (user && user.email) {
            document.getElementById('userEmail').textContent = user.email;
            document.getElementById('acceptSection').classList.remove('d-none');
            document.getElementById('loginRequired').classList.add('d-none');

            const acceptBtn = document.getElementById('acceptBtn');
            const acceptError = document.getElementById('acceptError');
            const acceptingState = document.getElementById('acceptingState');
            const acceptSection = document.getElementById('acceptSection');

            acceptBtn.addEventListener('click', async () => {
                acceptError.classList.add('d-none');
                acceptSection.classList.add('d-none');
                acceptingState.classList.remove('d-none');

                try {
                    const result = await acceptInvite(token);
                    document.getElementById('successGroupName').textContent = inviteInfo.groupName || 'the group';
                    const goToGroupBtn = document.getElementById('goToGroupBtn');
                    if (result.groupId) {
                        goToGroupBtn.href = `/group-details?groupId=${result.groupId}`;
                    }
                    showState('successState');
                } catch (err) {
                    acceptingState.classList.add('d-none');
                    acceptSection.classList.remove('d-none');
                    acceptError.textContent = err.message;
                    acceptError.classList.remove('d-none');
                }
            });
        } else {
            document.getElementById('loginRequired').classList.remove('d-none');
            document.getElementById('acceptSection').classList.add('d-none');

            const returnUrl = encodeURIComponent(window.location.href);
            document.getElementById('loginBtn').href = `/login?returnUrl=${returnUrl}`;
            document.getElementById('registerBtn').href = `/register?returnUrl=${returnUrl}`;
        }
    };

    init().catch(err => {
        console.error('Init error:', err);
        showError('Error', err.message || 'An unexpected error occurred.');
    });
})();
