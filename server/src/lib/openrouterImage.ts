import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OUTPUT_DIR = path.join(process.cwd(), 'generated-ai');

export type OpenRouterReferenceImage = {
  url: string;
  caption?: string;
};

export type OpenRouterImageRequest = {
  model: string;
  prompt: string;
  references?: OpenRouterReferenceImage[];
  aspectRatio?: string;
  outputFormat?: 'file' | 'data-url';
};

function normalizeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('OpenRouter returned an unsupported image payload.');
  return {
    mimeType: match[1],
    base64: match[2],
  };
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'bin';
}

export async function generateImageViaOpenRouter(request: OpenRouterImageRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured on the server.');

  const content: Array<Record<string, any>> = [
    { type: 'text', text: request.prompt },
    ...(request.references || []).map((reference) => ({
      type: 'image_url',
      image_url: {
        url: reference.url,
      },
    })),
  ];

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
      modalities: ['image', 'text'],
      image_config: request.aspectRatio ? { aspect_ratio: request.aspectRatio } : undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenRouter image generation failed: ${response.status}${body ? ` ${body.slice(0, 500)}` : ''}`);
  }

  const result = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string;
        images?: Array<{ image_url?: { url?: string }, imageUrl?: { url?: string } }>;
      };
    }>;
  };

  const message = result.choices?.[0]?.message;
  const rawImageUrl = message?.images?.[0]?.image_url?.url || message?.images?.[0]?.imageUrl?.url;
  if (!rawImageUrl) throw new Error('OpenRouter returned no generated image.');

  const parsed = normalizeDataUrl(rawImageUrl);
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

  const extension = extensionFromMimeType(parsed.mimeType);
  const fileName = `ai-${Date.now()}.${extension}`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  await fs.promises.writeFile(filePath, Buffer.from(parsed.base64, 'base64'));

  return {
    filePath,
    fileName,
    contentType: parsed.mimeType,
    assistantText: message?.content || '',
    dataUrl: `data:${parsed.mimeType};base64,${parsed.base64}`,
  };
}
