export type ImageSize = "1:1" | "4:3" | "3:4" | "16:9";

export type DoubaoModel = "doubao-seedream-4-0-250828" | "doubao-seedream-5-0-260128";
export type IrisModel =
  | "nano-banana-pro"
  | "nano-banana-2"
  | "nano-banana-pro__vip"
  | "nano-banana-2__vip"
  | "gpt-image-2"
  | "gpt-image-2-vip"
  | "gpt-image-2__vip"
  | "grok-imagine/text-to-image"
  | "grok-imagine/image-to-image"
  | "seedream/5-lite-text-to-image"
  | "seedream/5-lite-image-to-image";
export type ImageModel = DoubaoModel | IrisModel;

export const IMAGE_MODEL_OPTIONS: { value: ImageModel; label: string }[] = [
  { value: "doubao-seedream-5-0-260128", label: "Doubao Seedream 5.0 Lite" },
  { value: "doubao-seedream-4-0-250828", label: "Doubao Seedream 4.0" },
  { value: "nano-banana-2", label: "Iris Nano Banana 2" },
  { value: "nano-banana-pro", label: "Iris Nano Banana Pro" },
  { value: "nano-banana-2__vip", label: "Iris Nano Banana 2 VIP" },
  { value: "nano-banana-pro__vip", label: "Iris Nano Banana Pro VIP" },
  { value: "gpt-image-2", label: "Iris GPT Image 2" },
  { value: "gpt-image-2-vip", label: "Iris GPT Image 2 VIP" },
  { value: "gpt-image-2__vip", label: "Iris GPT Image 2 VIP 图生图" },
  { value: "grok-imagine/text-to-image", label: "Iris Grok 文生图" },
  { value: "grok-imagine/image-to-image", label: "Iris Grok 图生图" },
  { value: "seedream/5-lite-text-to-image", label: "Iris Seedream 文生图" },
  { value: "seedream/5-lite-image-to-image", label: "Iris Seedream 图生图" }
];

export const DOUBAO_MODEL_OPTIONS = IMAGE_MODEL_OPTIONS.filter((option) =>
  option.value.startsWith("doubao-")
) as { value: DoubaoModel; label: string }[];

export function isDoubaoModel(model: ImageModel): model is DoubaoModel {
  return model.startsWith("doubao-");
}

export function isIrisModel(model: ImageModel): model is IrisModel {
  return !isDoubaoModel(model);
}

export type GenerationRequest = {
  prompt: string;
  size: ImageSize;
  count: number;
  sampleImageUrl: string;
  model?: ImageModel;
};

export type GenerationPair = {
  id: string;
  promptTitle: string;
  productTitle: string;
  promptImageUrl: string;
  productImageUrl: string;
  productOverlayImageUrl?: string;
  size: ImageSize;
};

export type DirectPasteResult = {
  id: string;
  title: string;
  imageUrl: string;
  productImageUrl: string;
  patternImageUrl: string;
};

const sizeToViewBox: Record<ImageSize, { width: number; height: number }> = {
  "1:1": { width: 900, height: 900 },
  "4:3": { width: 960, height: 720 },
  "3:4": { width: 720, height: 960 },
  "16:9": { width: 1120, height: 630 }
};

const palettes = [
  ["#245c4f", "#86b86f", "#d7e7bb", "#1b2f2b"],
  ["#4f3b67", "#d28f7c", "#f6d7a7", "#272033"],
  ["#345f84", "#7fc0b6", "#f0e3c2", "#162b3a"],
  ["#69513d", "#a7a05a", "#e9d6a5", "#2c271f"]
];

export function calculateGenerationCost(count: number) {
  return count * 2;
}

export function createGenerationBatch(request: GenerationRequest): GenerationPair[] {
  return Array.from({ length: request.count }, (_, index) => {
    const id = `${request.prompt}-${request.size.replace(":", "-")}-${index}`;
    const promptImageUrl = createPromptImage(request.prompt, request.size, index);
    return {
      id,
      promptTitle: `风格图 ${index + 1}`,
      productTitle: `产品图 ${index + 1}`,
      promptImageUrl,
      productImageUrl: request.sampleImageUrl,
      productOverlayImageUrl: promptImageUrl,
      size: request.size
    };
  });
}

export function calculateDirectPasteCost() {
  return 1;
}

export function createDirectPastePreview(productImageUrl: string, patternImageUrl: string): DirectPasteResult {
  return {
    id: `direct-paste-${Date.now()}`,
    title: "贴图产品图",
    imageUrl: createDirectPasteSvg(productImageUrl, patternImageUrl),
    productImageUrl,
    patternImageUrl
  };
}

