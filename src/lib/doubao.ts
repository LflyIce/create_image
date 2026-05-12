import { DirectPasteResult, DoubaoModel, GenerationPair, GenerationRequest, ImageSize, isDoubaoModel } from "./generator";

export type DoubaoPurpose = "style" | "product";

export type DoubaoRequestBody = {
  model: DoubaoModel;
  prompt: string;
  image?: string | string[];
  sequential_image_generation: "disabled";
  response_format: "url";
  size: "2K";
  stream: false;
  watermark: false;
};

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const DEFAULT_IMAGE_QUALITY_PROMPT =
  "一张构图严谨、主体突出的高清晰度画面，展现出丰富细腻的纹理细节和明确的视觉焦点。明亮均匀的漫射光线充满整个空间，色彩鲜艳饱满，确保画面各处都清晰可见且层次分明。影像风格强调极致的锐度与通透感，背景处理干净简洁，进一步衬托出主体的真实质感。整体呈现出专业摄影级的精细画质，营造出一种清晰、明净且令人愉悦的视觉氛围";

const DOUBAO_VARIATION_GUIDES = [
  "变化方案 1：严格围绕原提示词主题，突出清晰主图形和更疏朗的纹理留白，让整体节奏更简洁。",
  "变化方案 2：严格围绕原提示词主题，增加细节密度、层次变化和局部装饰元素，让画面更丰富。",
  "变化方案 3：严格围绕原提示词主题，调整色彩比例、明暗层次和图案分布，让视觉重心明显不同。",
  "变化方案 4：严格围绕原提示词主题，改变重复节奏、边缘走势和元素大小关系，让图案结构区别于其他方案。"
];

function buildDoubaoVariationGuide(index: number, total: number) {
  if (total <= 1) return "";
  const guide = DOUBAO_VARIATION_GUIDES[index % DOUBAO_VARIATION_GUIDES.length];
  return `${guide} 生成内容必须符合用户原始提示词，不要偏离主题；同一批次内避免与其他图片在构图、纹理分布和色彩比例上过于相似。`;
}

export function buildDoubaoRequestBody(prompt: string, model: DoubaoModel, image?: string | string[]): DoubaoRequestBody {
  const body: DoubaoRequestBody = {
    model,
    prompt,
    sequential_image_generation: "disabled",
    response_format: "url",
    size: "2K",
    stream: false,
    watermark: false
  };

  if (image) {
    body.image = image;
  }

  return body;
}

export function buildDoubaoPrompt(prompt: string, purpose: DoubaoPurpose, size: ImageSize) {
  const aspect = `画面比例 ${size}`;
  if (purpose === "style") {
    const targetPrompt = extractReplacementSubject(prompt);
    return `生成一张纯平面的图案素材，画面内容为：${targetPrompt}。严格要求：只生成图案本身，图案必须铺满整个画布，不要留白。绝对不要生成任何产品、门帘、窗帘、商品、样机、场景、室内环境、装饰画、相框、墙面、纸张、画布、投影、边框、挂杆或任何成品展示效果。这是一张独立的平面印刷图案，不依附于任何物体。${DEFAULT_IMAGE_QUALITY_PROMPT}，${aspect}，正视角，平面印刷素材`;
  }

  return `基于两张参考图生成产品替换图。第一张参考图是上传的产品图片，必须保持第一张参考图的场景、构图、背景、光线、相机角度和产品位置不变。第二张参考图是已经生成好的目标图案。只替换上传图片中的产品主体或产品表面贴图为第二张参考图的图案内容，保持第二张参考图的图案主体、颜色、构图和细节一致，不要重新设计图案，不要改变场景，不要添加新物体。${DEFAULT_IMAGE_QUALITY_PROMPT}，${aspect}，用户原始提示词：${prompt}`;
}

export function buildDirectPastePrompt() {
  return `基于两张参考图生成产品贴图结果。第一张参考图是产品原图，必须严格保持产品原图的场景、构图、背景、光线、相机角度、产品轮廓、安装环境和产品位置不变。第二张参考图是需要贴到产品主体或产品表面的图案。请只把第二张图的图案内容贴合到第一张图中的主要产品表面，让图案服从原产品表面的透视、褶皱、凹凸、阴影和高光。不要改变产品外形，不要添加新物体，不要生成相框、海报、纸张、画布、边框或额外装饰，不要把图案做成悬浮贴纸。输出一张真实自然的产品贴图成品图。${DEFAULT_IMAGE_QUALITY_PROMPT}`;
}

