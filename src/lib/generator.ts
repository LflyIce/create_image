export type ImageSize = "1:1" | "4:3" | "3:4" | "16:9";

export type DoubaoModel = "doubao-seedream-4-0-250828" | "doubao-seedream-5-0-260128";

export const DOUBAO_MODEL_OPTIONS: { value: DoubaoModel; label: string }[] = [
  { value: "doubao-seedream-5-0-260128", label: "Seedream 5.0 Lite" },
  { value: "doubao-seedream-4-0-250828", label: "Seedream 4.0" }
];

export type GenerationRequest = {
  prompt: string;
  size: ImageSize;
  count: number;
  sampleImageUrl: string;
  model?: DoubaoModel;
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
