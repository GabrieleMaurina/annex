const ENDPOINT = 'https://api.openai.com/v1/moderations';

interface ModerationResult {
  flagged?: boolean;
  categories?: Record<string, boolean>;
  category_scores?: Record<string, number>;
}

interface ModerationResponse {
  results?: ModerationResult[];
}

export function isImageAllowed(dataUrl: string): Promise<boolean> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('[moderation] OPENAI_API_KEY is not set; rejecting image');
    return Promise.reject(new Error('missing OPENAI_API_KEY'));
  }
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'omni-moderation-latest',
      input: [{ type: 'image_url', image_url: { url: dataUrl } }],
    }),
  }).then((res) =>
    res.text().then((text) => {
      if (!res.ok) {
        console.error(
          `[moderation] OpenAI responded ${res.status}: ${text.slice(0, 500)}`,
        );
        throw new Error(`moderation responded ${res.status}`);
      }
      let body: ModerationResponse;
      try {
        body = JSON.parse(text) as ModerationResponse;
      } catch {
        console.error(
          `[moderation] unparseable response: ${text.slice(0, 500)}`,
        );
        throw new Error('moderation response malformed');
      }
      const result = body.results?.[0];
      if (!result) {
        console.error(
          `[moderation] no results in response: ${text.slice(0, 500)}`,
        );
        throw new Error('moderation response malformed');
      }
      if (result.flagged) {
        const categories = Object.entries(result.categories ?? {})
          .filter(([, on]) => on)
          .map(([name]) => name);
        console.warn(
          `[moderation] image flagged: ${categories.join(', ') || 'unknown'}`,
          result.category_scores,
        );
      } else {
        console.log('[moderation] image passed');
      }
      return !result.flagged;
    }),
  );
}
