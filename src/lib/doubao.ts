import { GenerationPair, GenerationRequest, ImageSize, DoubaoModel } from "./generator";

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
    const message = typeof payload?.error === "string" ? payload.error : "Doubao 图片生成失败";
    throw new Error(message);
  }

  if (typeof payload?.error === "string") {
    throw new Error(payload.error);
  }

  const url = extractDoubaoImageUrl(payload);
  if (!url) {
    throw new Error("Doubao 返回结果中没有图片 URL");
  }

  return url;
}

export async function createDoubaoGenerationBatch(request: GenerationRequest, fetcher: FetchLike = fetch) {
  const model = request.model || "doubao-seedream-5-0-260128";
  const pairs: GenerationPair[] = [];

  for (let index = 0; index < request.count; index += 1) {
    const promptImageUrl = await generateDoubaoImage(
      buildDoubaoPrompt(request.prompt, "style", request.size),
      model,
      fetcher
      // 风格图不传产品原图，纯按提示词生成，避免被产品图干扰
    );
    const productImageUrl = await generateDoubaoImage(
      buildDoubaoPrompt(request.prompt, "product", request.size),
      model,
      fetcher,
      [request.sampleImageUrl, promptImageUrl]
    );

    pairs.push({
      id: `doubao-${request.size.replace(":", "-")}-${index}`,
      promptTitle: `风格图 ${index + 1}`,
      productTitle: `产品图 ${index + 1}`,
      promptImageUrl,
      productImageUrl,
      size: request.size
    });
  }

  return pairs;
}
