export type HuggingFaceListRepoOptions = {
  repo: string;
  revision?: string;
  accessToken?: string;
};

type HuggingFaceRepoEntry = {
  path?: string;
  type?: string;
};

const DEFAULT_REVISION = "main";

const buildHeaders = (accessToken?: string): Record<string, string> => {
  if (!accessToken) {
    return { Accept: "application/json" };
  }
  return {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
};

export const hfUrl = ({
  repo,
  path,
  revision = DEFAULT_REVISION,
}: {
  repo: string;
  path: string;
  revision?: string;
}): string => {
  return `https://huggingface.co/${repo}/resolve/${revision}/${path}`;
};

// Cross-platform fetch with timeout (works in React Native, Node, browser)
function fetchWithTimeout(
  resource: RequestInfo,
  options: RequestInit = {},
  timeout = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const { signal, ...restOptions } = options;
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(resource, { ...restOptions, signal: controller.signal }).finally(
    () => clearTimeout(timeoutId),
  );
}

export const listRepoFiles = async ({
  repo,
  revision = DEFAULT_REVISION,
  accessToken,
}: HuggingFaceListRepoOptions): Promise<string[]> => {
  const url = `https://huggingface.co/api/models/${repo}/tree/${revision}?recursive=1`;

  const response = await fetchWithTimeout(
    url,
    {
      headers: buildHeaders(accessToken),
    },
    10000,
  );

  if (!response.ok) {
    throw new Error(
      `Hugging Face API error ${response.status} for ${repo}@${revision}`,
    );
  }

  const data = (await response.json()) as HuggingFaceRepoEntry[];
  if (!Array.isArray(data)) {
    throw new Error("Unexpected Hugging Face API response.");
  }

  return data
    .filter((entry) => entry.type === "file")
    .map((entry) => entry.path)
    .filter((path): path is string => typeof path === "string");
};
