import { useState, useEffect } from 'react';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string | null;
  notes?: string | null;
  allDay: boolean;
  calendarId: string;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  execute: (params: any) => Promise<any>;
}

export const [CalendarProvider, useCalendar] = createContextHook(() => {
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'denied' | 'granted'>('undetermined');
  const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [calendarSharingAllowed, setCalendarSharingAllowed] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === 'web') {
      setPermissionStatus('denied');
      return;
    }

    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      setHasPermission(status === 'granted');
      setPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined');
      
      if (status === 'granted') {
        await loadCalendars();
      }
    } catch (error) {
      console.error('[CalendarProvider] Error checking permission:', error);
      setPermissionStatus('denied');
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.log('[CalendarProvider] Calendar not supported on web');
      return false;
    }

    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      setPermissionStatus(granted ? 'granted' : 'denied');
      
      if (granted) {
        await loadCalendars();
      }
      
      return granted;
    } catch (error) {
      console.error('[CalendarProvider] Error requesting permission:', error);
      setPermissionStatus('denied');
      return false;
    }
  };

  const loadCalendars = async () => {
    if (!hasPermission) return;

    try {
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      setCalendars(cals);
      console.log('[CalendarProvider] Loaded calendars:', cals.length);
    } catch (error) {
      console.error('[CalendarProvider] Error loading calendars:', error);
    }
  };

  const getEvents = async (
    startDate: Date,
    endDate: Date,
    calendarIds?: string[]
  ): Promise<CalendarEvent[]> => {
    if (!hasPermission) {
      console.warn('[CalendarProvider] No calendar permission');
      return [];
    }

    try {
      const ids = calendarIds || calendars.map(c => c.id);
      const events = await Calendar.getEventsAsync(ids, startDate, endDate);
      
      const mappedEvents = events.map(event => ({
        id: event.id,
        title: event.title,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        location: event.location ?? null,
        notes: event.notes ?? null,
        allDay: event.allDay,
        calendarId: event.calendarId
      }));
      
      setEvents(mappedEvents);
      return mappedEvents;
    } catch (error) {
      console.error('[CalendarProvider] Error getting events:', error);
      setError(error instanceof Error ? error.message : 'Failed to load events');
      return [];
    }
  };

  const refreshEvents = async (startDate: Date, endDate: Date) => {
    setIsLoading(true);
    setError(null);
    try {
      await getEvents(startDate, endDate);
    } finally {
      setIsLoading(false);
    }
  };

  const searchEvents = async (
    query: string,
    daysAhead: number = 30
  ): Promise<CalendarEvent[]> => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    const events = await getEvents(startDate, endDate);
    
    if (!query.trim()) return events;

    const lowerQuery = query.toLowerCase();
    return events.filter(event => 
      event.title.toLowerCase().includes(lowerQuery) ||
      event.location?.toLowerCase().includes(lowerQuery) ||
      event.notes?.toLowerCase().includes(lowerQuery)
    );
  };

  const createEvent = async (
    calendarId: string,
    title: string,
    startDate: Date,
    endDate: Date,
    options?: {
      location?: string;
      notes?: string;
      allDay?: boolean;
    }
  ): Promise<string | null> => {
    if (!hasPermission) {
      console.warn('[CalendarProvider] No calendar permission');
      return null;
    }

    try {
      const eventId = await Calendar.createEventAsync(calendarId, {
        title,
        startDate,
        endDate,
        location: options?.location,
        notes: options?.notes,
        allDay: options?.allDay ?? false,
        timeZone: 'GMT'
      });
      
      console.log('[CalendarProvider] Event created:', eventId);
      return eventId;
    } catch (error) {
      console.error('[CalendarProvider] Error creating event:', error);
      return null;
    }
  };

  const calendarSearchTool: AgentTool = {
    name: 'calendar_search',
    description: 'Searches device calendar events by keyword or date range. Returns upcoming events when sharing is enabled. Use this to check the user\'s schedule, find meetings, or answer questions about their availability.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term to filter events (title, location, notes)'
        },
        daysAhead: {
          type: 'number',
          description: 'Number of days to look ahead (default: 30)'
        }
      },
      required: []
    },
    execute: async (params: { query?: string; daysAhead?: number }) => {
      console.log('[CalendarTool] Executing calendar_search with params:', params);

      if (!calendarSharingAllowed) {
        return {
          error: 'Calendar access not enabled',
          message: 'User has not granted calendar sharing permission to AI'
        };
      }

      if (permissionStatus !== 'granted') {
        return {
          error: 'Permission denied',
          message: 'Calendar permission not granted by system'
        };
      }

      setIsLoading(true);
      try {
        const events = await searchEvents(
          params.query || '',
          params.daysAhead || 30
        );

        return {
          success: true,
          count: events.length,
          events: events.map(e => ({
            id: e.id,
            title: e.title,
            startDate: e.startDate.toISOString(),
            endDate: e.endDate.toISOString(),
            location: e.location,
            allDay: e.allDay,
            notes: e.notes
          }))
        };
      } catch (error) {
        return {
          error: 'Search failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      } finally {
        setIsLoading(false);
      }
    }
  };

  const calendarCreateTool: AgentTool = {
    name: 'calendar_create',
    description: 'Creates a new calendar event. Use this to schedule meetings, appointments, or reminders when requested by the user.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Event title'
        },
        startDate: {
          type: 'string',
          description: 'Start date/time in ISO format'
        },
        endDate: {
          type: 'string',
          description: 'End date/time in ISO format'
        },
        location: {
          type: 'string',
          description: 'Event location'
        },
        notes: {
          type: 'string',
          description: 'Additional notes'
        },
        allDay: {
          type: 'boolean',
          description: 'Whether this is an all-day event'
        }
      },
      required: ['title', 'startDate', 'endDate']
    },
    execute: async (params: {
      title: string;
      startDate: string;
      endDate: string;
      location?: string;
      notes?: string;
      allDay?: boolean;
    }) => {
      console.log('[CalendarTool] Executing calendar_create with params:', params);

      if (!calendarSharingAllowed) {
        return {
          error: 'Calendar access not enabled',
          message: 'User has not granted calendar sharing permission to AI'
        };
      }

      if (permissionStatus !== 'granted') {
        return {
          error: 'Permission denied',
          message: 'Calendar permission not granted by system'
        };
      }

      if (calendars.length === 0) {
        return {
          error: 'No calendars available',
          message: 'No calendars found on device'
        };
      }

      const defaultCalendar = calendars.find(c => c.allowsModifications) || calendars[0];

      setIsLoading(true);
      try {
        const eventId = await createEvent(
          defaultCalendar.id,
          params.title,
          new Date(params.startDate),
          new Date(params.endDate),
          {
            location: params.location,
            notes: params.notes,
            allDay: params.allDay
          }
        );

        if (!eventId) {
          return {
            error: 'Creation failed',
            message: 'Failed to create calendar event'
          };
        }

        return {
          success: true,
          eventId,
          message: `Event "${params.title}" created successfully`
        };
      } catch (error) {
        return {
          error: 'Creation failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      } finally {
        setIsLoading(false);
      }
    }
  };

  return {
    hasPermission,
    permissionStatus,
    calendars,
    isLoading,
    loading: isLoading,
    events,
    error,
    calendarSharingAllowed,
    setCalendarSharingAllowed,
    requestPermission,
    refreshCalendars: loadCalendars,
    refreshEvents,
    getEvents,
    searchEvents,
    createEvent,
    calendarSearchTool,
    calendarCreateTool
  };
});
