function SyncCalendarsIntoOne() {
  // Midnight today
  const startTime = new Date();
  startTime.setHours(0, 0, 0, 0);
  startTime.setDate(startTime.getDate() - SYNC_DAYS_IN_PAST + 1);

  const endTime = new Date();
  endTime.setHours(0, 0, 0, 0);
  endTime.setDate(endTime.getDate() + SYNC_DAYS_IN_FUTURE + 1);

  // Delete old events
  const deleteStartTime = new Date();
  deleteStartTime.setHours(0, 0, 0, 0);
  deleteStartTime.setDate(deleteStartTime.getDate() - SYNC_DAYS_IN_PAST);

  deleteEvents(deleteStartTime, endTime);
  createEvents(startTime, endTime);
}

// Delete any old events that have been already cloned over.
// This is basically a sync w/o finding and updating. Just deleted and recreate.
function deleteEvents(startTime, endTime) {
  const sharedCalendar = CalendarApp.getCalendarById(CALENDAR_TO_MERGE_INTO);

  // Find events with the search character in the title.
  // The `.filter` method is used since the getEvents method seems to return all events at the moment. It's a safety check.
  const events = sharedCalendar
    .getEvents(startTime, endTime, { search: SEARCH_CHARACTER })
    .filter((event) => event.getTitle().includes(SEARCH_CHARACTER));

  const requestBody = events.map((e, i) => ({
    method: 'DELETE',
    endpoint: `${ENDPOINT_BASE}/${CALENDAR_TO_MERGE_INTO}/events/${e
      .getId()
      .replace('@google.com', '')}`,
  }));

  if (requestBody && requestBody.length) {
    const result = new BatchRequest({
      useFetchAll: true,
      batchPath: 'batch/calendar/v3',
      requests: requestBody,
    });

    if (result.length !== requestBody.length) {
      console.log(result);
    }

    console.log(`${result.length} deleted events.`);
  } else {
    console.log('No events to delete.');
  }
}

function createEvents(startTime, endTime) {
  let requestBody = [];

  for (let calendarName in CALENDARS_TO_MERGE) {
    const calendarId = CALENDARS_TO_MERGE[calendarName];
    const calendarToCopy = CalendarApp.getCalendarById(calendarId);

    if (!calendarToCopy) {
      console.log("Calendar not found: '%s'.", calendarId);
      continue;
    }

    // Find events
    const events = Calendar.Events.list(calendarId, {
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    // If nothing find, move to next calendar
    if (!(events.items && events.items.length > 0)) {
      continue;
    }
    events.items.forEach((event) => {
      // Only show summaries for work shifts
      if (calendarName.match(YOUR_WORK_CALENDAR_RE) && event.summary.match(YOUR_WORK_SUMMARY_RE)) {
          requestBody.push({
            method: 'POST',
            endpoint: `${ENDPOINT_BASE}/${CALENDAR_TO_MERGE_INTO}/events`,
            requestBody: {
              summary: `${SEARCH_CHARACTER}${calendarName} - ${event.summary}`,
              start: {
                date: event.start.date,
                time: event.start.time,
                dateTime: event.start.dateTime,
                timeZone: event.start.timeZone,
              },
              end: {
                date: event.end.date,
                time: event.end.time,
                dateTime: event.end.dateTime,
                timeZone: event.end.timeZone,
              },
            },
          })
      } else if (calendarName.match(MY_WORK_CALENDAR_RE) && event.summary.match(MY_WORK_SUMMARY_RE)) {
          requestBody.push({
            method: 'POST',
            endpoint: `${ENDPOINT_BASE}/${CALENDAR_TO_MERGE_INTO}/events`,
            requestBody: {
              summary: `${SEARCH_CHARACTER}${calendarName} - ${event.summary}`,
              start: {
                date: event.start.date,
                time: event.start.time,
                dateTime: event.start.dateTime,
                timeZone: event.start.timeZone,
              },
              end: {
                date: event.end.date,
                time: event.end.time,
                dateTime: event.end.dateTime,
                timeZone: event.end.timeZone,
              },
            },
          });
      // Everything else does not show a summary
      } else {
        // If the event is not marked as busy, ignore it
        if ( !event.transparency || event.transparency !== 'transparent') {
          requestBody.push({
            method: 'POST',
            endpoint: `${ENDPOINT_BASE}/${CALENDAR_TO_MERGE_INTO}/events`,
            requestBody: {
              summary: `${SEARCH_CHARACTER}${calendarName}`,
              start: {
                date: event.start.date,
                time: event.start.time,
                dateTime: event.start.dateTime,
                timeZone: event.start.timeZone,
              },
              end: {
                date: event.end.date,
                time: event.end.time,
                dateTime: event.end.dateTime,
                timeZone: event.end.timeZone,
              },
            },
          });
        }
      }
    });
  }

  if (requestBody && requestBody.length) {
    const result = new BatchRequest({
      batchPath: 'batch/calendar/v3',
      requests: requestBody,
    });

    if (result.length !== requestBody.length) {
      console.log(result);
    }

    console.log(`${result.length} events created.`);
  } else {
    console.log('No events to create.');
  }
}