function createDirectPasteSvg(productImageUrl: string, patternImageUrl: string) {
  const width = 1024;
  const height = 1024;
  const pasteX = 268;
  const pasteY = 176;
  const pasteWidth = 488;
  const pasteHeight = 672;

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <clipPath id="pasteArea">
          <rect x="${pasteX}" y="${pasteY}" width="${pasteWidth}" height="${pasteHeight}" rx="34" />
        </clipPath>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.34" />
        </filter>
        <linearGradient id="surfaceLight" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.26" />
          <stop offset="0.42" stop-color="#ffffff" stop-opacity="0.06" />
          <stop offset="1" stop-color="#000000" stop-opacity="0.18" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="#111213" />
      <image href="${escapeXml(productImageUrl)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />
      <g filter="url(#softShadow)">
        <rect x="${pasteX}" y="${pasteY}" width="${pasteWidth}" height="${pasteHeight}" rx="34" fill="#000000" opacity="0.18" />
        <g clip-path="url(#pasteArea)">
          <image href="${escapeXml(patternImageUrl)}" x="${pasteX}" y="${pasteY}" width="${pasteWidth}" height="${pasteHeight}" preserveAspectRatio="xMidYMid slice" opacity="0.92" />
          <rect x="${pasteX}" y="${pasteY}" width="${pasteWidth}" height="${pasteHeight}" fill="url(#surfaceLight)" />
          <g opacity="0.11">
            <path d="M${pasteX + 88} ${pasteY} C ${pasteX + 62} ${pasteY + 180}, ${pasteX + 116} ${pasteY + 420}, ${pasteX + 78} ${pasteY + pasteHeight}" fill="none" stroke="#000" stroke-width="16" />
            <path d="M${pasteX + 252} ${pasteY} C ${pasteX + 278} ${pasteY + 210}, ${pasteX + 224} ${pasteY + 430}, ${pasteX + 268} ${pasteY + pasteHeight}" fill="none" stroke="#fff" stroke-width="10" />
            <path d="M${pasteX + 402} ${pasteY} C ${pasteX + 374} ${pasteY + 190}, ${pasteX + 428} ${pasteY + 442}, ${pasteX + 396} ${pasteY + pasteHeight}" fill="none" stroke="#000" stroke-width="14" />
          </g>
        </g>
        <rect x="${pasteX}" y="${pasteY}" width="${pasteWidth}" height="${pasteHeight}" rx="34" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="3" />
      </g>
    </svg>
  `);
}

function createPromptImage(prompt: string, size: ImageSize, index: number) {
  const { width, height } = sizeToViewBox[size];
  const [base, accent, light, dark] = palettes[index % palettes.length];
  const shortPrompt = escapeXml(prompt.slice(0, 18));
  const circles = Array.from({ length: 36 }, (_, dotIndex) => {
    const x = (dotIndex * 137 + index * 61) % width;
    const y = (dotIndex * 89 + index * 43) % height;
    const r = 12 + ((dotIndex * 7 + index) % 34);
    const fill = dotIndex % 3 === 0 ? light : dotIndex % 3 === 1 ? accent : base;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="0.45" />`;
  }).join("");

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${base}" />
          <stop offset="1" stop-color="${dark}" />
        </linearGradient>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="${index + 2}" />
          <feColorMatrix type="saturate" values="0.45" />
          <feBlend mode="multiply" in2="SourceGraphic" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <g filter="url(#grain)">${circles}</g>
      <path d="M0 ${height * 0.72} C ${width * 0.28} ${height * 0.58}, ${width * 0.54} ${height * 0.9}, ${width} ${height * 0.66} L ${width} ${height} L 0 ${height} Z" fill="${accent}" opacity="0.36" />
      <text x="42" y="${height - 54}" fill="#fff" font-size="34" font-family="Arial, sans-serif" opacity="0.9">${shortPrompt}</text>
    </svg>
  `);
}

function createProductImage(prompt: string, size: ImageSize, index: number) {
  const { width, height } = sizeToViewBox[size];
  const [base, accent, light, dark] = palettes[index % palettes.length];
  const shortPrompt = escapeXml(prompt.slice(0, 14));
  const curtainWidth = width * 0.62;
  const curtainHeight = height * 0.68;
  const curtainX = (width - curtainWidth) / 2;
  const curtainY = height * 0.18;

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#eef2f0" />
      <rect x="${width * 0.08}" y="${height * 0.08}" width="${width * 0.84}" height="${height * 0.84}" rx="34" fill="#ffffff" />
      <line x1="${curtainX}" y1="${curtainY - 26}" x2="${curtainX + curtainWidth}" y2="${curtainY - 26}" stroke="${dark}" stroke-width="18" stroke-linecap="round" />
      <defs>
        <pattern id="film" width="92" height="92" patternUnits="userSpaceOnUse">
          <rect width="92" height="92" fill="${base}" />
          <circle cx="22" cy="18" r="17" fill="${light}" opacity="0.52" />
          <circle cx="64" cy="54" r="24" fill="${accent}" opacity="0.5" />
          <circle cx="18" cy="76" r="10" fill="${dark}" opacity="0.35" />
        </pattern>
      </defs>
      <rect x="${curtainX}" y="${curtainY}" width="${curtainWidth}" height="${curtainHeight}" rx="24" fill="url(#film)" />
      <g opacity="0.18">
        <line x1="${curtainX + curtainWidth * 0.2}" y1="${curtainY}" x2="${curtainX + curtainWidth * 0.18}" y2="${curtainY + curtainHeight}" stroke="#000" stroke-width="7" />
        <line x1="${curtainX + curtainWidth * 0.4}" y1="${curtainY}" x2="${curtainX + curtainWidth * 0.41}" y2="${curtainY + curtainHeight}" stroke="#000" stroke-width="7" />
        <line x1="${curtainX + curtainWidth * 0.62}" y1="${curtainY}" x2="${curtainX + curtainWidth * 0.6}" y2="${curtainY + curtainHeight}" stroke="#000" stroke-width="7" />
        <line x1="${curtainX + curtainWidth * 0.82}" y1="${curtainY}" x2="${curtainX + curtainWidth * 0.84}" y2="${curtainY + curtainHeight}" stroke="#000" stroke-width="7" />
      </g>
      <rect x="${curtainX}" y="${curtainY}" width="${curtainWidth}" height="${curtainHeight}" rx="24" fill="none" stroke="#ffffff" stroke-width="8" opacity="0.7" />
      <text x="${width / 2}" y="${height * 0.93}" fill="#2a3431" text-anchor="middle" font-size="32" font-family="Arial, sans-serif">${shortPrompt} 贴膜效果</text>
    </svg>
  `);
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
