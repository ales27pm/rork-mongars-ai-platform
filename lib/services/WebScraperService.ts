export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebPageContent {
  url: string;
  title: string;
  content: string;
  excerpt: string;
  fetchedAt: number;
  success: boolean;
  error?: string;
}

export interface SearchOptions {
  maxResults?: number;
  timeoutMs?: number;
}

export interface FetchOptions {
  maxContentLength?: number;
  timeoutMs?: number;
  extractMainContent?: boolean;
}

const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  maxResults: 5,
  timeoutMs: 10000,
};

const DEFAULT_FETCH_OPTIONS: FetchOptions = {
  maxContentLength: 50000,
  timeoutMs: 15000,
  extractMainContent: true,
};

const USER_AGENT = 'Mozilla/5.0 (compatible; monGARS/1.0; +https://mongars.app)';

class WebScraperService {
  private cache: Map<string, { data: WebPageContent; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000;

  private cleanHtml(html: string): string {
    let text = html;
    
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
    text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
    text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
    text = text.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');
    text = text.replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');
    
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    
    text = text.replace(/<[^>]+>/g, ' ');
    
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&[a-zA-Z0-9#]+;/g, '');
    
    text = text.replace(/\s+/g, ' ');
    text = text.trim();
    
    return text;
  }

  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      return this.cleanHtml(titleMatch[1]).trim();
    }
    
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      return this.cleanHtml(h1Match[1]).trim();
    }
    
    return 'Untitled Page';
  }

  private extractMainContent(html: string): string {
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      return this.cleanHtml(articleMatch[1]);
    }
    
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
      return this.cleanHtml(mainMatch[1]);
    }
    
    const contentPatterns = [
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ];
    
    for (const pattern of contentPatterns) {
      const match = html.match(pattern);
      if (match && match[1].length > 500) {
        return this.cleanHtml(match[1]);
      }
    }
    
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      return this.cleanHtml(bodyMatch[1]);
    }
    
    return this.cleanHtml(html);
  }

  private createExcerpt(content: string, maxLength: number = 300): string {
    if (content.length <= maxLength) {
      return content;
    }
    
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  async fetchPage(url: string, options: FetchOptions = {}): Promise<WebPageContent> {
    const opts = { ...DEFAULT_FETCH_OPTIONS, ...options };
    
    console.log(`[WebScraper] Fetching page: ${url}`);
    
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`[WebScraper] Cache hit for: ${url}`);
      return cached.data;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        console.log(`[WebScraper] Non-HTML content type: ${contentType}`);
      }
      
      let html = await response.text();
      
      if (html.length > (opts.maxContentLength || 50000)) {
        html = html.substring(0, opts.maxContentLength);
        console.log(`[WebScraper] Content truncated to ${opts.maxContentLength} chars`);
      }
      
      const title = this.extractTitle(html);
      const content = opts.extractMainContent 
        ? this.extractMainContent(html)
        : this.cleanHtml(html);
      const excerpt = this.createExcerpt(content);
      
      const result: WebPageContent = {
        url,
        title,
        content,
        excerpt,
        fetchedAt: Date.now(),
        success: true,
      };
      
      this.cache.set(url, { data: result, timestamp: Date.now() });
      
      console.log(`[WebScraper] Successfully fetched: ${title} (${content.length} chars)`);
      
      return result;
    } catch (error) {
      console.error(`[WebScraper] Fetch error for ${url}:`, error);
      
      return {
        url,
        title: 'Error',
        content: '',
        excerpt: '',
        fetchedAt: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async searchWeb(query: string, options: SearchOptions = {}): Promise<WebSearchResult[]> {
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };
    
    console.log(`[WebScraper] Searching web for: "${query}"`);
    
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Search failed: HTTP ${response.status}`);
      }
      
      const html = await response.text();
      const results = this.parseDuckDuckGoResults(html, opts.maxResults || 5);
      
      console.log(`[WebScraper] Found ${results.length} search results`);
      
      return results;
    } catch (error) {
      console.error('[WebScraper] Search error:', error);
      return [];
    }
  }

  private parseDuckDuckGoResults(html: string, maxResults: number): WebSearchResult[] {
    const results: WebSearchResult[] = [];
    
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/gi;
    
    let match;
    while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
      let url = match[1];
      const title = this.cleanHtml(match[2]);
      const snippet = this.cleanHtml(match[3]);
      
      if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
        const decodedUrl = decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] || '');
        if (decodedUrl) {
          url = decodedUrl;
        }
      }
      
      if (url && title) {
        let source = 'Unknown';
        try {
          const urlObj = new URL(url);
          source = urlObj.hostname.replace('www.', '');
        } catch {
          source = url.split('/')[2] || 'Unknown';
        }
        
        results.push({
          title,
          url,
          snippet,
          source,
        });
      }
    }
    
    if (results.length === 0) {
      const linkPattern = /<a[^>]*class="[^"]*result[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<[^>]*class="[^"]*title[^"]*"[^>]*>([^<]*)</gi;
      
      while ((match = linkPattern.exec(html)) !== null && results.length < maxResults) {
        const url = match[1];
        const title = this.cleanHtml(match[2]);
        
        if (url && title && url.startsWith('http')) {
          let source = 'Unknown';
          try {
            const urlObj = new URL(url);
            source = urlObj.hostname.replace('www.', '');
          } catch {
            source = url.split('/')[2] || 'Unknown';
          }
          
          results.push({
            title,
            url,
            snippet: '',
            source,
          });
        }
      }
    }
    
    return results;
  }

  async searchAndSummarize(query: string): Promise<{
    query: string;
    results: WebSearchResult[];
    summary: string;
    sources: string[];
  }> {
    console.log(`[WebScraper] Search and summarize: "${query}"`);
    
    const searchResults = await this.searchWeb(query, { maxResults: 3 });
    
    if (searchResults.length === 0) {
      return {
        query,
        results: [],
        summary: 'No search results found for this query.',
        sources: [],
      };
    }
    
    const pageContents: WebPageContent[] = [];
    
    for (const result of searchResults.slice(0, 3)) {
      try {
        const content = await this.fetchPage(result.url, { 
          maxContentLength: 15000,
          timeoutMs: 8000,
        });
        if (content.success) {
          pageContents.push(content);
        }
      } catch (error) {
        console.error(`[WebScraper] Failed to fetch ${result.url}:`, error);
      }
    }
    
    const combinedContent = pageContents
      .map(p => `Source: ${p.title}\n${p.excerpt}`)
      .join('\n\n');
    
    const summary = combinedContent.length > 0
      ? `Found ${pageContents.length} relevant pages:\n\n${combinedContent}`
      : searchResults.map(r => `• ${r.title}: ${r.snippet}`).join('\n');
    
    return {
      query,
      results: searchResults,
      summary,
      sources: pageContents.map(p => p.url),
    };
  }

  clearCache(): void {
    this.cache.clear();
    console.log('[WebScraper] Cache cleared');
  }

  getCacheStats(): { size: number; urls: string[] } {
    return {
      size: this.cache.size,
      urls: Array.from(this.cache.keys()),
    };
  }
}

export const webScraperService = new WebScraperService();
