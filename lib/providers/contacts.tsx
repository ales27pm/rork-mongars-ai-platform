import createContextHook from "@nkzw/create-context-hook";
import * as Contacts from "expo-contacts";
import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import type { AgentTool, DeviceContact } from "@/types";

const MAX_CONTACTS = 500;
const PAGE_SIZE = 200;

interface ContactsContextValue {
  contacts: DeviceContact[];
  permissionStatus: "unknown" | "granted" | "denied" | "unavailable";
  loading: boolean;
  error: string | null;
  contactSharingAllowed: boolean;
  setContactSharingAllowed: (allowed: boolean) => void;
  requestPermission: () => Promise<boolean>;
  refreshContacts: () => Promise<DeviceContact[]>;
  findContactByName: (query: string, limit?: number) => DeviceContact[];
  contactsTool: AgentTool<
    { query: string; limit?: number },
    { results: DeviceContact[]; error?: string }
  >;
}

type StoredContact = DeviceContact & { searchKey: string };

const normalizeContact = (contact: Contacts.Contact): StoredContact | null => {
  const derivedName = [contact.firstName, contact.middleName, contact.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const name = contact.name || derivedName;
  if (!name) return null;

  const phoneNumbers = (contact.phoneNumbers || [])
    .map((entry) => entry.number)
    .filter((value): value is string => Boolean(value));
  const emails = (contact.emails || [])
    .map((entry) => entry.email)
    .filter((value): value is string => Boolean(value));

  return {
    id: contact.id,
    name,
    phoneNumbers,
    emails,
    searchKey: name.toLowerCase(),
  };
};

export const [ContactsProvider, useContacts] =
  createContextHook<ContactsContextValue>(() => {
    const [contacts, setContacts] = useState<StoredContact[]>([]);
  >("unknown");

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.getPermissionsAsync();
      const granted =
        status === Contacts.PermissionStatus.GRANTED || status === "granted";
      setPermissionStatus(granted ? "granted" : "denied");
    })();
  }, []);
      "unknown" | "granted" | "denied" | "unavailable"
    >("unknown");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [contactSharingAllowed, setContactSharingAllowed] = useState(false);

    const requestPermission = useCallback(async () => {
      if (Platform.OS === "web") {
        setPermissionStatus("unavailable");
        setError("Contacts are not available on web");
        return false;
      }

      try {
      setPermissionStatus(granted ? "granted" : "denied");
      if (granted) setError(null);
      return granted;
          status === Contacts.PermissionStatus.GRANTED || status === "granted";
        setPermissionStatus(granted ? "granted" : "denied");
        return granted;
      } catch (permissionError) {
        console.error(
          "[Contacts] Failed to request permission",
          permissionError,
        );
        setPermissionStatus("denied");
        setError("Unable to request contacts permission");
        return false;
      }
    }, []);

    const refreshContacts = useCallback(async (): Promise<DeviceContact[]> => {
      if (Platform.OS === "web") {
        setContacts([]);
        setPermissionStatus("unavailable");
        setError("Contacts are not available on web");
        return [];
      }

      setLoading(true);
      setError(null);

      const granted =
        permissionStatus === "granted" || (await requestPermission());
      if (!granted) {
        setLoading(false);
        setContacts([]);
        return [];
      }

      try {
        let pageOffset = 0;
        let hasNextPage = true;
        const collected: StoredContact[] = [];

        while (hasNextPage && collected.length < MAX_CONTACTS) {
          const pageSize = Math.min(PAGE_SIZE, MAX_CONTACTS - collected.length);
          const result = await Contacts.getContactsAsync({
            fields: [
              Contacts.Fields.Name,
              Contacts.Fields.PhoneNumbers,
              Contacts.Fields.Emails,
            ],
            pageOffset,
            pageSize,
          });

          const mapped = result.data
            .map(normalizeContact)
            .filter((item): item is StoredContact => Boolean(item));

          collected.push(...mapped);
          hasNextPage = Boolean(
            result.hasNextPage && collected.length < MAX_CONTACTS,
          );
          pageOffset += pageSize;

          if (!result.hasNextPage) break;
        }

        setContacts(collected);
        return collected.map(({ searchKey, ...rest }) => rest);
      } catch (fetchError) {
        console.error("[Contacts] Failed to load contacts", fetchError);
        setError("Failed to load contacts. Please try again.");
        return [];
      } finally {
        setLoading(false);
      }
    }, [permissionStatus, requestPermission]);

    const findContactByName = useCallback(
      (query: string, limit: number = 5): DeviceContact[] => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return [];

        const matches = contacts
          .map((contact) => ({
            contact,
            score: contact.searchKey.indexOf(normalizedQuery),
          }))
          .filter((entry) => entry.score !== -1)
          .sort((a, b) => a.score - b.score)
          .slice(0, Math.max(1, limit))
          .map(({ contact }) => ({
            id: contact.id,
            name: contact.name,
            phoneNumbers: contact.phoneNumbers,
            emails: contact.emails,
          }));

        return matches;
      },
      [contacts],
    );

    const contactsTool = useMemo(
      (): ContactsContextValue["contactsTool"] => ({
        name: "contacts_search",
        description:
          "Searches device contacts by name and returns details to the calling AI model when sharing is enabled",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Name or partial name to look for",
            },
            limit: {
              type: "number",
              description: "Maximum number of matches to return",
              minimum: 1,
              maximum: 20,
            },
          },
          required: ["query"],
        },
        execute: async ({ query, limit = 5 }) => {
          if (Platform.OS === "web") {
            return { results: [], error: "Contacts are not available on web" };
          }

          if (!contactSharingAllowed) {
            return {
              results: [],
              error: "Contact sharing with the AI model is disabled by the user",
            };
          }

          const granted =
            permissionStatus === "granted" || (await requestPermission());
          if (!granted) {
            return { results: [], error: "Contacts permission not granted" };
          }

          if (contacts.length === 0 && !loading) {
            await refreshContacts();
          }

          const results = findContactByName(query, limit);
          return { results };
        },
      }),
      [
        contacts.length,
        findContactByName,
        contactSharingAllowed,
        loading,
        permissionStatus,
        refreshContacts,
        requestPermission,
      ],
    );

    const publicContacts = useMemo(
      () => contacts.map(({ searchKey, ...rest }) => rest),
      [contacts],
    );

    return {
      contacts: publicContacts,
      permissionStatus,
      loading,
      error,
      contactSharingAllowed,
      setContactSharingAllowed,
      requestPermission,
      refreshContacts,
      findContactByName,
      contactsTool,
    };
  });
