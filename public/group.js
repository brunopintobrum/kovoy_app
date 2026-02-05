(() => {
    const state = {
        groups: [],
        group: null,
        groupId: null,
        families: [],
        participants: [],
        airlines: [],
        lodgingPlatforms: [],
        lodgingProperties: [],
        lodgingLocations: { cities: [], states: [] },
        lodgingCountries: [],
        postalPatterns: null,
        airports: { from: [], to: [] },
        expenses: [],
        flights: [],
        lodgings: [],
        transports: [],
        tickets: [],
        summary: null,
        canEdit: false,
        canManage: false,
        members: [],
        editing: {
            familyId: null,
            participantId: null,
            flightId: null,
            flightSeatMap: {},
            flightBaggageMap: {},
            lodgingId: null,
            transportId: null,
            ticketId: null,
            expenseId: null,
            expenseConfig: null
        },
        filters: {
            flights: { airline: '', from: '', to: '', status: '' },
            lodgings: { city: '', status: '' },
            transports: { status: '', provider: '' },
            tickets: { type: '', status: '', dateFrom: '', dateTo: '' }
        },
        sorting: {
            participants: { field: null, direction: 'asc' },
            expenses: { field: null, direction: 'asc' },
            flights: { field: null, direction: 'asc' },
            lodgings: { field: null, direction: 'asc' },
            transports: { field: null, direction: 'asc' },
            tickets: { field: null, direction: 'asc' }
        }
    };

    const moduleExpenseConfigs = [
        { prefix: 'flight', toggleId: 'flightLinkExpense', fieldsId: 'flightExpenseFields', payerId: 'flightExpensePayer' },
        { prefix: 'lodging', toggleId: 'lodgingLinkExpense', fieldsId: 'lodgingExpenseFields', payerId: 'lodgingExpensePayer' },
        { prefix: 'transport', toggleId: 'transportLinkExpense', fieldsId: 'transportExpenseFields', payerId: 'transportExpensePayer' },
        { prefix: 'ticket', toggleId: 'ticketLinkExpense', fieldsId: 'ticketExpenseFields', payerId: 'ticketExpensePayer' }
    ];

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

    const confirmAction = (message) => {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmDeleteModal');
            const messageEl = document.getElementById('confirmDeleteMessage');
            const confirmBtn = document.getElementById('confirmDeleteBtn');
            if (messageEl) messageEl.textContent = message;
            let confirmed = false;
            const onConfirm = () => {
                confirmed = true;
                resolve(true);
                bsModal.hide();
            };
            const onHidden = () => {
                confirmBtn?.removeEventListener('click', onConfirm);
                modal?.removeEventListener('hidden.bs.modal', onHidden);
                if (!confirmed) resolve(false);
            };
            confirmBtn?.addEventListener('click', onConfirm);
            modal?.addEventListener('hidden.bs.modal', onHidden);
            const bsModal = window.bootstrap.Modal.getInstance(modal) || new window.bootstrap.Modal(modal);
            bsModal.show();
        });
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

    const normalizeDisplayNameKey = (value) => {
        return String(value || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    };

    const getUniquePayerParticipants = (participants) => {
        const byName = new Map();
        const result = [];
        participants.forEach((participant) => {
            const key = normalizeDisplayNameKey(participant.displayName);
            if (!key) {
                result.push(participant);
                return;
            }
            const existing = byName.get(key);
            if (!existing) {
                byName.set(key, participant);
                result.push(participant);
                return;
            }
            const existingHasUser = Boolean(existing.userId);
            const currentHasUser = Boolean(participant.userId);
            if (currentHasUser && !existingHasUser) {
                const index = result.findIndex((item) => item.id === existing.id);
                if (index >= 0) {
                    result[index] = participant;
                }
                byName.set(key, participant);
                return;
            }
        });
        return result;
    };

    const parseDateValue = (value) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed;
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

    const lodgingCountries = [
        'Afghanistan',
        'Albania',
        'Algeria',
        'Andorra',
        'Angola',
        'Antigua and Barbuda',
        'Argentina',
        'Armenia',
        'Australia',
        'Austria',
        'Azerbaijan',
        'Bahamas',
        'Bahrain',
        'Bangladesh',
        'Barbados',
        'Belarus',
        'Belgium',
        'Belize',
        'Benin',
        'Bhutan',
        'Bolivia',
        'Bosnia and Herzegovina',
        'Botswana',
        'Brazil',
        'Brunei',
        'Bulgaria',
        'Burkina Faso',
        'Burundi',
        'Cambodia',
        'Cameroon',
        'Canada',
        'Cape Verde',
        'Central African Republic',
        'Chad',
        'Chile',
        'China',
        'Colombia',
        'Comoros',
        'Congo (Brazzaville)',
        'Congo (DRC)',
        'Costa Rica',
        "Cote d'Ivoire",
        'Croatia',
        'Cuba',
        'Cyprus',
        'Czech Republic',
        'Denmark',
        'Djibouti',
        'Dominica',
        'Dominican Republic',
        'Ecuador',
        'Egypt',
        'El Salvador',
        'Equatorial Guinea',
        'Eritrea',
        'Estonia',
        'Eswatini',
        'Ethiopia',
        'Fiji',
        'Finland',
        'France',
        'Gabon',
        'Gambia',
        'Georgia',
        'Germany',
        'Ghana',
        'Greece',
        'Grenada',
        'Guatemala',
        'Guinea',
        'Guinea-Bissau',
        'Guyana',
        'Haiti',
        'Honduras',
        'Hungary',
        'Iceland',
        'India',
        'Indonesia',
        'Iran',
        'Iraq',
        'Ireland',
        'Israel',
        'Italy',
        'Jamaica',
        'Japan',
        'Jordan',
        'Kazakhstan',
        'Kenya',
        'Kiribati',
        'Kuwait',
        'Kyrgyzstan',
        'Laos',
        'Latvia',
        'Lebanon',
        'Lesotho',
        'Liberia',
        'Libya',
        'Liechtenstein',
        'Lithuania',
        'Luxembourg',
        'Madagascar',
        'Malawi',
        'Malaysia',
        'Maldives',
        'Mali',
        'Malta',
        'Marshall Islands',
        'Mauritania',
        'Mauritius',
        'Mexico',
        'Micronesia',
        'Moldova',
        'Monaco',
        'Mongolia',
        'Montenegro',
        'Morocco',
        'Mozambique',
        'Myanmar',
        'Namibia',
        'Nauru',
        'Nepal',
        'Netherlands',
        'New Zealand',
        'Nicaragua',
        'Niger',
        'Nigeria',
        'North Korea',
        'North Macedonia',
        'Norway',
        'Oman',
        'Pakistan',
        'Palau',
        'Panama',
        'Papua New Guinea',
        'Paraguay',
        'Peru',
        'Philippines',
        'Poland',
        'Portugal',
        'Qatar',
        'Romania',
        'Russia',
        'Rwanda',
        'Saint Kitts and Nevis',
        'Saint Lucia',
        'Saint Vincent and the Grenadines',
        'Samoa',
        'San Marino',
        'Sao Tome and Principe',
        'Saudi Arabia',
        'Senegal',
        'Serbia',
        'Seychelles',
        'Sierra Leone',
        'Singapore',
        'Slovakia',
        'Slovenia',
        'Solomon Islands',
        'Somalia',
        'South Africa',
        'South Korea',
        'South Sudan',
        'Spain',
        'Sri Lanka',
        'Sudan',
        'Suriname',
        'Sweden',
        'Switzerland',
        'Syria',
        'Taiwan',
        'Tajikistan',
        'Tanzania',
        'Thailand',
        'Timor-Leste',
        'Togo',
        'Tonga',
        'Trinidad and Tobago',
        'Tunisia',
        'Turkey',
        'Turkmenistan',
        'Tuvalu',
        'Uganda',
        'Ukraine',
        'United Arab Emirates',
        'United Kingdom',
        'United States',
        'Uruguay',
        'Uzbekistan',
        'Vanuatu',
        'Vatican City',
        'Venezuela',
        'Vietnam',
        'Yemen',
        'Zambia',
        'Zimbabwe'
    ];
    const lodgingFallbackLocations = {
        'Brazil': {
            states: ['SP', 'RJ', 'MG', 'RS', 'SC', 'BA', 'PR', 'PE', 'CE', 'DF'],
            cities: [
                'Sao Paulo',
                'Rio de Janeiro',
                'Brasilia',
                'Belo Horizonte',
                'Curitiba',
                'Salvador',
                'Fortaleza',
                'Recife',
                'Porto Alegre',
                'Florianopolis'
            ]
        },
        'Canada': {
            states: ['ON', 'QC', 'BC', 'AB', 'MB', 'NS', 'SK', 'NB', 'NL', 'PE'],
            cities: [
                'Toronto',
                'Montreal',
                'Vancouver',
                'Calgary',
                'Ottawa',
                'Edmonton',
                'Winnipeg',
                'Quebec City',
                'Halifax',
                'Victoria'
            ]
        },
        'United Kingdom': {
            states: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
            cities: [
                'London',
                'Manchester',
                'Birmingham',
                'Edinburgh',
                'Glasgow',
                'Liverpool',
                'Bristol',
                'Leeds',
                'Cardiff',
                'Belfast'
            ]
        },
        'United States': {
            states: ['FL', 'CA', 'NY', 'TX', 'NV', 'IL', 'GA', 'MA', 'WA', 'AZ'],
            cities: [
                'Orlando',
                'Miami',
                'New York',
                'Los Angeles',
                'San Francisco',
                'Las Vegas',
                'Chicago',
                'Houston',
                'Seattle',
                'Boston'
            ]
        }
    };
    const fallbackCountryCodes = {
        'Australia': 'AU',
        'Brazil': 'BR',
        'Canada': 'CA',
        'France': 'FR',
        'Germany': 'DE',
        'Italy': 'IT',
        'Japan': 'JP',
        'Mexico': 'MX',
        'Portugal': 'PT',
        'Spain': 'ES',
        'United Kingdom': 'GB',
        'United States': 'US'
    };
    const fallbackCountryNames = Object.entries(fallbackCountryCodes).reduce((acc, [name, code]) => {
        acc[code] = name;
        return acc;
    }, {});

    const resolveCountryName = (codeOrName) => {
        if (!codeOrName) return '';
        const match = state.lodgingCountries.find((country) => country.code === codeOrName);
        if (match) return match.name;
        return fallbackCountryNames[codeOrName] || codeOrName;
    };
    const resolveCountryCode = (codeOrName) => {
        if (!codeOrName) return '';
        const trimmed = String(codeOrName).trim();
        if (!trimmed) return '';
        const match = state.lodgingCountries.find(
            (country) => country.code === trimmed || country.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (match) return match.code;
        if (fallbackCountryCodes[trimmed]) return fallbackCountryCodes[trimmed];
        if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
        return '';
    };

    const normalizePostalPattern = (pattern) => {
        if (!pattern) return { pattern: '', flags: '' };
        let normalized = pattern;
        let flags = '';
        if (normalized.startsWith('(?i)')) {
            normalized = normalized.slice(4);
            flags = 'i';
        }
        if (normalized.includes('(?i:')) {
            normalized = normalized.replace(/\(\?i:/g, '(');
            flags = 'i';
        }
        if (!normalized.startsWith('^')) normalized = `^${normalized}`;
        if (!normalized.endsWith('$')) normalized = `${normalized}$`;
        return { pattern: normalized, flags };
    };

    const loadPostalPatterns = async () => {
        if (state.postalPatterns) return state.postalPatterns;
        try {
            const response = await fetch('/data/postal-patterns.json', { cache: 'force-cache' });
            if (!response.ok) throw new Error(`Request failed: ${response.status}`);
            state.postalPatterns = await response.json();
        } catch (err) {
            state.postalPatterns = {};
            console.warn('Failed to load postal patterns:', err.message);
        }
        return state.postalPatterns;
    };

    const findRegionPattern = (regions, regionValue) => {
        if (!regions || !regionValue) return '';
        const trimmed = String(regionValue).trim();
        if (!trimmed) return '';
        if (regions[trimmed]) return regions[trimmed];
        const lower = trimmed.toLowerCase();
        const match = Object.keys(regions).find((key) => key.toLowerCase() === lower);
        return match ? regions[match] : '';
    };

    const applyPostalPattern = async (codeOrName, regionValue = '') => {
        const input = document.getElementById('lodgingPostalCode');
        if (!input) return;
        const countryCode = resolveCountryCode(codeOrName);
        if (!countryCode) {
            input.removeAttribute('pattern');
            input.removeAttribute('title');
            input.removeAttribute('placeholder');
            input.style.textTransform = '';
            return;
        }
        const patterns = await loadPostalPatterns();
        const rule = patterns[countryCode];
        if (!rule?.pattern) {
            input.removeAttribute('pattern');
            input.removeAttribute('title');
            input.removeAttribute('placeholder');
            input.style.textTransform = '';
            return;
        }
        const regionPattern = findRegionPattern(rule.regions, regionValue);
        const { pattern } = normalizePostalPattern(regionPattern || rule.pattern);
        input.setAttribute('pattern', pattern);
        if (rule.example) {
            input.setAttribute('placeholder', rule.example);
            input.setAttribute('title', `Format example: ${rule.example}`);
        } else {
            input.removeAttribute('placeholder');
            input.setAttribute('title', 'Invalid postal code format.');
        }
        if (/[A-Z]/.test(rule.pattern) && !/[a-z]/.test(rule.pattern)) {
            input.style.textTransform = 'uppercase';
        } else {
            input.style.textTransform = '';
        }
    };

    const setupFlightAirlineAutocomplete = () => {
        const input = document.getElementById('flightAirline');
        if (!input) return;
        const handler = () => syncFlightAirlineIdFromInput();
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    };

    const renderLodgingPlatformOptions = () => {
        const list = document.getElementById('lodgingPlatformList');
        if (!list) return;
        list.innerHTML = '';
        state.lodgingPlatforms.forEach((platform) => {
            const option = document.createElement('option');
            option.value = platform.name;
            list.appendChild(option);
        });
        syncLodgingPlatformIdFromInput();
    };

    const renderLodgingPropertyOptions = () => {
        const list = document.getElementById('lodgingPropertyList');
        if (!list) return;
        list.innerHTML = '';
        state.lodgingProperties.forEach((property) => {
            if (!property?.name) return;
            const option = document.createElement('option');
            option.value = property.name;
            list.appendChild(option);
        });
    };

    const renderLodgingCountryOptions = () => {
        const select = document.getElementById('lodgingCountry');
        if (!select) return;
        const current = select.value;
        const options = state.lodgingCountries.length
            ? state.lodgingCountries
            : lodgingCountries.map((name) => ({
                code: fallbackCountryCodes[name] || name,
                name
            }));
        select.innerHTML = '<option value=\"\">Select a country</option>';
        options.forEach((country) => {
            const option = document.createElement('option');
            option.value = country.code;
            option.textContent = country.name;
            select.appendChild(option);
        });
        if (current) {
            const exists = options.some((country) => country.code === current);
            if (!exists) {
                const option = document.createElement('option');
                option.value = current;
                option.textContent = current;
                select.appendChild(option);
            }
            select.value = current;
        }
        applyPostalPattern(select.value.trim(), document.getElementById('lodgingState')?.value);
    };

    const renderLodgingLocationOptions = () => {
        const cityList = document.getElementById('lodgingCityList');
        const stateList = document.getElementById('lodgingStateList');
        if (cityList) {
            cityList.innerHTML = '';
            state.lodgingLocations.cities.forEach((city) => {
                if (!city?.name) return;
                const option = document.createElement('option');
                option.value = city.name;
                cityList.appendChild(option);
            });
        }
        if (stateList) {
            stateList.innerHTML = '';
            state.lodgingLocations.states.forEach((region) => {
                if (!region?.name) return;
                const option = document.createElement('option');
                option.value = region.name;
                stateList.appendChild(option);
            });
        }
    };

    const mergeLocationSuggestions = (primary, fallback, limit) => {
        const results = [];
        const seen = new Set();
        primary.forEach((item) => {
            if (!item?.name) return;
            const key = String(item.name).toLowerCase();
            if (seen.has(key)) return;
            results.push({ name: item.name, usageCount: item.usageCount ?? 0 });
            seen.add(key);
        });
        fallback.forEach((name) => {
            const key = String(name).toLowerCase();
            if (seen.has(key)) return;
            results.push({ name, usageCount: 0 });
            seen.add(key);
        });
        return results.slice(0, limit);
    };

    const syncLodgingPlatformIdFromInput = () => {
        const input = document.getElementById('lodgingPlatform');
        const hidden = document.getElementById('lodgingPlatformId');
        if (!input || !hidden) return;
        const value = input.value.trim().toLowerCase();
        if (!value) {
            hidden.value = '';
            return;
        }
        const match = state.lodgingPlatforms.find((item) => item.name.toLowerCase() === value);
        hidden.value = match ? match.id : '';
    };

    const loadLodgingPlatforms = async () => {
        try {
            const response = await apiRequest('/api/lodging-platforms');
            state.lodgingPlatforms = response.data || [];
        } catch (err) {
            console.warn('Failed to load lodging platforms:', err.message);
        } finally {
            renderLodgingPlatformOptions();
        }
    };

    const loadLodgingProperties = async () => {
        if (!state.groupId) return;
        try {
            const response = await apiRequest(`/api/groups/${state.groupId}/lodging-properties?limit=10`);
            state.lodgingProperties = (response.data || []).filter((item) => item?.name);
        } catch (err) {
            state.lodgingProperties = [];
            console.warn('Failed to load lodging properties:', err.message);
        } finally {
            renderLodgingPropertyOptions();
        }
    };

    const loadLodgingCountries = async () => {
        try {
            const response = await apiRequest('/api/locations/countries');
            const countries = (response.data || [])
                .map((item) => ({ code: item?.code, name: item?.name }))
                .filter((item) => item.code && item.name);
            if (countries.length) {
                state.lodgingCountries = countries;
            } else {
                state.lodgingCountries = lodgingCountries.map((name) => ({
                    code: fallbackCountryCodes[name] || name,
                    name
                }));
            }
        } catch (err) {
            state.lodgingCountries = lodgingCountries.map((name) => ({
                code: fallbackCountryCodes[name] || name,
                name
            }));
            console.warn('Failed to load lodging countries:', err.message);
        } finally {
            renderLodgingCountryOptions();
        }
    };

    const loadLodgingLocations = async (country, cityQuery = '') => {
        if (!state.groupId || !country) {
            state.lodgingLocations = { cities: [], states: [] };
            renderLodgingLocationOptions();
            return;
        }
        const countryName = resolveCountryName(country);
        const fallback = lodgingFallbackLocations[countryName] || { cities: [], states: [] };
        try {
            const queryParam = cityQuery ? `&query=${encodeURIComponent(cityQuery)}` : '';
            const [historyResponse, countriesCitiesResponse, countriesStatesResponse] = await Promise.all([
                apiRequest(`/api/groups/${state.groupId}/lodging-locations?country=${encodeURIComponent(countryName)}&limit=10`),
                apiRequest(`/api/locations/cities?country=${encodeURIComponent(country)}&limit=200${queryParam}`),
                apiRequest(`/api/locations/states?country=${encodeURIComponent(country)}`)
            ]);
            let cities = historyResponse.data?.cities || [];
            const states = historyResponse.data?.states || [];
            const officialCities = (countriesCitiesResponse.data || []).map((item) => item?.name).filter(Boolean);
            const officialStates = (countriesStatesResponse.data || []).map((item) => item?.name).filter(Boolean);
            if (cityQuery) {
                const query = cityQuery.toLowerCase();
                cities = cities.filter((item) => item?.name?.toLowerCase().includes(query));
            }
            state.lodgingLocations = {
                cities: mergeLocationSuggestions(cities, [...officialCities, ...(fallback.cities || [])], 10),
                states: mergeLocationSuggestions(states, [...officialStates, ...(fallback.states || [])], 10)
            };
        } catch (err) {
            state.lodgingLocations = {
                cities: mergeLocationSuggestions([], fallback.cities || [], 10),
                states: mergeLocationSuggestions([], fallback.states || [], 10)
            };
            console.warn('Failed to load lodging locations:', err.message);
        } finally {
            renderLodgingLocationOptions();
        }
    };

    const setupLodgingPlatformAutocomplete = () => {
        const input = document.getElementById('lodgingPlatform');
        if (!input) return;
        const handler = () => syncLodgingPlatformIdFromInput();
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    };

    const setupLodgingLocationAutocomplete = () => {
        const select = document.getElementById('lodgingCountry');
        const cityInput = document.getElementById('lodgingCity');
        const stateInput = document.getElementById('lodgingState');
        if (!select) return;
        let searchTimeout = null;
        select.addEventListener('change', () => {
            const state = document.getElementById('lodgingState');
            if (cityInput) cityInput.value = '';
            if (state) state.value = '';
            loadLodgingLocations(select.value.trim());
            applyPostalPattern(select.value.trim(), state?.value);
        });
        if (cityInput) {
            cityInput.addEventListener('input', () => {
                const countryCode = select.value.trim();
                if (!countryCode) return;
                const query = cityInput.value.trim();
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }
                searchTimeout = setTimeout(() => {
                    loadLodgingLocations(countryCode, query);
                }, 200);
            });
        }
        if (stateInput) {
            stateInput.addEventListener('input', () => {
                applyPostalPattern(select.value.trim(), stateInput.value);
            });
        }
    };

    const buildAirportDisplayValue = (airport) => {
        const label = airport.city || airport.name || airport.code;
        if (airport.code && label && label !== airport.code) {
            return `${label} (${airport.code})`;
        }
        return airport.code || label || '';
    };

    const renderAirportOptions = (listId, airports) => {
        const list = document.getElementById(listId);
        if (!list) return;
        list.innerHTML = '';
        airports.forEach((airport) => {
            const option = document.createElement('option');
            option.value = buildAirportDisplayValue(airport);
            option.dataset.id = String(airport.id);
            list.appendChild(option);
        });
    };

    const syncAirportIdFromInput = (inputId, hiddenId, airports) => {
        const input = document.getElementById(inputId);
        const hidden = document.getElementById(hiddenId);
        if (!input || !hidden) return;
        const valueRaw = input.value.trim();
        const value = valueRaw.toUpperCase();
        if (!value) {
            hidden.value = '';
            return;
        }
        const match = (airports || []).find((airport) => {
            const code = airport.code.toUpperCase();
            const display = buildAirportDisplayValue(airport).toUpperCase();
            return code === value || display === value;
        });
        hidden.value = match ? match.id : '';
    };

    const loadAirportSuggestions = async (query, targetKey, inputId, listId, hiddenId) => {
        try {
            const response = await apiRequest(`/api/airports?query=${encodeURIComponent(query)}`);
            state.airports[targetKey] = response.data || [];
            renderAirportOptions(listId, state.airports[targetKey]);
            syncAirportIdFromInput(inputId, hiddenId, state.airports[targetKey]);
        } catch (err) {
            console.warn('Failed to load airports:', err.message);
        }
    };

    const setupFlightAirportAutocomplete = () => {
        const configs = [
            { inputId: 'flightFrom', listId: 'flightFromList', hiddenId: 'flightFromAirportId', key: 'from' },
            { inputId: 'flightTo', listId: 'flightToList', hiddenId: 'flightToAirportId', key: 'to' }
        ];
        configs.forEach((config) => {
            const input = document.getElementById(config.inputId);
            if (!input) return;
            let timer = null;
            const handler = () => {
                syncAirportIdFromInput(config.inputId, config.hiddenId, state.airports[config.key]);
                const query = input.value.trim();
                if (query.length < 2) return;
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    loadAirportSuggestions(query, config.key, config.inputId, config.listId, config.hiddenId);
                }, 200);
            };
            input.addEventListener('input', handler);
            input.addEventListener('change', handler);
        });
    };

    const formatFlightClassLabel = (value) => {
        if (!value) return '-';
        return value
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    };

    const formatStatusBadge = (status) => {
        const s = (status || 'planned').toLowerCase();
        const colorMap = { planned: 'primary', paid: 'success', due: 'warning' };
        const color = colorMap[s] || 'secondary';
        return `<span class="badge bg-soft-${color} text-${color} text-capitalize">${s}</span>`;
    };

    const parseGroupId = () => {
        const params = new URLSearchParams(window.location.search);
        const id = Number(params.get('groupId'));
        return Number.isInteger(id) && id > 0 ? id : null;
    };

    const sectionIds = [
        'dashboard',
        'summaryCards',
        'balances',
        'debts',
        'quickLinks',
        'participants',
        'members',
        'expenses',
        'flights',
        'lodgings',
        'transports',
        'tickets'
    ];

    const sectionGroups = {
        dashboard: ['dashboard', 'summaryCards', 'balances', 'debts', 'quickLinks'],
        balances: ['balances'],
        debts: ['debts'],
        participants: ['participants'],
        members: ['members'],
        expenses: ['expenses'],
        flights: ['flights'],
        lodgings: ['lodgings'],
        transports: ['transports'],
        tickets: ['tickets']
    };

    const applySectionVisibility = () => {
        const hash = window.location.hash || '#dashboard';
        const key = hash.startsWith('#') ? hash.slice(1).toLowerCase() : hash.toLowerCase();
        const visible = sectionGroups[key] || sectionGroups.dashboard;

        sectionIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle('d-none', !visible.includes(id));
        });

        const titleEl = document.getElementById('pageTitle');
        const breadcrumbEl = document.getElementById('breadcrumbActive');
        if (titleEl && breadcrumbEl) {
            const labels = {
                dashboard: 'Management',
                balances: 'Balances',
                debts: 'Who owes',
                participants: 'Participants',
                members: 'Members',
                expenses: 'Expenses',
                flights: 'Flights',
                lodgings: 'Lodgings',
                transports: 'Transports',
                tickets: 'Tickets'
            };
            const label = labels[key] || 'Management';
            titleEl.textContent = label;
            breadcrumbEl.textContent = label;
            // Keep the section title visible by returning to the top of the page content.
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Let the browser handle anchor scrolling to avoid double scroll jumps.
    };

    const bindSectionVisibility = () => {
        applySectionVisibility();
        window.addEventListener('hashchange', applySectionVisibility);
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

    const getCurrentBasePath = () => {
        const path = window.location.pathname || '/dashboard';
        return path === '/' ? '/dashboard' : path;
    };

    const updateGroupScopedLinks = () => {
        if (!state.groupId) return;
        const updateLinks = (selector) => {
            document.querySelectorAll(selector).forEach((link) => {
                const href = link.getAttribute('href');
                if (!href) return;
                const url = new URL(href, window.location.origin);
                url.searchParams.set('groupId', state.groupId);
                link.setAttribute('href', `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
            });
        };
        updateLinks('a[href^=\"/group-details\"]');
        updateLinks('a[href^=\"/dashboard\"]');
    };

    const setUserProfile = async () => {
        try {
            const me = await apiRequest('/api/me');
            const email = me.email || 'Account';

            // Determine display name with fallback logic
            let displayName = me.display_name || me.displayName;
            if (!displayName && (me.first_name || me.firstName || me.last_name || me.lastName)) {
                const firstName = me.first_name || me.firstName || '';
                const lastName = me.last_name || me.lastName || '';
                displayName = `${firstName} ${lastName}`.trim();
            }
            if (!displayName) {
                displayName = email.split('@')[0];
            }

            // Set display name in header button
            const userDisplayName = document.getElementById('userDisplayName');
            if (userDisplayName) userDisplayName.textContent = displayName;

            // Set both name and email in dropdown header
            const dropdownUserName = document.getElementById('dropdownUserName');
            if (dropdownUserName) dropdownUserName.textContent = displayName;

            const dropdownUserEmail = document.getElementById('dropdownUserEmail');
            if (dropdownUserEmail) dropdownUserEmail.textContent = email;

            // Set avatar if available
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
        const requestedId = state.groupId || parseGroupId();
        if (!requestedId) {
            window.location.href = '/groups';
            return false;
        }
        state.groupId = requestedId;
        state.group = state.groups.find((group) => group.id === requestedId) || null;
        if (!state.group) {
            window.location.href = '/groups';
            return false;
        }
        state.canManage = state.group.role === 'owner';
        state.canEdit = state.canManage || state.group.role === 'member';
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
        const [families, participants, members, expenses, flights, lodgings, transports, tickets, summary] = await Promise.all([
            apiRequest(`/api/groups/${state.groupId}/families`),
            apiRequest(`/api/groups/${state.groupId}/participants`),
            apiRequest(`/api/groups/${state.groupId}/members`),
            apiRequest(`/api/groups/${state.groupId}/expenses`),
            apiRequest(`/api/groups/${state.groupId}/flights`),
            apiRequest(`/api/groups/${state.groupId}/lodgings`),
            apiRequest(`/api/groups/${state.groupId}/transports`),
            apiRequest(`/api/groups/${state.groupId}/tickets`),
            apiRequest(`/api/groups/${state.groupId}/summary`)
        ]);
        state.families = families.data || [];
        state.participants = participants.data || [];
        state.members = members.data || [];
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
        const familyBalanceMode = document.getElementById('familyBalanceMode');

        if (groupName) groupName.textContent = state.group.name;
        if (groupCurrency) groupCurrency.textContent = state.group.defaultCurrency;
        if (roleBadge) {
            const roleLabel = state.group.role === 'admin' ? 'member' : state.group.role;
            roleBadge.textContent = roleLabel;
            roleBadge.classList.remove('bg-soft-primary', 'text-primary', 'bg-soft-success', 'text-success');
            if (state.group.role === 'owner') {
                roleBadge.classList.add('bg-soft-success', 'text-success');
            } else {
                roleBadge.classList.add('bg-soft-primary', 'text-primary');
            }
        }

        if (selector) {
            selector.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select a group';
            selector.appendChild(placeholder);
            state.groups.forEach((group) => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = `${group.name} (${group.defaultCurrency})`;
                if (group.id === state.groupId) option.selected = true;
                selector.appendChild(option);
            });
        }
        if (familyBalanceMode) {
            familyBalanceMode.value = state.group?.familyBalanceMode || 'participants';
            familyBalanceMode.disabled = !state.canManage;
        }
        updateGroupScopedLinks();
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
            list.innerHTML = `
                <li class="list-group-item text-center py-4">
                    <div class="text-muted mb-3">No families yet. Create your first family to group participants together.</div>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('familyName').focus()">
                        <i class="mdi mdi-plus me-1"></i>Create first family
                    </button>
                </li>`;
            return;
        }

        state.families.forEach((family) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex align-items-center justify-content-between';
            li.innerHTML = `
                <span>${family.name}</span>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-primary" data-action="edit-family" data-id="${family.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-family" data-id="${family.id}">Delete</button>
                </div>
            `;
            if (!state.canEdit) {
                li.querySelectorAll('button').forEach((button) => {
                    button.disabled = true;
                });
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
            list.innerHTML = `
                <tr><td colspan="4" class="text-center py-4">
                    <div class="text-muted mb-3">No participants yet. Add people who will join this trip.</div>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('participantName').focus()">
                        <i class="mdi mdi-plus me-1"></i>Add first participant
                    </button>
                </td></tr>`;
            return;
        }
        const familyMap = new Map(state.families.map((family) => [family.id, family.name]));
        const sortedParticipants = applySorting(state.participants, 'participants');
        sortedParticipants.forEach((participant) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Name">${participant.displayName}</td>
                <td data-label="Family">${participant.familyId ? familyMap.get(participant.familyId) || '-' : '-'}</td>
                <td data-label="Type" class="text-capitalize">${participant.type || '-'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-participant" data-id="${participant.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-participant" data-id="${participant.id}">Delete</button>
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

    const renderExpenses = () => {
        const list = document.getElementById('expenseList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.expenses.length) {
            list.innerHTML = `
                <tr><td colspan="6" class="text-center py-4">
                    <div class="text-muted mb-3">No expenses yet. Start tracking shared costs for this trip.</div>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('openExpenseModal')?.click()">
                        <i class="mdi mdi-plus me-1"></i>Add first expense
                    </button>
                </td></tr>`;
            return;
        }
        const participantMap = new Map(state.participants.map((p) => [p.id, p.displayName]));
        const sortedExpenses = applySorting(state.expenses, 'expenses');
        sortedExpenses.forEach((expense) => {
            const rawSplitType = expense.splits && expense.splits.length ? expense.splits[0].targetType : '-';
            const splitType = rawSplitType === 'participant' ? 'participants'
                : rawSplitType === 'family'
                    ? 'families'
                    : rawSplitType;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Description">${expense.description}</td>
                <td data-label="Amount">${formatCurrency(expense.amount, expense.currency)}</td>
                <td data-label="Date">${expense.date}</td>
                <td data-label="Paid by">${participantMap.get(expense.payerParticipantId) || '-'}</td>
                <td data-label="Split" class="text-capitalize">${splitType}</td>
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
            list.innerHTML = `
                <tr><td colspan="8" class="text-center py-4">
                    <div class="text-muted mb-3">No flights yet. Add your flight bookings to keep track of travel plans.</div>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('openFlightModal')?.click()">
                        <i class="mdi mdi-plane me-1"></i>Add first flight
                    </button>
                </td></tr>`;
            return;
        }
        const filters = state.filters.flights;
        const filtered = state.flights.filter((flight) => {
            if (filters.airline && !flight.airline?.toLowerCase().includes(filters.airline.toLowerCase())) return false;
            if (filters.from) {
                const fromMatch = flight.fromLabel?.toLowerCase().includes(filters.from.toLowerCase()) ||
                    flight.from?.toLowerCase().includes(filters.from.toLowerCase());
                if (!fromMatch) return false;
            }
            if (filters.to) {
                const toMatch = flight.toLabel?.toLowerCase().includes(filters.to.toLowerCase()) ||
                    flight.to?.toLowerCase().includes(filters.to.toLowerCase());
                if (!toMatch) return false;
            }
            if (filters.status && flight.status !== filters.status) return false;
            return true;
        });
        if (!filtered.length) {
            const message = state.flights.length ? 'No flights match the filters.' : 'No flights yet.';
            list.innerHTML = `<tr><td colspan="8" class="text-muted text-center">${message}</td></tr>`;
            return;
        }
        const participantMap = new Map(state.participants.map((participant) => [participant.id, participant.displayName]));
        const sorted = applySorting(filtered, 'flights');
        sorted.forEach((flight) => {
            const participantNames = (flight.participantIds || [])
                .map((id) => participantMap.get(id))
                .filter(Boolean);
            const passengersLabel = participantNames.length ? participantNames.join(', ') : '-';
            const passengerCount = participantNames.length;
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
            const passengerRows = (flight.participantIds || [])
                .map((id) => {
                    const name = participantMap.get(id);
                    if (!name) return null;
                    const seat = flight.participantSeats?.[id] || '-';
                    const baggage = flight.participantBaggage?.[id] || '-';
                    return `<tr><td>${name}</td><td>${seat}</td><td>${baggage}</td></tr>`;
                })
                .filter(Boolean)
                .join('');
            const passengerTable = passengerRows
                ? `<div class="table-responsive mb-0"><table class="table table-sm table-nowrap align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Passenger</th>
                                <th>Seat</th>
                                <th>Baggage</th>
                            </tr>
                        </thead>
                        <tbody>${passengerRows}</tbody>
                    </table></div>`
                : '<span class="text-muted">No passengers selected.</span>';
            const flightLabel = [flight.airline, flight.flightNumber].filter(Boolean).join(' ');
            const routeLabel = `${flight.fromLabel || flight.from || '-'} → ${flight.toLabel || flight.to || '-'}`;
            const expenseBadge = flight.expenseId ? '<span class="badge bg-success ms-1" title="Linked expense">$</span>' : '';
            const detailsId = `flight-details-${flight.id}`;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Flight">${flightLabel || '-'}${expenseBadge}</td>
                <td data-label="Route">${routeLabel}</td>
                <td data-label="Departure">${formatDateTime(flight.departAt)}</td>
                <td data-label="Arrival">${formatDateTime(flight.arriveAt)}</td>
                <td data-label="Pax">${passengerCount}</td>
                <td data-label="Status" class="text-capitalize">${flight.status || 'planned'}</td>
                <td data-label="Cost">${formatCurrency(flight.cost, flight.currency)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary me-1" data-action="toggle-flight-details" data-id="${flight.id}" aria-controls="${detailsId}">Details</button>
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-flight" data-id="${flight.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-flight" data-id="${flight.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelectorAll('button[data-action="edit-flight"], button[data-action="delete-flight"]').forEach((button) => {
                    button.disabled = true;
                });
            }
            list.appendChild(tr);
            const detailsRow = document.createElement('tr');
            detailsRow.id = detailsId;
            detailsRow.className = 'd-none';
            detailsRow.innerHTML = `
                <td colspan="8">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <div class="text-muted small">PNR</div>
                            <div>${flight.pnr || '-'}</div>
                        </div>
                        <div class="col-md-3">
                            <div class="text-muted small">Class</div>
                            <div>${formatFlightClassLabel(flight.cabinClass)}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="text-muted small">Passengers</div>
                            ${passengerTable}
                        </div>
                    </div>
                </td>
            `;
            list.appendChild(detailsRow);
        });
    };

    const openLodgingDetailsModal = (lodgingId) => {
        const lodging = state.lodgings.find((l) => l.id === lodgingId);
        if (!lodging) return;

        const content = document.getElementById('lodgingDetailsContent');
        if (!content) return;

        const location = [lodging.city, lodging.state, lodging.country].filter(Boolean).join(', ');
        const checkIn = `${formatDate(lodging.checkIn)} ${lodging.checkInTime || ''}`.trim();
        const checkOut = `${formatDate(lodging.checkOut)} ${lodging.checkOutTime || ''}`.trim();
        const rooms = lodging.roomType
            ? `${lodging.roomQuantity || 1} × ${lodging.roomType} (${lodging.roomOccupancy || 0} guests)`
            : 'Not specified';
        const contactParts = [lodging.contact, lodging.contactPhone, lodging.contactEmail].filter(Boolean);
        const contact = contactParts.length ? contactParts.join(' • ') : 'Not specified';
        const addressParts = [lodging.address, lodging.postalCode, lodging.city, lodging.state, lodging.country].filter(Boolean);
        const fullAddress = addressParts.join(', ') || 'Not specified';
        const expenseInfo = lodging.expenseId
            ? '<span class="badge bg-success">Linked to expense</span>'
            : '<span class="text-muted">No linked expense</span>';

        content.innerHTML = `
            <div class="col-12">
                <h6 class="text-uppercase text-muted mb-2">Property Information</h6>
                <div class="mb-2"><strong>Name:</strong> ${lodging.name || 'Not specified'}</div>
                <div class="mb-2"><strong>Status:</strong> ${formatStatusBadge(lodging.status)}</div>
            </div>
            <div class="col-12"><hr></div>
            <div class="col-12">
                <h6 class="text-uppercase text-muted mb-2">Location</h6>
                <div class="mb-2"><strong>Address:</strong> ${fullAddress}</div>
                <div class="mb-2"><strong>Summary:</strong> ${location || 'Not specified'}</div>
            </div>
            <div class="col-12"><hr></div>
            <div class="col-12">
                <h6 class="text-uppercase text-muted mb-2">Dates</h6>
                <div class="mb-2"><strong>Check-in:</strong> ${checkIn}</div>
                <div class="mb-2"><strong>Check-out:</strong> ${checkOut}</div>
            </div>
            <div class="col-12"><hr></div>
            <div class="col-12">
                <h6 class="text-uppercase text-muted mb-2">Rooms & Cost</h6>
                <div class="mb-2"><strong>Rooms:</strong> ${rooms}</div>
                <div class="mb-2"><strong>Cost:</strong> ${formatCurrency(lodging.cost, lodging.currency)}</div>
                <div class="mb-2"><strong>Expense:</strong> ${expenseInfo}</div>
            </div>
            <div class="col-12"><hr></div>
            <div class="col-12">
                <h6 class="text-uppercase text-muted mb-2">Contact</h6>
                <div class="mb-2">${contact}</div>
            </div>
            ${lodging.notes ? `
            <div class="col-12"><hr></div>
            <div class="col-12">
                <h6 class="text-uppercase text-muted mb-2">Notes</h6>
                <div>${lodging.notes}</div>
            </div>
            ` : ''}
        `;

        // Set up action buttons
        const editBtn = document.getElementById('lodgingDetailsEdit');
        const deleteBtn = document.getElementById('lodgingDetailsDelete');

        if (editBtn) {
            editBtn.onclick = () => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('lodgingDetailsModal'));
                modal?.hide();
                document.querySelector('[data-action="edit-lodging"][data-id="' + lodgingId + '"]')?.click();
            };
            editBtn.disabled = !state.canEdit;
        }

        if (deleteBtn) {
            deleteBtn.onclick = () => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('lodgingDetailsModal'));
                modal?.hide();
                document.querySelector('[data-action="delete-lodging"][data-id="' + lodgingId + '"]')?.click();
            };
            deleteBtn.disabled = !state.canEdit;
        }

        // Open modal
        const modal = new bootstrap.Modal(document.getElementById('lodgingDetailsModal'));
        modal.show();
    };

    const renderLodgings = () => {
        const list = document.getElementById('lodgingList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.lodgings.length) {
            list.innerHTML = `
                <tr><td colspan="8" class="text-center py-4">
                    <div class="text-muted mb-3">No lodgings yet. Add hotels, rentals, or accommodations for your trip.</div>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('openLodgingModal')?.click()">
                        <i class="mdi mdi-home me-1"></i>Add first lodging
                    </button>
                </td></tr>`;
            return;
        }
        const filters = state.filters.lodgings;
        const filtered = state.lodgings.filter((lodging) => {
            if (filters.city && !lodging.city?.toLowerCase().includes(filters.city.toLowerCase())) return false;
            if (filters.status && lodging.status !== filters.status) return false;
            return true;
        });
        if (!filtered.length) {
            const message = state.lodgings.length ? 'No lodgings match the filters.' : 'No lodgings yet.';
            list.innerHTML = `<tr><td colspan="8" class="text-muted text-center">${message}</td></tr>`;
            return;
        }
        const sorted = applySorting(filtered, 'lodgings');
        sorted.forEach((lodging) => {
            const location = [lodging.city, lodging.state, lodging.country].filter(Boolean).join(', ');
            const checkIn = `${formatDate(lodging.checkIn)} ${lodging.checkInTime || ''}`.trim();
            const checkOut = `${formatDate(lodging.checkOut)} ${lodging.checkOutTime || ''}`.trim();
            const rooms = lodging.roomType
                ? `${lodging.roomQuantity || 1} × ${lodging.roomType} (${lodging.roomOccupancy || 0} guests)`
                : '-';
            const contactParts = [lodging.contact, lodging.contactPhone, lodging.contactEmail].filter(Boolean);
            const contact = contactParts.length ? contactParts.join(' · ') : '-';
            const detailsId = `lodging-details-${lodging.id}`;
            const addressParts = [lodging.address, lodging.postalCode, lodging.city, lodging.state, lodging.country].filter(Boolean);
            const addressLabel = addressParts.join(', ') || '-';
            const expenseBadge = lodging.expenseId ? '<span class="badge bg-success ms-1" title="Linked expense">$</span>' : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Property">${lodging.name || '-'}${expenseBadge}</td>
                <td data-label="Location">${location || '-'}</td>
                <td data-label="Dates">${checkIn} → ${checkOut}</td>
                <td data-label="Rooms">${rooms}</td>
                <td data-label="Status">${formatStatusBadge(lodging.status)}</td>
                <td data-label="Cost">${formatCurrency(lodging.cost, lodging.currency)}</td>
                <td data-label="Contact">${contact}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary me-1" data-action="toggle-lodging-details" data-id="${lodging.id}" aria-controls="${detailsId}">Details</button>
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-lodging" data-id="${lodging.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-lodging" data-id="${lodging.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelectorAll('button[data-action="edit-lodging"], button[data-action="delete-lodging"]').forEach((button) => {
                    button.disabled = true;
                });
            }
            list.appendChild(tr);
            // Only add inline details row on desktop (mobile uses modal instead)
            const isMobile = window.matchMedia('(max-width: 767px)').matches;
            if (!isMobile) {
                const detailsRow = document.createElement('tr');
                detailsRow.id = detailsId;
                detailsRow.className = 'd-none';
                detailsRow.innerHTML = `
                    <td colspan="8">
                        <div class="row g-3">
                            <div class="col-md-4">
                                <div class="text-muted small">Full address</div>
                                <div>${addressLabel}</div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-muted small">Check-in / Check-out</div>
                                <div>${checkIn} → ${checkOut}</div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-muted small">Contact</div>
                                <div>${contact}</div>
                            </div>
                            ${lodging.notes ? `<div class="col-12"><div class="text-muted small">Notes</div><div>${lodging.notes}</div></div>` : ''}
                        </div>
                    </td>
                `;
                list.appendChild(detailsRow);
            }
        });
    };

    const renderTransports = () => {
        const list = document.getElementById('transportList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.transports.length) {
            list.innerHTML = `
                <tr><td colspan="8" class="text-center py-4">
                    <div class="text-muted mb-3">No transports yet. Track car rentals, transfers, and local transportation.</div>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('openTransportModal')?.click()">
                        <i class="mdi mdi-car me-1"></i>Add first transport
                    </button>
                </td></tr>`;
            return;
        }
        const filters = state.filters.transports;
        const filtered = state.transports.filter((transport) => {
            if (filters.status && transport.status !== filters.status) return false;
            if (filters.provider && !transport.provider?.toLowerCase().includes(filters.provider.toLowerCase())) return false;
            return true;
        });
        if (!filtered.length) {
            const message = state.transports.length ? 'No transports match the filters.' : 'No transports yet.';
            list.innerHTML = `<tr><td colspan="8" class="text-muted text-center">${message}</td></tr>`;
            return;
        }
        const sorted = applySorting(filtered, 'transports');
        sorted.forEach((transport) => {
            const route = `${transport.origin || '-'} → ${transport.destination || '-'}`;
            const provider = transport.provider || '-';
            const locator = transport.locator || '-';
            const providerLine = [provider, locator].filter((value) => value && value !== '-').join(' · ') || '-';
            const expenseBadge = transport.expenseId ? '<span class="badge bg-success ms-1" title="Linked expense">$</span>' : '';
            const detailsId = `transport-details-${transport.id}`;
            const hasDetails = transport.notes || (provider !== '-') || (locator !== '-');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Type">${transport.type || '-'}${expenseBadge}</td>
                <td data-label="Route"><strong>${route}</strong></td>
                <td data-label="Departure">${formatDateTime(transport.departAt)}</td>
                <td data-label="Arrival">${formatDateTime(transport.arriveAt)}</td>
                <td data-label="Status">${formatStatusBadge(transport.status)}</td>
                <td data-label="Amount">${formatCurrency(transport.amount, transport.currency)}</td>
                <td data-label="Provider">${providerLine}</td>
                <td class="text-end">
                    ${hasDetails ? `<button class="btn btn-sm btn-outline-secondary me-1" data-action="toggle-transport-details" data-id="${transport.id}" aria-controls="${detailsId}">Details</button>` : ''}
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-transport" data-id="${transport.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-transport" data-id="${transport.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelectorAll('button[data-action="edit-transport"], button[data-action="delete-transport"]').forEach((button) => {
                    button.disabled = true;
                });
            }
            list.appendChild(tr);
            if (hasDetails) {
                const detailsRow = document.createElement('tr');
                detailsRow.id = detailsId;
                detailsRow.className = 'd-none';
                detailsRow.innerHTML = `
                    <td colspan="8">
                        <div class="row g-3">
                            <div class="col-md-4">
                                <div class="text-muted small">Origin → Destination</div>
                                <div><strong>${transport.origin || '-'}</strong> → <strong>${transport.destination || '-'}</strong></div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-muted small">Departure / Arrival</div>
                                <div>${formatDateTime(transport.departAt)} → ${formatDateTime(transport.arriveAt)}</div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-muted small">Provider / Locator</div>
                                <div>${providerLine}</div>
                            </div>
                            ${transport.notes ? `<div class="col-12"><div class="text-muted small">Notes</div><div>${transport.notes}</div></div>` : ''}
                        </div>
                    </td>
                `;
                list.appendChild(detailsRow);
            }
        });
    };

    const renderTickets = () => {
        const list = document.getElementById('ticketList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.tickets.length) {
            list.innerHTML = `
                <tr><td colspan="7" class="text-center py-4">
                    <div class="text-muted mb-3">No tickets yet. Add tickets for theme parks, events, museums, and attractions.</div>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('openTicketModal')?.click()">
                        <i class="mdi mdi-ticket me-1"></i>Add first ticket
                    </button>
                </td></tr>`;
            return;
        }
        const filters = state.filters.tickets;
        const filtered = state.tickets.filter((ticket) => {
            if (filters.type && !ticket.type?.toLowerCase().includes(filters.type.toLowerCase())) return false;
            if (filters.status && ticket.status !== filters.status) return false;
            if (filters.dateFrom || filters.dateTo) {
                const eventDate = ticket.eventAt ? ticket.eventAt.split('T')[0] : '';
                if (filters.dateFrom && eventDate < filters.dateFrom) return false;
                if (filters.dateTo && eventDate > filters.dateTo) return false;
            }
            return true;
        });
        if (!filtered.length) {
            const message = state.tickets.length ? 'No tickets match the filters.' : 'No tickets yet.';
            list.innerHTML = `<tr><td colspan="7" class="text-muted text-center">${message}</td></tr>`;
            return;
        }
        const participantMap = new Map(state.participants.map((participant) => [participant.id, participant.displayName]));
        const sorted = applySorting(filtered, 'tickets');
        sorted.forEach((ticket) => {
            const participantNames = (ticket.participantIds || [])
                .map((id) => participantMap.get(id))
                .filter(Boolean);
            const participantBadges = participantNames.length
                ? participantNames.map((name) => `<span class="badge bg-soft-primary text-primary me-1">${name}</span>`).join('')
                : '<span class="text-muted">-</span>';
            const expenseBadge = ticket.expenseId ? '<span class="badge bg-success ms-1" title="Linked expense">$</span>' : '';
            const detailsId = `ticket-details-${ticket.id}`;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Type">${ticket.type || '-'}${expenseBadge}</td>
                <td data-label="When">${formatDateTime(ticket.eventAt)}</td>
                <td data-label="Location">${ticket.location || '-'}</td>
                <td data-label="Status">${formatStatusBadge(ticket.status)}</td>
                <td data-label="Amount">${formatCurrency(ticket.amount, ticket.currency)}</td>
                <td data-label="Participants">${participantBadges}</td>
                <td class="text-end">
                    ${ticket.notes ? `<button class="btn btn-sm btn-outline-secondary me-1" data-action="toggle-ticket-details" data-id="${ticket.id}" aria-controls="${detailsId}">Details</button>` : ''}
                    <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-ticket" data-id="${ticket.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-ticket" data-id="${ticket.id}">Delete</button>
                </td>
            `;
            if (!state.canEdit) {
                tr.querySelectorAll('button[data-action="edit-ticket"], button[data-action="delete-ticket"]').forEach((button) => {
                    button.disabled = true;
                });
            }
            list.appendChild(tr);
            if (ticket.notes) {
                const detailsRow = document.createElement('tr');
                detailsRow.id = detailsId;
                detailsRow.className = 'd-none';
                detailsRow.innerHTML = `
                    <td colspan="7">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="text-muted small">Participants</div>
                                <div>${participantBadges}</div>
                            </div>
                            <div class="col-12">
                                <div class="text-muted small">Notes</div>
                                <div>${ticket.notes}</div>
                            </div>
                        </div>
                    </td>
                `;
                list.appendChild(detailsRow);
            }
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
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select a payer';
            payerSelect.appendChild(placeholder);
            getUniquePayerParticipants(state.participants).forEach((participant) => {
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
            getUniquePayerParticipants(state.participants).forEach((participant) => {
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

    const setupLodgingConditionalValidation = () => {
        const statusSelect = document.getElementById('lodgingStatus');
        const contactInput = document.getElementById('lodgingContact');
        const updateRequired = () => {
            const isPaid = statusSelect?.value === 'paid';
            if (contactInput) contactInput.required = isPaid;
        };
        statusSelect?.addEventListener('change', updateRequired);
        updateRequired();
    };

    const setupTicketConditionalValidation = () => {
        const typeInput = document.getElementById('ticketType');
        const locationInput = document.getElementById('ticketLocation');
        const updateRequired = () => {
            const typeValue = (typeInput?.value || '').toLowerCase();
            const isDigitalType = typeValue.includes('digital') ||
                                  typeValue.includes('virtual') ||
                                  typeValue.includes('online') ||
                                  typeValue.includes('email');
            if (locationInput) locationInput.required = !isDigitalType;
        };
        typeInput?.addEventListener('input', updateRequired);
        updateRequired();
    };

    const setupFlightParticipantSearch = () => {
        const search = document.getElementById('flightParticipantSearch');
        const select = document.getElementById('flightParticipants');
        if (!search || !select) return;
        search.addEventListener('input', applyFlightParticipantSearchFilter);
        select.addEventListener('change', () => {
            syncFlightSeatMapWithSelection();
            syncFlightBaggageMapWithSelection();
            renderFlightPassengerDetails();
        });
    };

    const renderMembers = () => {
        const list = document.getElementById('memberList');
        if (!list) return;
        list.innerHTML = '';
        if (!state.members.length) {
            list.innerHTML = '<tr><td colspan="3" class="text-muted text-center">No members yet.</td></tr>';
            return;
        }
        state.members.forEach((member) => {
            const displayName = member.displayName
                || [member.firstName, member.lastName].filter(Boolean).join(' ')
                || member.email
                || 'Member';
            const roleValue = member.role === 'admin' ? 'member' : member.role;
            const isOwner = roleValue === 'owner';
            const canUpdate = state.canManage && !isOwner;
            const tr = document.createElement('tr');
            const roleCell = isOwner
                ? '<span class="badge bg-soft-success text-success text-uppercase">Owner</span>'
                : `
                    <select class="form-select form-select-sm" data-member-role="${member.userId}">
                        <option value="member"${roleValue === 'member' ? ' selected' : ''}>Member</option>
                        <option value="viewer"${roleValue === 'viewer' ? ' selected' : ''}>Viewer</option>
                    </select>
                `;
            const removeBtn = !isOwner && state.canManage
                ? `<button class="btn btn-sm btn-outline-danger ms-1" data-action="remove-member" data-id="${member.userId}" data-name="${displayName}">
                        <i class="bx bx-trash-alt"></i>
                    </button>`
                : '';
            tr.innerHTML = `
                <td>
                    <div class="fw-semibold">${displayName}</div>
                    <div class="text-muted small">${member.email || ''}</div>
                </td>
                <td>${roleCell}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" data-action="save-member-role" data-id="${member.userId}">
                        Update
                    </button>
                    ${removeBtn}
                </td>
            `;
            if (!canUpdate) {
                tr.querySelectorAll('select, button').forEach((el) => {
                    el.disabled = true;
                });
            }
            list.appendChild(tr);
        });
    };

    const setupFlightDateConstraints = () => {
        const depart = document.getElementById('flightDepart');
        const arrive = document.getElementById('flightArrive');
        if (!depart || !arrive) return;
        const clearAutofill = () => {
            delete arrive.dataset.autofilled;
        };
        const sync = () => {
            if (depart.value) {
                arrive.min = depart.value;
                arrive.value = depart.value;
                arrive.dataset.autofilled = '1';
            } else {
                arrive.removeAttribute('min');
            }
        };
        depart.addEventListener('change', sync);
        depart.addEventListener('input', sync);
        arrive.addEventListener('change', clearAutofill);
        arrive.addEventListener('input', clearAutofill);
        sync();
    };

    const setupTransportDateConstraints = () => {
        const depart = document.getElementById('transportDepart');
        const arrive = document.getElementById('transportArrive');
        if (!depart || !arrive) return;
        const clearAutofill = () => {
            delete arrive.dataset.autofilled;
        };
        const sync = () => {
            if (depart.value) {
                arrive.min = depart.value;
                const arriveValue = arrive.value;
                const shouldAutofill = !arriveValue || arrive.dataset.autofilled === '1';
                if (shouldAutofill) {
                    arrive.value = depart.value;
                    arrive.dataset.autofilled = '1';
                } else if (arriveValue < depart.value) {
                    arrive.value = depart.value;
                    arrive.dataset.autofilled = '1';
                }
            } else {
                arrive.removeAttribute('min');
            }
        };
        depart.addEventListener('change', sync);
        depart.addEventListener('input', sync);
        arrive.addEventListener('change', clearAutofill);
        arrive.addEventListener('input', clearAutofill);
        sync();
    };

    const setupTransportConditionalValidation = () => {
        const statusSelect = document.getElementById('transportStatus');
        const providerInput = document.getElementById('transportProvider');
        const locatorInput = document.getElementById('transportLocator');
        const updateRequired = () => {
            const isPaid = statusSelect?.value === 'paid';
            if (providerInput) providerInput.required = isPaid;
            if (locatorInput) locatorInput.required = isPaid;
        };
        statusSelect?.addEventListener('change', updateRequired);
        updateRequired();
    };

    const setupLodgingDateConstraints = () => {
        const checkIn = document.getElementById('lodgingCheckIn');
        const checkOut = document.getElementById('lodgingCheckOut');
        if (!checkIn || !checkOut) return;
        const clearAutofill = () => {
            delete checkOut.dataset.autofilled;
        };
        const sync = () => {
            if (checkIn.value) {
                checkOut.min = checkIn.value;
                const checkOutValue = checkOut.value;
                const shouldAutofill = !checkOutValue || checkOut.dataset.autofilled === '1';
                if (shouldAutofill) {
                    checkOut.value = checkIn.value;
                    checkOut.dataset.autofilled = '1';
                } else if (checkOutValue < checkIn.value) {
                    checkOut.value = checkIn.value;
                    checkOut.dataset.autofilled = '1';
                }
            } else {
                checkOut.removeAttribute('min');
                clearAutofill();
            }
        };
        checkIn.addEventListener('change', sync);
        checkIn.addEventListener('input', sync);
        checkOut.addEventListener('change', clearAutofill);
        checkOut.addEventListener('input', clearAutofill);
        sync();
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
        renderFlightPassengerDetails();
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

    const renderFlightPassengerDetails = () => {
        const tbody = document.getElementById('flightPassengerDetails');
        if (!tbody) return;
        const selectedIds = getSelectedFlightParticipantIds();
        const nameMap = new Map(state.participants.map((participant) => [participant.id, participant.displayName]));
        if (!selectedIds.length) {
            tbody.innerHTML =
                '<tr><td colspan="3" class="text-muted">Select passengers to assign seats and baggage.</td></tr>';
            return;
        }
        const seatMap = state.editing.flightSeatMap || {};
        const baggageMap = state.editing.flightBaggageMap || {};
        tbody.innerHTML = '';
        selectedIds.forEach((participantId) => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            nameCell.textContent = nameMap.get(participantId) || `Participant ${participantId}`;

            const seatCell = document.createElement('td');
            const seatInput = document.createElement('input');
            seatInput.className = 'form-control form-control-sm';
            seatInput.placeholder = 'Seat';
            seatInput.value = seatMap[String(participantId)] || '';
            seatInput.dataset.participantId = String(participantId);
            seatInput.dataset.field = 'seat';
            seatInput.addEventListener('input', () => {
                state.editing.flightSeatMap[String(participantId)] = seatInput.value.trim();
            });
            seatCell.appendChild(seatInput);

            const baggageCell = document.createElement('td');
            const baggageInput = document.createElement('input');
            baggageInput.className = 'form-control form-control-sm';
            baggageInput.placeholder = 'Baggage';
            baggageInput.value = baggageMap[String(participantId)] || '';
            baggageInput.dataset.participantId = String(participantId);
            baggageInput.dataset.field = 'baggage';
            baggageInput.addEventListener('input', () => {
                state.editing.flightBaggageMap[String(participantId)] = baggageInput.value.trim();
            });
            baggageCell.appendChild(baggageInput);

            row.appendChild(nameCell);
            row.appendChild(seatCell);
            row.appendChild(baggageCell);
            tbody.appendChild(row);
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

    const collectLinkedExpenseSplitData = (amountValue, payerSelectorId) => {
        if (!state.participants.length && !state.families.length) {
            throw new Error('Add participants or families before linking an expense.');
        }
        const payerEl = document.getElementById(payerSelectorId || 'expensePayer');
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
        const splitData = collectLinkedExpenseSplitData(amountValue, config.payerId);
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
        const editForms = [
            'familyForm',
            'participantForm',
            'expenseForm',
            'flightForm',
            'lodgingForm',
            'transportForm',
            'ticketForm'
        ];
        const manageForms = ['inviteForm'];
        editForms.forEach((id) => {
            const form = document.getElementById(id);
            if (!form) return;
            Array.from(form.elements).forEach((el) => {
                el.disabled = !state.canEdit;
            });
        });
        const openFlightModal = document.getElementById('openFlightModal');
        const openExpenseModal = document.getElementById('openExpenseModal');
        const openLodgingModal = document.getElementById('openLodgingModal');
        const openTransportModal = document.getElementById('openTransportModal');
        const openTicketModal = document.getElementById('openTicketModal');
        if (openFlightModal) openFlightModal.disabled = !state.canEdit;
        if (openExpenseModal) openExpenseModal.disabled = !state.canEdit;
        if (openLodgingModal) openLodgingModal.disabled = !state.canEdit;
        if (openTransportModal) openTransportModal.disabled = !state.canEdit;
        if (openTicketModal) openTicketModal.disabled = !state.canEdit;
        manageForms.forEach((id) => {
            const form = document.getElementById(id);
            if (!form) return;
            Array.from(form.elements).forEach((el) => {
                el.disabled = !state.canManage;
            });
        });
        setReadOnlyBanner('familyReadOnly', !state.canEdit);
        setReadOnlyBanner('participantReadOnly', !state.canEdit);
        setReadOnlyBanner('expenseReadOnly', !state.canEdit);
        setReadOnlyBanner('inviteReadOnly', !state.canManage);
        setReadOnlyBanner('membersReadOnly', !state.canManage);
        setReadOnlyBanner('flightReadOnly', !state.canEdit);
        setReadOnlyBanner('lodgingReadOnly', !state.canEdit);
        setReadOnlyBanner('transportReadOnly', !state.canEdit);
        setReadOnlyBanner('ticketReadOnly', !state.canEdit);
        const inviteMemberBtn = document.getElementById('inviteMemberBtn');
        if (inviteMemberBtn) {
            inviteMemberBtn.hidden = !state.canManage;
        }
        const leaveGroupItem = document.getElementById('leaveGroupItem');
        if (leaveGroupItem) {
            leaveGroupItem.hidden = state.canManage;
        }
        updateExpenseAvailability();
    };

    const setFamilyFormMode = (mode) => {
        const submit = document.getElementById('familySubmit');
        const cancel = document.getElementById('familyCancel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update family' : 'Add';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const resetFamilyForm = () => {
        const form = document.getElementById('familyForm');
        if (!form) return;
        form.reset();
        form.classList.remove('was-validated');
        state.editing.familyId = null;
        setFamilyFormMode('create');
    };

    const populateFamilyForm = (family) => {
        const input = document.getElementById('familyName');
        if (input) input.value = family?.name || '';
        state.editing.familyId = family?.id || null;
        setFamilyFormMode('edit');
    };

    const setParticipantFormMode = (mode) => {
        const submit = document.getElementById('participantSubmit');
        const cancel = document.getElementById('participantCancel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update participant' : 'Add participant';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const resetParticipantForm = () => {
        const form = document.getElementById('participantForm');
        if (!form) return;
        form.reset();
        form.classList.remove('was-validated');
        state.editing.participantId = null;
        setParticipantFormMode('create');
    };

    const populateParticipantForm = (participant) => {
        const name = document.getElementById('participantName');
        const type = document.getElementById('participantType');
        const family = document.getElementById('participantFamily');
        if (name) name.value = participant?.displayName || '';
        if (type) type.value = participant?.type || '';
        if (family) family.value = participant?.familyId || '';
        state.editing.participantId = participant?.id || null;
        setParticipantFormMode('edit');
    };

    const setExpenseFormMode = (mode) => {
        const submit = document.getElementById('expenseSubmit');
        const cancel = document.getElementById('expenseCancel');
        const modalLabel = document.getElementById('expenseModalLabel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update expense' : 'Add expense';
        }
        if (modalLabel) {
            modalLabel.textContent = isEdit ? 'Edit expense' : 'Add expense';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const getExpenseModalInstance = () => {
        const modalEl = document.getElementById('expenseModal');
        if (!modalEl || !window.bootstrap?.Modal) return null;
        return bootstrap.Modal.getOrCreateInstance(modalEl);
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

    const applyExpenseSplitConfig = (expense) => {
        if (!expense) return;
        const hasSplits = expense.splits && expense.splits.length;
        if (!hasSplits) {
            const splitParticipants = document.getElementById('splitParticipants');
            const splitModeEqual = document.getElementById('splitModeEqual');
            if (splitParticipants) splitParticipants.checked = true;
            if (splitModeEqual) splitModeEqual.checked = true;
            state.editing.expenseConfig = {
                targetIds: state.participants.map((participant) => participant.id)
            };
            return;
        }
        const rawSplitType = expense.splits[0].targetType || 'participant';
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

        applyExpenseSplitConfig(expense);
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
        const modalLabel = document.getElementById('flightModalLabel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update flight' : 'Add flight';
        }
        if (modalLabel) {
            modalLabel.textContent = isEdit ? 'Edit flight' : 'Add flight';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const getFlightModalInstance = () => {
        const modalEl = document.getElementById('flightModal');
        if (!modalEl || !window.bootstrap?.Modal) return null;
        return bootstrap.Modal.getOrCreateInstance(modalEl);
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
        renderFlightPassengerDetails();
        const fromAirportId = document.getElementById('flightFromAirportId');
        const toAirportId = document.getElementById('flightToAirportId');
        if (fromAirportId) fromAirportId.value = '';
        if (toAirportId) toAirportId.value = '';
        const airlineIdInput = document.getElementById('flightAirlineId');
        if (airlineIdInput) airlineIdInput.value = '';
        syncFlightAirlineIdFromInput();
        const arrive = document.getElementById('flightArrive');
        if (arrive) {
            arrive.removeAttribute('min');
            delete arrive.dataset.autofilled;
        }
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
        if (from) from.value = flight.fromLabel || flight.from || '';
        if (to) to.value = flight.toLabel || flight.to || '';
        if (depart) depart.value = formatDateTimeLocal(flight.departAt);
        if (arrive) {
            arrive.value = formatDateTimeLocal(flight.arriveAt);
            if (depart?.value) {
                arrive.min = depart.value;
            } else {
                arrive.removeAttribute('min');
            }
            delete arrive.dataset.autofilled;
        }
        if (passengers) setMultiSelectValues(passengers, flight.participantIds || []);
        if (notes) notes.value = flight.notes || '';
        const fromAirportId = document.getElementById('flightFromAirportId');
        const toAirportId = document.getElementById('flightToAirportId');
        if (fromAirportId) fromAirportId.value = flight.fromAirportId || '';
        if (toAirportId) toAirportId.value = flight.toAirportId || '';
        state.editing.flightSeatMap = { ...(flight.participantSeats || {}) };
        state.editing.flightBaggageMap = { ...(flight.participantBaggage || {}) };
        renderFlightPassengerDetails();
        const airlineIdInput = document.getElementById('flightAirlineId');
        if (airlineIdInput) airlineIdInput.value = flight.airlineId || '';
        syncFlightAirlineIdFromInput();
        const expense = flight.expenseId ? state.expenses.find((item) => item.id === flight.expenseId) : null;
        setModuleExpenseVisibility('flight', !!expense);
        setModuleExpensePayer('flight', expense?.payerParticipantId || null);
        if (expense) {
            applyExpenseSplitConfig(expense);
            renderSplitTargets();
            updateSplitSummary();
        }
    };

    const setLodgingFormMode = (mode) => {
        const submit = document.getElementById('lodgingSubmit');
        const cancel = document.getElementById('lodgingCancel');
        const modalLabel = document.getElementById('lodgingModalLabel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update lodging' : 'Add lodging';
        }
        if (modalLabel) {
            modalLabel.textContent = isEdit ? 'Edit lodging' : 'Add lodging';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const getLodgingModalInstance = () => {
        const modalEl = document.getElementById('lodgingModal');
        if (!modalEl || !window.bootstrap?.Modal) return null;
        return bootstrap.Modal.getOrCreateInstance(modalEl);
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
        const checkOut = document.getElementById('lodgingCheckOut');
        if (checkOut) {
            checkOut.removeAttribute('min');
        }
    };

    const populateLodgingForm = (lodging) => {
        if (!lodging) return;
        const name = document.getElementById('lodgingName');
        const address = document.getElementById('lodgingAddress');
        const addressLine2 = document.getElementById('lodgingAddressLine2');
        const city = document.getElementById('lodgingCity');
        const stateInput = document.getElementById('lodgingState');
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
        if (stateInput) stateInput.value = lodging.state || '';
        if (postalCode) postalCode.value = lodging.postalCode || '';
        if (country) {
            const rawCountry = lodging.country || '';
            const match = state.lodgingCountries.find(
                (item) =>
                    item.code === rawCountry ||
                    item.name.toLowerCase() === rawCountry.toLowerCase()
            );
            if (match) {
                country.value = match.code;
                loadLodgingLocations(match.code);
                applyPostalPattern(match.code, lodging.state);
            } else {
                country.value = rawCountry;
                loadLodgingLocations(rawCountry);
                applyPostalPattern(rawCountry, lodging.state);
            }
        }
        if (checkIn) checkIn.value = lodging.checkIn || '';
        if (checkInTime) checkInTime.value = lodging.checkInTime || '';
        if (checkOut) checkOut.value = lodging.checkOut || '';
        if (checkOutTime) checkOutTime.value = lodging.checkOutTime || '';
        if (checkOut) {
            if (checkIn?.value) {
                checkOut.min = checkIn.value;
            } else {
                checkOut.removeAttribute('min');
            }
        }
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
        if (expense) {
            applyExpenseSplitConfig(expense);
            renderSplitTargets();
            updateSplitSummary();
        }
    };

    const setTransportFormMode = (mode) => {
        const submit = document.getElementById('transportSubmit');
        const cancel = document.getElementById('transportCancel');
        const modalLabel = document.getElementById('transportModalLabel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update transport' : 'Add transport';
        }
        if (modalLabel) {
            modalLabel.textContent = isEdit ? 'Edit transport' : 'Add transport';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const getTransportModalInstance = () => {
        const modalEl = document.getElementById('transportModal');
        if (!modalEl || !window.bootstrap?.Modal) return null;
        return bootstrap.Modal.getOrCreateInstance(modalEl);
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
        const arrive = document.getElementById('transportArrive');
        if (arrive) {
            arrive.removeAttribute('min');
            delete arrive.dataset.autofilled;
        }
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
        if (arrive) {
            if (depart?.value) {
                arrive.min = depart.value;
            } else {
                arrive.removeAttribute('min');
            }
            delete arrive.dataset.autofilled;
        }
        if (provider) provider.value = transport.provider || '';
        if (locator) locator.value = transport.locator || '';
        if (status) status.value = transport.status || 'planned';
        if (amount) amount.value = transport.amount ?? '';
        if (currency) currency.value = transport.currency || state.group?.defaultCurrency || 'USD';
        if (notes) notes.value = transport.notes || '';
        const expense = transport.expenseId ? state.expenses.find((item) => item.id === transport.expenseId) : null;
        setModuleExpenseVisibility('transport', !!expense);
        setModuleExpensePayer('transport', expense?.payerParticipantId || null);
        if (expense) {
            applyExpenseSplitConfig(expense);
            renderSplitTargets();
            updateSplitSummary();
        }
    };

    const setTicketFormMode = (mode) => {
        const submit = document.getElementById('ticketSubmit');
        const cancel = document.getElementById('ticketCancel');
        const modalLabel = document.getElementById('ticketModalLabel');
        const isEdit = mode === 'edit';
        if (submit) {
            submit.textContent = isEdit ? 'Update ticket' : 'Add ticket';
        }
        if (modalLabel) {
            modalLabel.textContent = isEdit ? 'Edit ticket' : 'Add ticket';
        }
        if (cancel) {
            cancel.classList.toggle('d-none', !isEdit);
        }
    };

    const getTicketModalInstance = () => {
        const modalEl = document.getElementById('ticketModal');
        if (!modalEl || !window.bootstrap?.Modal) return null;
        return bootstrap.Modal.getOrCreateInstance(modalEl);
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
        if (expense) {
            applyExpenseSplitConfig(expense);
            renderSplitTargets();
            updateSplitSummary();
        }
    };

    const bindGroupSelector = () => {
        const selector = document.getElementById('groupSelector');
        if (!selector) return;
        selector.addEventListener('change', () => {
            const nextId = selector.value;
            const basePath = getCurrentBasePath();
            window.location.href = `${basePath}?groupId=${nextId}`;
        });
    };

    const bindFamilyBalanceModeSelector = () => {
        const selector = document.getElementById('familyBalanceMode');
        if (!selector) return;
        selector.addEventListener('change', async () => {
            if (!state.groupId) return;
            const errorEl = document.getElementById('familyBalanceModeError');
            if (errorEl) errorEl.classList.add('d-none');
            const nextMode = selector.value === 'families' ? 'families' : 'participants';
            const prevMode = state.group.familyBalanceMode || 'participants';
            if (nextMode === prevMode) return;
            try {
                await apiRequest(`/api/groups/${state.groupId}/family-balance-mode`, {
                    method: 'PUT',
                    body: JSON.stringify({ mode: nextMode })
                });
                state.group.familyBalanceMode = nextMode;
                await refreshData();
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message;
                    errorEl.classList.remove('d-none');
                }
                selector.value = prevMode;
            }
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
                const submitBtn = familyForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
                try {
                    if (state.editing.familyId) {
                        await apiRequest(`/api/groups/${state.groupId}/families/${state.editing.familyId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ name })
                        });
                    } else {
                        await apiRequest(`/api/groups/${state.groupId}/families`, {
                            method: 'POST',
                            body: JSON.stringify({ name })
                        });
                    }
                    showToast('success', state.editing.familyId ? 'Family updated.' : 'Family created.');
                    resetFamilyForm();
                    await refreshData();
                } catch (err) {
                    if (familyError) {
                        familyError.textContent = err.message;
                        familyError.classList.remove('d-none');
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
        const familyCancel = document.getElementById('familyCancel');
        if (familyCancel) {
            familyCancel.addEventListener('click', () => {
                resetFamilyForm();
            });
        }

        const flightForm = document.getElementById('flightForm');
        const flightError = document.getElementById('flightError');
        const openFlightModal = document.getElementById('openFlightModal');
        const flightModal = document.getElementById('flightModal');
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
                const baggageMap = {};
                passengerValues.forEach((participantId) => {
                    const seatInput = document.querySelector(
                        `#flightPassengerDetails [data-field="seat"][data-participant-id="${participantId}"]`
                    );
                    seatMap[participantId] = seatInput ? seatInput.value.trim() : '';
                    const baggageInput = document.querySelector(
                        `#flightPassengerDetails [data-field="baggage"][data-participant-id="${participantId}"]`
                    );
                    baggageMap[participantId] = baggageInput ? baggageInput.value.trim() : '';
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
                    fromAirportId: document.getElementById('flightFromAirportId')?.value || '',
                    toAirportId: document.getElementById('flightToAirportId')?.value || '',
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
                const submitBtn = flightForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
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
                    showToast('success', flightId ? 'Flight updated.' : 'Flight created.');
                    resetFlightForm();
                    await refreshData();
                    getFlightModalInstance()?.hide();
                } catch (err) {
                    if (flightError) {
                        flightError.textContent = err.message;
                        flightError.classList.remove('d-none');
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
        if (openFlightModal) {
            openFlightModal.addEventListener('click', () => {
                resetFlightForm();
                setFlightFormMode('create');
            });
        }
        if (flightModal) {
            flightModal.addEventListener('hidden.bs.modal', () => {
                resetFlightForm();
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
        const openLodgingModal = document.getElementById('openLodgingModal');
        const lodgingModal = document.getElementById('lodgingModal');
        if (lodgingForm) {
            lodgingForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (lodgingError) lodgingError.classList.add('d-none');
                if (!validateForm(lodgingForm)) return;
                const countryCode = document.getElementById('lodgingCountry')?.value || '';
                const payload = {
                    name: document.getElementById('lodgingName')?.value || '',
                    address: document.getElementById('lodgingAddress')?.value || '',
                    addressLine2: document.getElementById('lodgingAddressLine2')?.value || '',
                    city: document.getElementById('lodgingCity')?.value || '',
                    state: document.getElementById('lodgingState')?.value || '',
                    postalCode: document.getElementById('lodgingPostalCode')?.value || '',
                    country: resolveCountryName(countryCode),
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
                const checkInDate = parseDateValue(payload.checkIn);
                const checkOutDate = parseDateValue(payload.checkOut);
                if (checkInDate && checkOutDate && checkOutDate.getTime() <= checkInDate.getTime()) {
                    if (lodgingError) {
                        lodgingError.textContent = 'Check-out must be after check-in.';
                        lodgingError.classList.remove('d-none');
                    }
                    return;
                }
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
                const submitBtn = lodgingForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
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
                    showToast('success', lodgingId ? 'Lodging updated.' : 'Lodging created.');
                    resetLodgingForm();
                    await refreshData();
                    getLodgingModalInstance()?.hide();
                } catch (err) {
                    if (lodgingError) {
                        lodgingError.textContent = err.message;
                        lodgingError.classList.remove('d-none');
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
        const lodgingCancel = document.getElementById('lodgingCancel');
        if (lodgingCancel) {
            lodgingCancel.addEventListener('click', () => {
                resetLodgingForm();
            });
        }
        if (openLodgingModal) {
            openLodgingModal.addEventListener('click', () => {
                resetLodgingForm();
                setLodgingFormMode('create');
            });
        }
        if (lodgingModal) {
            lodgingModal.addEventListener('hidden.bs.modal', () => {
                resetLodgingForm();
            });
        }

        const transportForm = document.getElementById('transportForm');
        const transportError = document.getElementById('transportError');
        const openTransportModal = document.getElementById('openTransportModal');
        const transportModal = document.getElementById('transportModal');
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
                const departDate = parseDateValue(payload.departAt);
                const arriveDate = parseDateValue(payload.arriveAt);
                if (departDate && arriveDate && arriveDate.getTime() <= departDate.getTime()) {
                    if (transportError) {
                        transportError.textContent = 'Arrival must be after departure.';
                        transportError.classList.remove('d-none');
                    }
                    return;
                }
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
                const submitBtn = transportForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
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
                    showToast('success', transportId ? 'Transport updated.' : 'Transport created.');
                    resetTransportForm();
                    await refreshData();
                    getTransportModalInstance()?.hide();
                } catch (err) {
                    if (transportError) {
                        transportError.textContent = err.message;
                        transportError.classList.remove('d-none');
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
        const transportCancel = document.getElementById('transportCancel');
        if (transportCancel) {
            transportCancel.addEventListener('click', () => {
                resetTransportForm();
            });
        }
        if (openTransportModal) {
            openTransportModal.addEventListener('click', () => {
                resetTransportForm();
                setTransportFormMode('create');
            });
        }
        if (transportModal) {
            transportModal.addEventListener('hidden.bs.modal', () => {
                resetTransportForm();
            });
        }

        const ticketForm = document.getElementById('ticketForm');
        const ticketError = document.getElementById('ticketError');
        const openTicketModal = document.getElementById('openTicketModal');
        const ticketModal = document.getElementById('ticketModal');
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
                const eventDate = parseDateValue(payload.eventAt);
                if (payload.status === 'planned' && eventDate) {
                    const now = new Date();
                    if (eventDate.getTime() <= now.getTime()) {
                        if (ticketError) {
                            ticketError.textContent = 'Planned tickets must be scheduled in the future.';
                            ticketError.classList.remove('d-none');
                        }
                        return;
                    }
                }
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
                const submitBtn = ticketForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
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
                    showToast('success', ticketId ? 'Ticket updated.' : 'Ticket created.');
                    resetTicketForm();
                    await refreshData();
                    getTicketModalInstance()?.hide();
                } catch (err) {
                    if (ticketError) {
                        ticketError.textContent = err.message;
                        ticketError.classList.remove('d-none');
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
        const ticketCancel = document.getElementById('ticketCancel');
        if (ticketCancel) {
            ticketCancel.addEventListener('click', () => {
                resetTicketForm();
            });
        }
        if (openTicketModal) {
            openTicketModal.addEventListener('click', () => {
                resetTicketForm();
                setTicketFormMode('create');
            });
        }
        if (ticketModal) {
            ticketModal.addEventListener('hidden.bs.modal', () => {
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
                const submitBtn = participantForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
                try {
                    if (state.editing.participantId) {
                        await apiRequest(`/api/groups/${state.groupId}/participants/${state.editing.participantId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ displayName, type, familyId })
                        });
                    } else {
                        await apiRequest(`/api/groups/${state.groupId}/participants`, {
                            method: 'POST',
                            body: JSON.stringify({ displayName, type, familyId })
                        });
                    }
                    showToast('success', state.editing.participantId ? 'Participant updated.' : 'Participant created.');
                    resetParticipantForm();
                    await refreshData();
                } catch (err) {
                    if (participantError) {
                        participantError.textContent = err.message;
                        participantError.classList.remove('d-none');
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
        const participantCancel = document.getElementById('participantCancel');
        if (participantCancel) {
            participantCancel.addEventListener('click', () => {
                resetParticipantForm();
            });
        }

        const expenseForm = document.getElementById('expenseForm');
        const expenseError = document.getElementById('expenseError');
        const splitTargetsError = document.getElementById('splitTargetsError');
        const openExpenseModal = document.getElementById('openExpenseModal');
        const expenseModal = document.getElementById('expenseModal');
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

                const submitBtn = expenseForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
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
                    showToast('success', expenseId ? 'Expense updated.' : 'Expense created.');
                    resetExpenseForm();
                    await refreshData();
                    getExpenseModalInstance()?.hide();
                } catch (err) {
                    if (expenseError) {
                        expenseError.textContent = err.message;
                        expenseError.classList.remove('d-none');
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
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
        if (openExpenseModal) {
            openExpenseModal.addEventListener('click', () => {
                resetExpenseForm();
                setExpenseFormMode('create');
            });
        }
        if (expenseModal) {
            expenseModal.addEventListener('hidden.bs.modal', () => {
                resetExpenseForm();
            });
        }
    };

    const bindInviteForm = () => {
        const form = document.getElementById('inviteForm');
        const errorEl = document.getElementById('inviteError');
        const successEl = document.getElementById('inviteSuccess');
        const titleEl = document.getElementById('inviteSuccessTitle');
        const messageEl = document.getElementById('inviteSuccessMessage');
        const linkInputEl = document.getElementById('inviteLinkInput');
        const copyBtn = document.getElementById('copyInviteLink');
        const expiresEl = document.getElementById('inviteExpires');
        if (!form) return;

        if (copyBtn && linkInputEl) {
            copyBtn.addEventListener('click', () => {
                linkInputEl.select();
                navigator.clipboard.writeText(linkInputEl.value).then(() => {
                    const originalHtml = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="bx bx-check"></i>';
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHtml;
                    }, 2000);
                });
            });
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (errorEl) errorEl.classList.add('d-none');
            if (successEl) successEl.classList.add('d-none');
            if (!state.canManage) {
                if (errorEl) {
                    errorEl.textContent = 'Only owners can send invites.';
                    errorEl.classList.remove('d-none');
                }
                return;
            }
            if (!validateForm(form)) return;
            const email = document.getElementById('inviteEmail')?.value || '';
            const role = document.getElementById('inviteRole')?.value || 'member';
            try {
                const res = await apiRequest(`/api/groups/${state.groupId}/invitations`, {
                    method: 'POST',
                    body: JSON.stringify({ email, role })
                });

                if (titleEl && messageEl) {
                    if (res.emailSent) {
                        titleEl.innerHTML = '<i class="bx bx-check-circle me-1"></i> Invite sent!';
                        messageEl.textContent = `An invitation email has been sent to ${email}.`;
                    } else {
                        titleEl.innerHTML = '<i class="bx bx-info-circle me-1"></i> Invite created';
                        messageEl.textContent = 'Email could not be sent. Please share the link below manually.';
                    }
                }

                if (linkInputEl) {
                    linkInputEl.value = res.inviteUrl || '';
                }
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

    const bindMemberRoleActions = () => {
        const list = document.getElementById('memberList');
        const errorEl = document.getElementById('membersError');
        if (!list) return;
        list.addEventListener('click', async (event) => {
            const button = event.target.closest('button');
            if (!(button instanceof HTMLButtonElement)) return;
            if (!state.canManage) return;
            if (errorEl) errorEl.classList.add('d-none');
            const userId = button.dataset.id;
            if (!userId) return;

            if (button.dataset.action === 'save-member-role') {
                const select = document.querySelector(`select[data-member-role="${userId}"]`);
                const role = select?.value || '';
                try {
                    await apiRequest(`/api/groups/${state.groupId}/members/${userId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ role })
                    });
                    await refreshData();
                } catch (err) {
                    if (errorEl) {
                        errorEl.textContent = err.message;
                        errorEl.classList.remove('d-none');
                    }
                }
            }

            if (button.dataset.action === 'remove-member') {
                const memberName = button.dataset.name || 'this member';
                if (!confirm(`Are you sure you want to remove ${memberName} from the group?`)) {
                    return;
                }
                try {
                    await apiRequest(`/api/groups/${state.groupId}/members/${userId}`, {
                        method: 'DELETE'
                    });
                    await refreshData();
                } catch (err) {
                    if (errorEl) {
                        errorEl.textContent = err.message;
                        errorEl.classList.remove('d-none');
                    }
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
                const button = event.target.closest('button');
                if (!(button instanceof HTMLButtonElement)) return;
                const action = button.dataset.action;
                const id = Number(button.dataset.id);
                if (!id) return;
                if (action === 'edit-family') {
                    if (!state.canEdit) return;
                    const family = state.families.find((item) => item.id === id);
                    if (!family) return;
                    populateFamilyForm(family);
                    document.getElementById('familyForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                if (action !== 'delete-family') return;
                if (!(await confirmAction('Are you sure you want to delete this family?'))) return;
                button.disabled = true;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/families/${id}`, { method: 'DELETE' });
                    if (state.editing.familyId === id) {
                        resetFamilyForm();
                    }
                    showToast('success', 'Family deleted.');
                    await refreshData();
                } catch (err) {
                    const familyError = document.getElementById('familyError');
                    if (familyError) {
                        familyError.textContent = err.message;
                        familyError.classList.remove('d-none');
                    }
                } finally {
                    button.disabled = false;
                }
            });
        }

        if (participantList) {
            participantList.addEventListener('click', async (event) => {
                const button = event.target.closest('button');
                if (!(button instanceof HTMLButtonElement)) return;
                const action = button.dataset.action;
                const id = Number(button.dataset.id);
                if (!id) return;
                if (action === 'edit-participant') {
                    if (!state.canEdit) return;
                    const participant = state.participants.find((item) => item.id === id);
                    if (!participant) return;
                    populateParticipantForm(participant);
                    document.getElementById('participantForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                if (action !== 'delete-participant') return;
                if (!(await confirmAction('Are you sure you want to delete this participant?'))) return;
                button.disabled = true;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/participants/${id}`, { method: 'DELETE' });
                    if (state.editing.participantId === id) {
                        resetParticipantForm();
                    }
                    showToast('success', 'Participant deleted.');
                    await refreshData();
                } catch (err) {
                    const participantError = document.getElementById('participantError');
                    if (participantError) {
                        participantError.textContent = err.message;
                        participantError.classList.remove('d-none');
                    }
                } finally {
                    button.disabled = false;
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
                    getExpenseModalInstance()?.show();
                    return;
                }
                if (action !== 'delete-expense') return;
                if (!(await confirmAction('Are you sure you want to delete this expense?'))) return;
                button.disabled = true;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/expenses/${id}`, { method: 'DELETE' });
                    if (state.editing.expenseId === id) {
                        resetExpenseForm();
                    }
                    showToast('success', 'Expense deleted.');
                    await refreshData();
                } catch (err) {
                    const expenseError = document.getElementById('expenseError');
                    if (expenseError) {
                        expenseError.textContent = err.message;
                        expenseError.classList.remove('d-none');
                    }
                } finally {
                    button.disabled = false;
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
                if (action === 'toggle-flight-details') {
                    const detailsRow = document.getElementById(`flight-details-${id}`);
                    if (detailsRow) {
                        detailsRow.classList.toggle('d-none');
                    }
                    return;
                }
                if (action === 'edit-flight') {
                    if (!state.canEdit) return;
                    const flight = state.flights.find((item) => item.id === id);
                    if (!flight) return;
                    state.editing.flightId = id;
                    populateFlightForm(flight);
                    setFlightFormMode('edit');
                    flightForm?.classList.remove('was-validated');
                    getFlightModalInstance()?.show();
                    return;
                }
                if (action !== 'delete-flight') return;
                if (!(await confirmAction('Are you sure you want to delete this flight?'))) return;
                button.disabled = true;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/flights/${id}`, { method: 'DELETE' });
                    resetFlightForm();
                    showToast('success', 'Flight deleted.');
                    await refreshData();
                } catch (err) {
                    const flightError = document.getElementById('flightError');
                    if (flightError) {
                        flightError.textContent = err.message;
                        flightError.classList.remove('d-none');
                    }
                } finally {
                    button.disabled = false;
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
                if (action === 'toggle-lodging-details') {
                    const isMobile = window.matchMedia('(max-width: 767px)').matches;
                    if (isMobile) {
                        openLodgingDetailsModal(id);
                    } else {
                        const detailsRow = document.getElementById(`lodging-details-${id}`);
                        if (detailsRow) detailsRow.classList.toggle('d-none');
                    }
                    return;
                }
                if (action === 'edit-lodging') {
                    if (!state.canEdit) return;
                    const lodging = state.lodgings.find((item) => String(item.id) === String(id));
                    if (!lodging) return;
                    state.editing.lodgingId = id;
                    populateLodgingForm(lodging);
                    setLodgingFormMode('edit');
                    lodgingForm?.classList.remove('was-validated');
                    getLodgingModalInstance()?.show();
                    return;
                }
                if (action !== 'delete-lodging') return;
                if (!(await confirmAction('Are you sure you want to delete this lodging?'))) return;
                button.disabled = true;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/lodgings/${id}`, { method: 'DELETE' });
                    if (state.editing.lodgingId === id) {
                        resetLodgingForm();
                    }
                    showToast('success', 'Lodging deleted.');
                    await refreshData();
                } catch (err) {
                    const lodgingError = document.getElementById('lodgingError');
                    if (lodgingError) {
                        lodgingError.textContent = err.message;
                        lodgingError.classList.remove('d-none');
                    }
                } finally {
                    button.disabled = false;
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
                if (action === 'toggle-transport-details') {
                    const detailsRow = document.getElementById(`transport-details-${id}`);
                    if (detailsRow) detailsRow.classList.toggle('d-none');
                    return;
                }
                if (action === 'edit-transport') {
                    if (!state.canEdit) return;
                    const transport = state.transports.find((item) => item.id === id);
                    if (!transport) return;
                    state.editing.transportId = id;
                    populateTransportForm(transport);
                    setTransportFormMode('edit');
                    const transportForm = document.getElementById('transportForm');
                    transportForm?.classList.remove('was-validated');
                    getTransportModalInstance()?.show();
                    return;
                }
                if (action !== 'delete-transport') return;
                if (!(await confirmAction('Are you sure you want to delete this transport?'))) return;
                button.disabled = true;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/transports/${id}`, { method: 'DELETE' });
                    if (state.editing.transportId === id) {
                        resetTransportForm();
                    }
                    showToast('success', 'Transport deleted.');
                    await refreshData();
                } catch (err) {
                    const transportError = document.getElementById('transportError');
                    if (transportError) {
                        transportError.textContent = err.message;
                        transportError.classList.remove('d-none');
                    }
                } finally {
                    button.disabled = false;
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
                if (action === 'toggle-ticket-details') {
                    const detailsRow = document.getElementById(`ticket-details-${id}`);
                    if (detailsRow) detailsRow.classList.toggle('d-none');
                    return;
                }
                if (action === 'edit-ticket') {
                    if (!state.canEdit) return;
                    const ticket = state.tickets.find((item) => item.id === id);
                    if (!ticket) return;
                    state.editing.ticketId = id;
                    populateTicketForm(ticket);
                    setTicketFormMode('edit');
                    const ticketForm = document.getElementById('ticketForm');
                    ticketForm?.classList.remove('was-validated');
                    getTicketModalInstance()?.show();
                    return;
                }
                if (action !== 'delete-ticket') return;
                if (!(await confirmAction('Are you sure you want to delete this ticket?'))) return;
                button.disabled = true;
                try {
                    await apiRequest(`/api/groups/${state.groupId}/tickets/${id}`, { method: 'DELETE' });
                    if (state.editing.ticketId === id) {
                        resetTicketForm();
                    }
                    showToast('success', 'Ticket deleted.');
                    await refreshData();
                } catch (err) {
                    const ticketError = document.getElementById('ticketError');
                    if (ticketError) {
                        ticketError.textContent = err.message;
                        ticketError.classList.remove('d-none');
                    }
                } finally {
                    button.disabled = false;
                }
            });
        }
    };

    const bindFlightFilters = () => {
        const airlineInput = document.getElementById('filterFlightAirline');
        const fromInput = document.getElementById('filterFlightFrom');
        const toInput = document.getElementById('filterFlightTo');
        const statusSelect = document.getElementById('filterFlightStatus');
        const clearBtn = document.getElementById('clearFlightFilters');
        const updateFilters = () => {
            state.filters.flights.airline = airlineInput?.value || '';
            state.filters.flights.from = fromInput?.value || '';
            state.filters.flights.to = toInput?.value || '';
            state.filters.flights.status = statusSelect?.value || '';
            renderFlights();
        };
        airlineInput?.addEventListener('input', updateFilters);
        fromInput?.addEventListener('input', updateFilters);
        toInput?.addEventListener('input', updateFilters);
        statusSelect?.addEventListener('change', updateFilters);
        clearBtn?.addEventListener('click', () => {
            if (airlineInput) airlineInput.value = '';
            if (fromInput) fromInput.value = '';
            if (toInput) toInput.value = '';
            if (statusSelect) statusSelect.value = '';
            state.filters.flights = { airline: '', from: '', to: '', status: '' };
            renderFlights();
        });
    };

    const updateLodgingFilterBadge = () => {
        const badge = document.getElementById('lodgingFilterCount');
        if (!badge) return;
        const count = [state.filters.lodgings.city, state.filters.lodgings.status].filter(Boolean).length;
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    };

    const bindLodgingFilters = () => {
        const cityInput = document.getElementById('filterLodgingCity');
        const statusSelect = document.getElementById('filterLodgingStatus');
        const clearBtn = document.getElementById('clearLodgingFilters');
        const toggleBtn = document.getElementById('toggleLodgingFilters');
        const filtersContainer = document.getElementById('lodgingFilters');

        const updateFilters = () => {
            state.filters.lodgings.city = cityInput?.value || '';
            state.filters.lodgings.status = statusSelect?.value || '';
            updateLodgingFilterBadge();
            renderLodgings();
        };

        cityInput?.addEventListener('input', updateFilters);
        statusSelect?.addEventListener('change', updateFilters);
        clearBtn?.addEventListener('click', () => {
            if (cityInput) cityInput.value = '';
            if (statusSelect) statusSelect.value = '';
            state.filters.lodgings = { city: '', status: '' };
            updateLodgingFilterBadge();
            renderLodgings();
        });

        toggleBtn?.addEventListener('click', () => {
            filtersContainer?.classList.toggle('show');
        });

        updateLodgingFilterBadge();
    };

    const bindTransportFilters = () => {
        const statusSelect = document.getElementById('filterTransportStatus');
        const providerInput = document.getElementById('filterTransportProvider');
        const clearBtn = document.getElementById('clearTransportFilters');
        const updateFilters = () => {
            state.filters.transports.status = statusSelect?.value || '';
            state.filters.transports.provider = providerInput?.value || '';
            renderTransports();
        };
        statusSelect?.addEventListener('change', updateFilters);
        providerInput?.addEventListener('input', updateFilters);
        clearBtn?.addEventListener('click', () => {
            if (statusSelect) statusSelect.value = '';
            if (providerInput) providerInput.value = '';
            state.filters.transports = { status: '', provider: '' };
            renderTransports();
        });
    };

    const bindTicketFilters = () => {
        const typeInput = document.getElementById('filterTicketType');
        const statusSelect = document.getElementById('filterTicketStatus');
        const dateFromInput = document.getElementById('filterTicketDateFrom');
        const dateToInput = document.getElementById('filterTicketDateTo');
        const clearBtn = document.getElementById('clearTicketFilters');
        const updateFilters = () => {
            state.filters.tickets.type = typeInput?.value || '';
            state.filters.tickets.status = statusSelect?.value || '';
            state.filters.tickets.dateFrom = dateFromInput?.value || '';
            state.filters.tickets.dateTo = dateToInput?.value || '';
            renderTickets();
        };
        typeInput?.addEventListener('input', updateFilters);
        statusSelect?.addEventListener('change', updateFilters);
        dateFromInput?.addEventListener('change', updateFilters);
        dateToInput?.addEventListener('change', updateFilters);
        clearBtn?.addEventListener('click', () => {
            if (typeInput) typeInput.value = '';
            if (statusSelect) statusSelect.value = '';
            if (dateFromInput) dateFromInput.value = '';
            if (dateToInput) dateToInput.value = '';
            state.filters.tickets = { type: '', status: '', dateFrom: '', dateTo: '' };
            renderTickets();
        });
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
                if (toggle.checked) {
                    const splitParticipants = document.getElementById('splitParticipants');
                    const splitModeEqual = document.getElementById('splitModeEqual');
                    if (splitParticipants) splitParticipants.checked = true;
                    if (splitModeEqual) splitModeEqual.checked = true;
                    state.editing.expenseConfig = {
                        targetIds: state.participants.map((participant) => participant.id)
                    };
                    renderSplitTargets();
                }
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

    const bindLeaveGroup = () => {
        const link = document.getElementById('leaveGroupLink');
        if (!link) return;
        link.addEventListener('click', async (event) => {
            event.preventDefault();
            if (!state.groupId) return;
            const groupName = state.group?.name || 'this group';
            if (!confirm(`Are you sure you want to leave "${groupName}"?`)) return;
            try {
                await apiRequest(`/api/groups/${state.groupId}/members/me`, { method: 'DELETE' });
                window.location.href = '/groups';
            } catch (err) {
                alert(err.message || 'Failed to leave group.');
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
                const modal = new window.bootstrap.Modal(modalEl);
                modal.show();
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

        trigger.addEventListener('click', () => {
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

    const refreshData = async () => {
        await loadAirlines();
        await loadLodgingPlatforms();
        await loadGroupData();
        await loadLodgingProperties();
        renderGroupHeader();
        renderSummary();
        renderBalances();
        renderDebts();
        renderFamilies();
        renderParticipants();
        renderMembers();
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

    const applySorting = (dataArray, moduleName) => {
        const sortConfig = state.sorting[moduleName];
        if (!sortConfig || !sortConfig.field) return dataArray;

        const sorted = [...dataArray].sort((a, b) => {
            let aVal = a[sortConfig.field];
            let bVal = b[sortConfig.field];

            // Special handling for participantIds (count)
            if (sortConfig.field === 'participantIds') {
                aVal = (a.participantIds || []).length;
                bVal = (b.participantIds || []).length;
            }

            // Handle null/undefined
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            // String comparison
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            }

            // Number comparison
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        return sorted;
    };

    const bindTableSorting = () => {
        document.querySelectorAll('th.sortable').forEach((th) => {
            th.addEventListener('click', () => {
                const sortField = th.dataset.sort;
                if (!sortField) return;

                // Determine module from the nearest table
                const table = th.closest('table');
                const tbody = table?.querySelector('tbody');
                if (!tbody) return;

                const baseModuleName = tbody.id.replace('List', '').toLowerCase();
                const module = baseModuleName === 'participant' ? 'participants' :
                              baseModuleName === 'expense' ? 'expenses' :
                              baseModuleName === 'flight' ? 'flights' :
                              baseModuleName === 'lodging' ? 'lodgings' :
                              baseModuleName === 'transport' ? 'transports' :
                              baseModuleName === 'ticket' ? 'tickets' : null;

                if (!module || !state.sorting[module]) return;

                // Toggle direction if same field, otherwise default to asc
                if (state.sorting[module].field === sortField) {
                    state.sorting[module].direction = state.sorting[module].direction === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sorting[module].field = sortField;
                    state.sorting[module].direction = 'asc';
                }

                // Update sort icons
                table.querySelectorAll('th.sortable .sort-icon').forEach((icon) => icon.textContent = '');
                const icon = th.querySelector('.sort-icon');
                if (icon) {
                    icon.textContent = state.sorting[module].direction === 'asc' ? ' ▲' : ' ▼';
                }

                // Re-render
                if (module === 'participants') renderParticipants();
                else if (module === 'expenses') renderExpenses();
                else if (module === 'flights') renderFlights();
                else if (module === 'lodgings') renderLodgings();
                else if (module === 'transports') renderTransports();
                else if (module === 'tickets') renderTickets();
            });
        });
    };

    const init = async () => {
        await setUserProfile();
        const ok = await loadGroups();
        if (!ok) return;
        bindGroupSelector();
        bindFamilyBalanceModeSelector();
        bindSectionVisibility();
        bindForms();
        await loadLodgingCountries();
        setupFlightAirlineAutocomplete();
        setupLodgingPlatformAutocomplete();
        setupLodgingLocationAutocomplete();
        setupFlightAirportAutocomplete();
        setupFlightDateConstraints();
        setupTransportDateConstraints();
        setupTransportConditionalValidation();
        setupLodgingDateConstraints();
        setupLodgingConditionalValidation();
        setupTicketConditionalValidation();
        setupFlightParticipantSearch();
        bindInviteForm();
        bindMemberRoleActions();
        bindDeleteActions();
        bindFlightFilters();
        bindLodgingFilters();
        bindTransportFilters();
        bindTicketFilters();
        bindTableSorting();
        bindSplitTypeToggle();
        bindSplitModeToggle();
        bindModuleExpenseToggles();
        bindLogout();
        bindLeaveGroup();
        bindAvatarChange();
        bindMobileMenuToggleFallback();
        bindMobileMenuAutoClose();
        renderGroupHeader();
        await refreshData();
    };

    // Force mobile table styles via JavaScript (CSP prevents inline scripts)
    const applyMobileTableStyles = () => {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;

        document.querySelectorAll('table.table-mobile-cards').forEach(table => {
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');

            if (isMobile) {
                // Apply mobile card styles
                if (thead) {
                    thead.style.cssText = 'display: none !important;';
                }
                table.style.cssText = 'display: block !important; width: 100% !important; border: 0 !important;';
                if (tbody) {
                    tbody.style.cssText = 'display: block !important; width: 100% !important;';
                    tbody.querySelectorAll('tr').forEach(tr => {
                        tr.style.cssText = 'display: block !important; margin-bottom: 1rem !important; border: 1px solid #e3e6ea !important; border-radius: 0.375rem !important; padding: 0.75rem !important; background: white !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;';
                        tr.querySelectorAll('td').forEach((td, index, arr) => {
                            const label = td.getAttribute('data-label');
                            if (index === arr.length - 1) {
                                // Actions cell
                                td.style.cssText = 'display: block !important; width: 100% !important; padding: 0.75rem 0 0 0 !important; border: none !important; border-top: 1px solid #e3e6ea !important; margin-top: 0.5rem !important; text-align: center !important;';
                            } else if (label) {
                                // Regular cell with label - store original content if not already stored
                                if (!td.hasAttribute('data-original-content')) {
                                    td.setAttribute('data-original-content', td.innerHTML);
                                }
                                if (!td.querySelector('.mobile-label')) {
                                    const originalContent = td.getAttribute('data-original-content');
                                    td.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.375rem 0; min-height: 2rem;"><span class="mobile-label" style="font-weight: 600; color: #495057; font-size: 0.875rem; flex-shrink: 0; margin-right: 1rem;">${label}:</span><span style="text-align: right; color: #212529; flex-grow: 1;">${originalContent}</span></div>`;
                                }
                                td.style.cssText = 'display: block !important; width: 100% !important; border: none !important; padding: 0 !important;';
                            }
                        });
                    });
                }
            } else {
                // Restore desktop table styles
                if (thead) {
                    thead.style.cssText = '';
                }
                table.style.cssText = '';
                if (tbody) {
                    tbody.style.cssText = '';
                    tbody.querySelectorAll('tr').forEach(tr => {
                        tr.style.cssText = '';
                        tr.querySelectorAll('td').forEach(td => {
                            // Restore original content if it was modified for mobile
                            if (td.hasAttribute('data-original-content')) {
                                td.innerHTML = td.getAttribute('data-original-content');
                            }
                            td.style.cssText = '';
                        });
                    });
                }
            }
        });
    };

    window.addEventListener('resize', applyMobileTableStyles);
    window.addEventListener('orientationchange', applyMobileTableStyles);

    init();

    setTimeout(applyMobileTableStyles, 100);
    setTimeout(applyMobileTableStyles, 500);
})();
