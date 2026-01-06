import createContextHook from "@nkzw/create-context-hook";
import * as Calendar from "expo-calendar";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import type { AgentTool } from "@/types";

interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  allDay?: boolean;
}

export const [CalendarProvider, useCalendar] = createContextHook(() => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<"unknown" | "granted" | "denied" | "unavailable">("unknown");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarSharingAllowed, setCalendarSharingAllowed] = useState<boolean>(false);
  const [defaultCalendarId, setDefaultCalendarId] = useState<string | undefined>(undefined);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      console.log("[Calendar] Calendar access not supported on web");
      setPermissionStatus("unavailable");
      return false;
    }

    try {
      const { status: existingStatus } = await Calendar.getCalendarPermissionsAsync();

      if (existingStatus === "granted") {
        setPermissionStatus("granted");
        return true;
      }

      const { status } = await Calendar.requestCalendarPermissionsAsync();
      
      if (status === "granted") {
        setPermissionStatus("granted");
        
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const primaryCalendar = calendars.find(cal => cal.isPrimary || cal.allowsModifications) || calendars[0];
        
        if (primaryCalendar) {
          setDefaultCalendarId(primaryCalendar.id);
        }
        
        return true;
      } else {
        setPermissionStatus("denied");
        return false;
      }
    } catch (err) {
      console.error("[Calendar] Permission request failed:", err);
      setError((err as Error).message);
      setPermissionStatus("denied");
      return false;
    }
  }, []);

  const normalizeEvent = (event: Calendar.Event): CalendarEvent => {
    return {
      id: event.id,
      title: event.title,
      startDate: new Date(event.startDate),
      endDate: new Date(event.endDate),
      location: event.location ?? undefined,
      notes: event.notes ?? undefined,
      allDay: event.allDay,
    };
  };

  const refreshEvents = useCallback(
    async (startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> => {
      if (permissionStatus !== "granted") {
        console.log("[Calendar] Cannot refresh events: permission not granted");
        return [];
      }

      setLoading(true);
      setError(null);

      try {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        
        if (calendars.length === 0) {
          console.log("[Calendar] No calendars found");
          setEvents([]);
          return [];
        }

        const start = startDate || new Date();
        const end = endDate || new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

        const fetchedEvents = await Calendar.getEventsAsync(
          calendars.map(cal => cal.id),
          start,
          end
        );

        const normalized = fetchedEvents.map(normalizeEvent);
        setEvents(normalized);
        
        console.log(`[Calendar] Loaded ${normalized.length} events`);
        return normalized;
      } catch (err) {
        console.error("[Calendar] Failed to refresh events:", err);
        setError((err as Error).message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [permissionStatus]
  );

  const searchEvents = useCallback(
    (query: string, startDate?: Date, endDate?: Date): CalendarEvent[] => {
      if (!query) {
        return events;
      }

      const lowerQuery = query.toLowerCase();
      
      let filtered = events.filter(event => {
        const titleMatch = event.title.toLowerCase().includes(lowerQuery);
        const locationMatch = event.location?.toLowerCase().includes(lowerQuery);
        const notesMatch = event.notes?.toLowerCase().includes(lowerQuery);
        
        return titleMatch || locationMatch || notesMatch;
      });

      if (startDate) {
        filtered = filtered.filter(event => event.startDate >= startDate);
      }

      if (endDate) {
        filtered = filtered.filter(event => event.endDate <= endDate);
      }

      return filtered;
    },
    [events]
  );

  const createEvent = useCallback(
    async (
      title: string,
      startDate: Date,
      endDate: Date,
      location?: string,
      notes?: string
    ): Promise<{ success: boolean; eventId?: string; error?: string }> => {
      if (permissionStatus !== "granted") {
        return { success: false, error: "Calendar permission not granted" };
      }

      if (!defaultCalendarId) {
        return { success: false, error: "No default calendar found" };
      }

      try {
        const eventId = await Calendar.createEventAsync(defaultCalendarId, {
          title,
          startDate,
          endDate,
          location,
          notes,
          timeZone: "GMT" as any,
        });

        await refreshEvents();
        
        return { success: true, eventId };
      } catch (err) {
        console.error("[Calendar] Failed to create event:", err);
        return { success: false, error: (err as Error).message };
      }
    },
    [permissionStatus, defaultCalendarId, refreshEvents]
  );

  useEffect(() => {
    const checkPermission = async () => {
      if (Platform.OS === "web") {
        setPermissionStatus("unavailable");
        return;
      }

      try {
        const { status } = await Calendar.getCalendarPermissionsAsync();
        
        if (status === "granted") {
          setPermissionStatus("granted");
          
          const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
          const primaryCalendar = calendars.find(cal => cal.isPrimary || cal.allowsModifications) || calendars[0];
          
          if (primaryCalendar) {
            setDefaultCalendarId(primaryCalendar.id);
          }
          
          await refreshEvents();
        } else {
          setPermissionStatus(status === "denied" ? "denied" : "unknown");
        }
      } catch (err) {
        console.error("[Calendar] Failed to check permission:", err);
        setPermissionStatus("unknown");
      }
    };

    checkPermission();
  }, [refreshEvents]);

  const calendarSearchTool: AgentTool<
    { query?: string; startDate?: string; endDate?: string; limit?: number },
    { results: CalendarEvent[]; error?: string }
  > = {
    name: "calendar_search",
    description: "Searches device calendar events by title, location, or notes within a date range. Returns event details including title, date, time, and location when calendar sharing is enabled.",
    parameters: {
      query: {
        type: "string",
        description: "Search term to match against event title, location, or notes (optional)",
        required: false,
      },
      startDate: {
        type: "string",
        description: "ISO date string for start of search range (optional, defaults to today)",
        required: false,
      },
      endDate: {
        type: "string",
        description: "ISO date string for end of search range (optional, defaults to 30 days from start)",
        required: false,
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (optional, defaults to 20)",
        required: false,
      },
    },
    execute: async (params) => {
      if (!calendarSharingAllowed) {
        return {
          results: [],
          error: "Calendar sharing is not enabled. Please enable it in settings.",
        };
      }

      if (permissionStatus !== "granted") {
        return {
          results: [],
          error: "Calendar permission not granted. Please grant permission to access calendar.",
        };
      }

      try {
        const start = params.startDate ? new Date(params.startDate) : new Date();
        const end = params.endDate ? new Date(params.endDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

        await refreshEvents(start, end);

        let results = params.query ? searchEvents(params.query, start, end) : events;

        if (params.limit && params.limit > 0) {
          results = results.slice(0, params.limit);
        }

        return { results };
      } catch (err) {
        return {
          results: [],
          error: `Failed to search calendar: ${(err as Error).message}`,
        };
      }
    },
  };

  const calendarCreateTool: AgentTool<
    { title: string; startDate: string; endDate: string; location?: string; notes?: string },
    { success: boolean; eventId?: string; error?: string }
  > = {
    name: "calendar_create",
    description: "Creates a new calendar event with the specified details. Requires user confirmation before creating the event.",
    parameters: {
      title: {
        type: "string",
        description: "Title of the event",
        required: true,
      },
      startDate: {
        type: "string",
        description: "ISO date string for event start time",
        required: true,
      },
      endDate: {
        type: "string",
        description: "ISO date string for event end time",
        required: true,
      },
      location: {
        type: "string",
        description: "Location of the event (optional)",
        required: false,
      },
      notes: {
        type: "string",
        description: "Additional notes for the event (optional)",
        required: false,
      },
    },
    execute: async (params) => {
      if (!calendarSharingAllowed) {
        return {
          success: false,
          error: "Calendar sharing is not enabled. Please enable it in settings.",
        };
      }

      if (permissionStatus !== "granted") {
        return {
          success: false,
          error: "Calendar permission not granted. Please grant permission to access calendar.",
        };
      }

      try {
        const start = new Date(params.startDate);
        const end = new Date(params.endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return {
            success: false,
            error: "Invalid date format. Please provide valid ISO date strings.",
          };
        }

        if (end <= start) {
          return {
            success: false,
            error: "End date must be after start date.",
          };
        }

        return await createEvent(params.title, start, end, params.location, params.notes);
      } catch (err) {
        return {
          success: false,
          error: `Failed to create event: ${(err as Error).message}`,
        };
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
