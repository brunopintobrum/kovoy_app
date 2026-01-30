# Database Schema (Summary)

This is a concise, human-readable snapshot of the SQLite schema used by the app.
For full definitions, see `server.js` (schema bootstrapping) and the SQLite DB at `data/app.db`.
Last updated: 2026-01-30 16:20.

## Core Auth
- users: id, email, password_hash, google_sub, first_name, last_name, display_name, avatar_url, email_verified_at, two_factor_enabled, created_at
- refresh_tokens, email_verification_tokens, reset_tokens, two_factor_codes

## Groups
- groups: id, name, default_currency, family_balance_mode, created_at
- group_members: id, group_id, user_id, role, created_at
- invitations: id, group_id, email, role, token, expires_at, used_at, created_at

## Participants & Families
- families: id, group_id, name, created_at
- participants: id, group_id, family_id, first_name, last_name, type, created_at

## Expenses
- expenses: id, group_id, description, amount, currency, date, category, payer_participant_id, created_at
- expense_splits: id, expense_id, target_type, target_id, amount, created_at

## Flights (V2)
- group_flights:
  - id, group_id, expense_id
  - airline, airline_id, flight_number, pnr, cabin_class, status
  - cost, currency
  - from_city, to_city, from_airport_id, to_airport_id
  - depart_at, arrive_at, notes, created_at
- group_flight_participants:
  - id, group_id, flight_id, participant_id
  - seat, baggage, created_at

## Airports & Airlines
- airports: id, code, name, city, country, name_normalized, city_normalized, created_at
- airlines: id, name, created_at
- lodging_platforms: id, name, created_at

## Locations
- countries: code, name
- states: id, country_code, code, name
- cities: id, country_code, state_code, name, population

## Lodgings (V2)
- group_lodgings:
  - id, group_id, expense_id
  - name, platform, platform_id, address, address_line2, city, state, postal_code, country
  - check_in, check_in_time, check_out, check_out_time
  - room_type, room_quantity, room_occupancy
  - status, cost, currency
  - host, contact, contact_phone, contact_email, notes, created_at

## Transports (V2)
- group_transports:
  - id, group_id, expense_id
  - type, origin, destination
  - depart_at, arrive_at
  - provider, locator, status
  - amount, currency, notes, created_at

## Tickets (V2)
- group_tickets:
  - id, group_id, expense_id
  - type, event_at, location, status
  - amount, currency, notes, created_at
- group_ticket_participants:
  - id, group_id, ticket_id, participant_id, created_at

## Legacy (Trip)
- trips, trip_flights, trip_lodgings, trip_cars, trip_expenses, trip_transports, trip_timeline, trip_reminders