export function extractReplacementSubject(prompt: string) {
  const normalized = prompt.trim();
  const patterns = [
    /帮我生成(.+?)(?:更换|替换|换到|贴到|应用到|$)/,
    /生成(.+?)(?:更换|替换|换到|贴到|应用到|$)/,
    /换成(.+?)(?:图片|图案|画面|$)/,
    /替换成(.+?)(?:图片|图案|画面|$)/
  ];

  const match = patterns.map((pattern) => normalized.match(pattern)?.[1]?.trim()).find(Boolean);
  const candidate = match || normalized;

  return candidate
    .replace(/这是一个/g, "")
    .replace(/上传的?/g, "")
    .replace(/门帘|窗帘|帘子|产品图|商品图|产品|图片|图案|画面|更换|替换|贴图|贴膜|换产品图/g, "")
    .replace(/[，。,.;；：:\s]+/g, " ")
    .trim() || normalized;
}

export function extractDoubaoImageUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = (payload as { data?: Array<{ url?: string }> }).data;
  return data?.[0]?.url ?? "";
}

function localizeDoubaoError(code: string, message: string) {
  const combined = `${code} ${message}`;

  if (/InputImageSensitiveContentDetected|sensitive/i.test(combined)) {
    return "上传的图片可能包含敏感内容，平台已拒绝处理。请更换为普通产品图、纹理图或插画后重试。";
  }
  if (/InvalidParameter|invalid/i.test(combined)) {
    return "请求参数或图片格式不符合平台要求。请换一张清晰的 JPG/PNG 图片后重试。";
  }
  if (/Unauthorized|Authentication|auth|api key|permission/i.test(combined)) {
    return "接口鉴权失败，请检查 ARK_API_KEY 是否正确配置并已重启服务。";
  }
  if (/quota|balance|insufficient|limit/i.test(combined)) {
    return "接口额度不足或调用频率受限，请检查火山 Ark 额度后稍后再试。";
  }
  if (/timeout|network|ECONN|fetch/i.test(combined)) {
    return "网络请求失败或超时，请稍后重试。";
  }

  return message || code;
}

export function extractDoubaoErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: unknown }).error;

  if (typeof error === "string") return localizeDoubaoError(error, error);
  if (error && typeof error === "object") {
    const detail = error as { message?: unknown; msg?: unknown; code?: unknown };
    const message = typeof detail.message === "string" ? detail.message : typeof detail.msg === "string" ? detail.msg : "";
    const code = typeof detail.code === "string" || typeof detail.code === "number" ? String(detail.code) : "";
    return localizeDoubaoError(code, message);
  }

  const message = (payload as { message?: unknown; msg?: unknown }).message ?? (payload as { msg?: unknown }).msg;
  return typeof message === "string" ? localizeDoubaoError(message, message) : "";
}

export async function generateDoubaoImage(prompt: string, model: DoubaoModel, fetcher: FetchLike = fetch, image?: string | string[]) {
  const response = await fetcher("/api/doubao/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildDoubaoRequestBody(prompt, model, image))
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = extractDoubaoErrorMessage(payload) || "Doubao 图片生成失败";
    throw new Error(message);
  }

  const errorMessage = extractDoubaoErrorMessage(payload);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const url = extractDoubaoImageUrl(payload);
  if (!url) {
    throw new Error("Doubao 返回结果中没有图片 URL");
  }

  return url;
}

export async function createDoubaoGenerationBatch(request: GenerationRequest, fetcher: FetchLike = fetch) {
  const model = request.model && isDoubaoModel(request.model) ? request.model : "doubao-seedream-5-0-260128";
  const pairRequests = Array.from({ length: request.count }, async (_, index): Promise<GenerationPair> => {
    const variationGuide = buildDoubaoVariationGuide(index, request.count);
    const stylePrompt = [buildDoubaoPrompt(request.prompt, "style", request.size), variationGuide].filter(Boolean).join("\n");
    const promptImageUrl = await generateDoubaoImage(
      stylePrompt,
      model,
      fetcher
      // 风格图不传产品原图，纯按提示词生成，避免被产品图干扰
    );
    const productPrompt = [buildDoubaoPrompt(request.prompt, "product", request.size), variationGuide].filter(Boolean).join("\n");
    const productImageUrl = await generateDoubaoImage(
      productPrompt,
      model,
      fetcher,
      [request.sampleImageUrl, promptImageUrl]
    );

    return {
      id: `doubao-${request.size.replace(":", "-")}-${index}`,
      promptTitle: `风格图 ${index + 1}`,
      productTitle: `产品图 ${index + 1}`,
      promptImageUrl,
      productImageUrl,
      size: request.size
    };
  });

  return Promise.all(pairRequests);
}

export async function createDoubaoDirectPaste(
  productImageUrl: string,
  patternImageUrl: string,
  model: DoubaoModel = "doubao-seedream-5-0-260128",
  fetcher: FetchLike = fetch
): Promise<DirectPasteResult> {
  const imageUrl = await generateDoubaoImage(
    buildDirectPastePrompt(),
    model,
    fetcher,
    [productImageUrl, patternImageUrl]
  );

  return {
    id: "doubao-direct-paste",
    title: "贴图产品图",
    imageUrl,
    productImageUrl,
    patternImageUrl
  };
}
