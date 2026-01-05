import createContextHook from "@nkzw/create-context-hook";
import * as Calendar from "expo-calendar";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import type { AgentTool } from "@/types";

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
  allDay: boolean;
}

interface CalendarContextValue {
  events: CalendarEvent[];
  permissionStatus: "unknown" | "granted" | "denied" | "unavailable";
  loading: boolean;
  error: string | null;
  calendarSharingAllowed: boolean;
  setCalendarSharingAllowed: (allowed: boolean) => void;
  requestPermission: () => Promise<boolean>;
  refreshEvents: (startDate: Date, endDate: Date) => Promise<CalendarEvent[]>;
  searchEvents: (query: string, startDate?: Date, endDate?: Date) => Promise<CalendarEvent[]>;
  calendarSearchTool: AgentTool<
    { query?: string; startDate?: string; endDate?: string },
    { results: CalendarEvent[]; error?: string }
  >;
  calendarCreateTool: AgentTool<
    { title: string; startDate: string; endDate: string; location?: string; notes?: string },
    { success: boolean; eventId?: string; error?: string }
  >;
}

export const [CalendarProvider, useCalendar] = createContextHook<CalendarContextValue>(() => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<"unknown" | "granted" | "denied" | "unavailable">("unknown");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarSharingAllowed, setCalendarSharingAllowed] = useState(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        setPermissionStatus("unavailable");
        return;
      }

      try {
        const { status } = await Calendar.getCalendarPermissionsAsync();
        setPermissionStatus(status === Calendar.PermissionStatus.GRANTED ? "granted" : "denied");
      } catch (err) {
        console.error("[Calendar] Failed to check permissions", err);
        setPermissionStatus("unavailable");
      }
    })();
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      setPermissionStatus("unavailable");
      setError("Calendar is not available on web");
      return false;
    }

    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      const granted = status === Calendar.PermissionStatus.GRANTED;
      setPermissionStatus(granted ? "granted" : "denied");
      if (granted) setError(null);
      return granted;
    } catch (err) {
      console.error("[Calendar] Failed to request permission", err);
      setPermissionStatus("denied");
      setError("Unable to request calendar permission");
      return false;
    }
  }, []);

  const refreshEvents = useCallback(async (startDate: Date, endDate: Date): Promise<CalendarEvent[]> => {
    if (Platform.OS === "web") {
      setEvents([]);
      setPermissionStatus("unavailable");
      setError("Calendar is not available on web");
      return [];
    }

    setLoading(true);
    setError(null);

    const granted = permissionStatus === "granted" || await requestPermission();
    if (!granted) {
      setLoading(false);
      setEvents([]);
      return [];
    }

    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      
      if (calendars.length === 0) {
        console.log("[Calendar] No calendars found");
        setEvents([]);
        setLoading(false);
        return [];
      }

      const calendarIds = calendars.map(cal => cal.id);
      const fetchedEvents = await Calendar.getEventsAsync(calendarIds, startDate, endDate);

      const normalizedEvents: CalendarEvent[] = fetchedEvents.map(event => ({
        id: event.id,
        title: event.title,
        startDate: typeof event.startDate === 'string' ? event.startDate : event.startDate.toISOString(),
        endDate: typeof event.endDate === 'string' ? event.endDate : event.endDate.toISOString(),
        location: event.location || undefined,
        notes: event.notes || undefined,
        allDay: event.allDay || false,
      }));

      setEvents(normalizedEvents);
      return normalizedEvents;
    } catch (err) {
      console.error("[Calendar] Failed to load events", err);
      setError("Failed to load calendar events. Please try again.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [permissionStatus, requestPermission]);

  const searchEvents = useCallback(async (query: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> => {
    const start = startDate || new Date();
    const end = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const allEvents = await refreshEvents(start, end);
    
    if (!query.trim()) {
      return allEvents;
    }

    const normalizedQuery = query.toLowerCase();
    return allEvents.filter(event => 
      event.title.toLowerCase().includes(normalizedQuery) ||
      (event.location && event.location.toLowerCase().includes(normalizedQuery)) ||
      (event.notes && event.notes.toLowerCase().includes(normalizedQuery))
    );
  }, [refreshEvents]);

  const calendarSearchTool: CalendarContextValue["calendarSearchTool"] = {
    name: "calendar_search",
    description: "Searches calendar events by title, location, or notes within a date range when calendar sharing is enabled",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search term to find in event titles, locations, or notes (optional)",
        },
        startDate: {
          type: "string",
          description: "Start date in ISO format (defaults to today)",
        },
        endDate: {
          type: "string",
          description: "End date in ISO format (defaults to 30 days from now)",
        },
      },
      required: [],
    },
    execute: async ({ query = "", startDate, endDate }) => {
      if (Platform.OS === "web") {
        return { results: [], error: "Calendar is not available on web" };
      }

      if (!calendarSharingAllowed) {
        return {
          results: [],
          error: "Calendar sharing with the AI model is disabled by the user",
        };
      }

      const granted = permissionStatus === "granted" || await requestPermission();
      if (!granted) {
        return { results: [], error: "Calendar permission not granted" };
      }

      try {
        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const results = await searchEvents(query, start, end);
        return { results };
      } catch (err) {
        return { results: [], error: err instanceof Error ? err.message : "Failed to search calendar" };
      }
    },
  };

  const calendarCreateTool: CalendarContextValue["calendarCreateTool"] = {
    name: "calendar_create",
    description: "Creates a new calendar event when calendar access is enabled",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Event title",
        },
        startDate: {
          type: "string",
          description: "Start date/time in ISO format",
        },
        endDate: {
          type: "string",
          description: "End date/time in ISO format",
        },
        location: {
          type: "string",
          description: "Event location (optional)",
        },
        notes: {
          type: "string",
          description: "Event notes (optional)",
        },
      },
      required: ["title", "startDate", "endDate"],
    },
    execute: async ({ title, startDate, endDate, location, notes }) => {
      if (Platform.OS === "web") {
        return { success: false, error: "Calendar is not available on web" };
      }

      if (!calendarSharingAllowed) {
        return {
          success: false,
          error: "Calendar access is disabled by the user",
        };
      }

      const granted = permissionStatus === "granted" || await requestPermission();
      if (!granted) {
        return { success: false, error: "Calendar permission not granted" };
      }

      try {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const defaultCalendar = calendars.find(cal => cal.allowsModifications) || calendars[0];

        if (!defaultCalendar) {
          return { success: false, error: "No writable calendar found" };
        }

        const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
          title,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          location,
          notes,
        });

        return { success: true, eventId };
      } catch (err) {
        console.error("[Calendar] Failed to create event", err);
        return { success: false, error: err instanceof Error ? err.message : "Failed to create event" };
      }
    },
  };

  return {
    events,
    permissionStatus,
    loading,
    error,
    calendarSharingAllowed,
    setCalendarSharingAllowed,
    requestPermission,
    refreshEvents,
    searchEvents,
    calendarSearchTool,
    calendarCreateTool,
  };
});
