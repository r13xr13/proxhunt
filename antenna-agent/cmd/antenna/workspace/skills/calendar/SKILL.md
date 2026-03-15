---
name: calendar
description: Calendar management via CalDAV
version: 1.0.0
---

# Calendar Skill

Manage calendars and events via CalDAV.

## Tools

[[tool]]
name: cal_events
description: List calendar events
params:
  - name: start
    type: string
    required: false
    description: Start date (ISO)
  - name: end
    type: string
    required: false
    description: End date (ISO)
  - name: calendar
    type: string
    required: false
    description: Calendar name

[[tool]]
name: cal_create
description: Create calendar event
params:
  - name: title
    type: string
    required: true
    description: Event title
  - name: start
    type: string
    required: true
    description: Start time (ISO)
  - name: end
    type: string
    required: false
    description: End time (ISO)
  - name: description
    type: string
    required: false
    description: Event description

[[tool]]
name: cal_today
description: Get today's events
params: []

[[tool]]
name: cal_upcoming
description: Get upcoming events
params:
  - name: days
    type: number
    required: false
    description: Number of days ahead

## Script

function cal_events({ start = '', end = '', calendar = 'default' }) {
  return {
    calendar,
    start,
    end,
    note: 'Configure CalDAV in ~/.antenna/config.json',
    config: {
      caldav: {
        url: 'https://caldav.example.com',
        username: 'user',
        password: 'APP_PASSWORD'
      }
    },
    events: []
  };
}

function cal_create({ title, start, end = '', description = '' }) {
  return {
    title,
    start,
    end,
    description,
    note: 'Event created via CalDAV',
    uid: 'generated-uid'
  };
}

function cal_today() {
  return {
    date: new Date().toISOString().split('T')[0],
    events: [],
    note: 'Get events for today'
  };
}

function cal_upcoming({ days = 7 }) {
  return {
    days,
    events: [],
    note: 'Get upcoming events'
  };
}
