import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useState, useRef } from "react";
import {
  webScraperService,
  type WebSearchResult,
  type WebPageContent,
} from "@/lib/services/WebScraperService";

export interface WebSearchState {
  isSearching: boolean;
  isFetching: boolean;
  lastQuery: string | null;
  lastResults: WebSearchResult[];
  lastError: string | null;
}

export interface WebBrowsingHistory {
  query: string;
  results: WebSearchResult[];
  timestamp: number;
  sources: string[];
}

export const [WebScraperProvider, useWebScraper] = createContextHook(() => {
  const [state, setState] = useState<WebSearchState>({
    isSearching: false,
    isFetching: false,
    lastQuery: null,
    lastResults: [],
    lastError: null,
  });

  const browsingHistory = useRef<WebBrowsingHistory[]>([]);
  const [webBrowsingEnabled, setWebBrowsingEnabled] = useState(true);

  const searchWeb = useCallback(async (query: string): Promise<WebSearchResult[]> => {
    if (!webBrowsingEnabled) {
      console.log("[WebScraper] Web browsing is disabled");
      return [];
    }

    console.log(`[WebScraper] Starting web search: "${query}"`);
    setState(prev => ({
      ...prev,
      isSearching: true,
      lastQuery: query,
      lastError: null,
    }));

    try {
      const results = await webScraperService.searchWeb(query);
      
      setState(prev => ({
        ...prev,
        isSearching: false,
        lastResults: results,
      }));

      browsingHistory.current.push({
        query,
        results,
        timestamp: Date.now(),
        sources: results.map(r => r.url),
      });

      if (browsingHistory.current.length > 50) {
        browsingHistory.current = browsingHistory.current.slice(-50);
      }

      console.log(`[WebScraper] Search complete: ${results.length} results`);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      console.error("[WebScraper] Search error:", error);
      
      setState(prev => ({
        ...prev,
        isSearching: false,
        lastError: errorMessage,
      }));

      return [];
    }
  }, [webBrowsingEnabled]);

  const fetchPage = useCallback(async (url: string): Promise<WebPageContent> => {
    if (!webBrowsingEnabled) {
      console.log("[WebScraper] Web browsing is disabled");
      return {
        url,
        title: 'Disabled',
        content: '',
        excerpt: '',
        fetchedAt: Date.now(),
        success: false,
        error: 'Web browsing is disabled',
      };
    }

    console.log(`[WebScraper] Fetching page: ${url}`);
    setState(prev => ({ ...prev, isFetching: true, lastError: null }));

    try {
      const content = await webScraperService.fetchPage(url);
      
      setState(prev => ({ ...prev, isFetching: false }));
      
      console.log(`[WebScraper] Page fetched: ${content.title}`);
      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fetch failed';
      console.error("[WebScraper] Fetch error:", error);
      
      setState(prev => ({
        ...prev,
        isFetching: false,
        lastError: errorMessage,
      }));

      return {
        url,
        title: 'Error',
        content: '',
        excerpt: '',
        fetchedAt: Date.now(),
        success: false,
        error: errorMessage,
      };
    }
  }, [webBrowsingEnabled]);

  const searchAndSummarize = useCallback(async (query: string): Promise<{
    query: string;
    results: WebSearchResult[];
    summary: string;
    sources: string[];
  }> => {
    if (!webBrowsingEnabled) {
      return {
        query,
        results: [],
        summary: 'Web browsing is disabled.',
        sources: [],
      };
    }

    console.log(`[WebScraper] Search and summarize: "${query}"`);
    setState(prev => ({
      ...prev,
      isSearching: true,
      isFetching: true,
      lastQuery: query,
      lastError: null,
    }));

    try {
      const result = await webScraperService.searchAndSummarize(query);
      
      setState(prev => ({
        ...prev,
        isSearching: false,
        isFetching: false,
        lastResults: result.results,
      }));

      browsingHistory.current.push({
        query,
        results: result.results,
        timestamp: Date.now(),
        sources: result.sources,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      console.error("[WebScraper] Search and summarize error:", error);
      
      setState(prev => ({
        ...prev,
        isSearching: false,
        isFetching: false,
        lastError: errorMessage,
      }));

      return {
        query,
        results: [],
        summary: `Error: ${errorMessage}`,
        sources: [],
      };
    }
  }, [webBrowsingEnabled]);

  const getBrowsingHistory = useCallback(() => {
    return [...browsingHistory.current];
  }, []);

  const clearHistory = useCallback(() => {
    browsingHistory.current = [];
    webScraperService.clearCache();
    setState(prev => ({
      ...prev,
      lastQuery: null,
      lastResults: [],
      lastError: null,
    }));
    console.log("[WebScraper] History and cache cleared");
  }, []);

  const getCacheStats = useCallback(() => {
    return webScraperService.getCacheStats();
  }, []);

  const toggleWebBrowsing = useCallback((enabled: boolean) => {
    setWebBrowsingEnabled(enabled);
    console.log(`[WebScraper] Web browsing ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  return {
    ...state,
    webBrowsingEnabled,
    searchWeb,
    fetchPage,
    searchAndSummarize,
    getBrowsingHistory,
    clearHistory,
    getCacheStats,
    toggleWebBrowsing,
  };
});
