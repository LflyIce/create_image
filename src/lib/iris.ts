import { DirectPasteResult, GenerationPair, GenerationRequest, ImageSize, IrisModel, isIrisModel } from "./generator";

export type IrisGenerationRequestBody = {
  prompt: string;
  negative_prompt?: string;
  model: IrisModel;
  aspect_ratio?: string;
  resolution?: "1K" | "2K" | "4K";
  quality?: "auto" | "low" | "medium" | "high";
  image_urls?: string[];
};

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const IRIS_TASK_POLL_INTERVAL_MS = 2500;
const IRIS_TASK_POLL_ATTEMPTS = 36;

export function buildIrisRequestBody(
  prompt: string,
  model: IrisModel,
  size: ImageSize,
  imageUrls: string[] = []
): IrisGenerationRequestBody {
  const body: IrisGenerationRequestBody = {
    prompt,
    model,
    aspect_ratio: size,
    image_urls: imageUrls.length ? imageUrls : undefined
  };

  if (model === "gpt-image-2" || model === "gpt-image-2-vip") {
    body.quality = "auto";
    delete body.resolution;
  } else {
    body.resolution = "2K";
  }

  return body;
}

export function buildIrisStylePrompt(prompt: string) {
  return `生成一张纯平面印刷图案素材，画面内容为：${prompt}。图案必须铺满整个画布，不要留白，不要生成产品、场景、相框、纸张、挂杆或成品展示效果。`;
}

export function buildIrisProductPastePrompt(prompt: string) {
  return `基于参考图生成产品贴图结果。保持产品原图的场景、构图、背景、光线、相机角度、产品轮廓和位置不变，只把目标图案贴合到产品主体或产品表面。图案需要服从原产品表面的透视、褶皱、凹凸、阴影和高光。用户原始需求：${prompt}`;
}

export function extractIrisImageUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = (payload as { data?: unknown }).data;
  const source = data && typeof data === "object" ? data : payload;
  return String((source as { image_url?: unknown }).image_url || "");
}

export function extractIrisTaskId(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = (payload as { data?: unknown }).data;
  const source = data && typeof data === "object" ? data : payload;
  return String((source as { task_id?: unknown; id?: unknown }).task_id || (source as { id?: unknown }).id || "");
}

export function extractIrisStatus(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = (payload as { data?: unknown }).data;
  const source = data && typeof data === "object" ? data : payload;
  return String((source as { status?: unknown; remote_state?: unknown }).status || (source as { remote_state?: unknown }).remote_state || "");
}

export function extractIrisErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = (payload as { data?: unknown }).data;
  const source = data && typeof data === "object" ? data : payload;
  const errorCode = String((source as { error_code?: unknown; code?: unknown }).error_code || (source as { code?: unknown }).code || "");
  const errorMessage = String((source as { error_message?: unknown; message?: unknown; msg?: unknown }).error_message || (source as { message?: unknown }).message || (source as { msg?: unknown }).msg || "");
  return [errorCode, errorMessage].filter(Boolean).join("：");
}

function isFinalStatus(status: string) {
  return ["success", "fail", "failed", "cancelled"].includes(status.trim().toLowerCase());
}

function isSuccessStatus(status: string) {
  return status.trim().toLowerCase() === "success";
}

async function readJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractIrisErrorMessage(payload) || `Iris API 请求失败(${response.status})`);
  }
  return payload;
}

export async function createIrisImage(
  prompt: string,
  model: IrisModel,
  size: ImageSize,
  fetcher: FetchLike = fetch,
  imageUrls: string[] = []
) {
  const createResponse = await fetcher("/api/iris/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildIrisRequestBody(prompt, model, size, imageUrls))
  });
  const createPayload = await readJsonResponse(createResponse);
  const directImageUrl = extractIrisImageUrl(createPayload);
  if (directImageUrl) return directImageUrl;

  const taskId = extractIrisTaskId(createPayload);
  if (!taskId) {
    throw new Error("Iris API 没有返回任务 ID");
  }

  for (let attempt = 0; attempt < IRIS_TASK_POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, IRIS_TASK_POLL_INTERVAL_MS));
    const statusResponse = await fetcher(`/api/iris/images/generations/${encodeURIComponent(taskId)}`);
    const statusPayload = await readJsonResponse(statusResponse);
    const imageUrl = extractIrisImageUrl(statusPayload);
    if (imageUrl) return imageUrl;

    const status = extractIrisStatus(statusPayload);
    if (isFinalStatus(status)) {
      if (isSuccessStatus(status)) break;
      throw new Error(extractIrisErrorMessage(statusPayload) || `Iris 任务失败：${status}`);
    }
  }

  throw new Error("Iris 任务生成超时，请稍后在任务记录中查看结果");
}

export async function createIrisGenerationBatch(request: GenerationRequest, fetcher: FetchLike = fetch) {
  const model = request.model && isIrisModel(request.model) ? request.model : "nano-banana-2";
  const pairs: GenerationPair[] = [];

  for (let index = 0; index < request.count; index += 1) {
    const promptImageUrl = await createIrisImage(
      buildIrisStylePrompt(request.prompt),
      model,
      request.size,
      fetcher
    );
    const productImageUrl = await createIrisImage(
      buildIrisProductPastePrompt(request.prompt),
      model,
      request.size,
      fetcher,
      [request.sampleImageUrl, promptImageUrl]
    );

    pairs.push({
      id: `iris-${request.size.replace(":", "-")}-${index}`,
      promptTitle: `风格图 ${index + 1}`,
      productTitle: `产品图 ${index + 1}`,
      promptImageUrl,
      productImageUrl,
      size: request.size
    });
  }

  return pairs;
}

export async function createIrisDirectPaste(
  productImageUrl: string,
  patternImageUrl: string,
  model: IrisModel = "nano-banana-2",
  fetcher: FetchLike = fetch
): Promise<DirectPasteResult> {
  const imageUrl = await createIrisImage(
    buildIrisProductPastePrompt("把第二张参考图贴到第一张产品图上，生成自然真实的产品贴图成品图。"),
    model,
    "1:1",
    fetcher,
    [productImageUrl, patternImageUrl]
  );

  return {
    id: "iris-direct-paste",
    title: "贴图产品图",
    imageUrl,
    productImageUrl,
    patternImageUrl
  };
}
