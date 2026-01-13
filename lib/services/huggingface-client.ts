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

export const listRepoFiles = async ({
  repo,
  revision = DEFAULT_REVISION,
  accessToken,
}: HuggingFaceListRepoOptions): Promise<string[]> => {
  const url = `https://huggingface.co/api/models/${repo}/tree/${revision}?recursive=1`;
  const response = await fetch(url, {
    headers: buildHeaders(accessToken),
    signal: AbortSignal.timeout(10000),
  });

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
