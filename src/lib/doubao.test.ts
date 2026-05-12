import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMAGE_QUALITY_PROMPT,
  buildDirectPastePrompt,
  buildDoubaoPrompt,
  buildDoubaoRequestBody,
  createDoubaoDirectPaste,
  createDoubaoGenerationBatch,
  extractDoubaoErrorMessage,
  extractDoubaoImageUrl
} from "./doubao";

describe("doubao image generation", () => {
  it("builds the Seedream 4.0 request body from the provided example", () => {
    expect(buildDoubaoRequestBody("黑白蟾皮纹理", "doubao-seedream-4-0-250828")).toEqual({
      model: "doubao-seedream-4-0-250828",
      prompt: "黑白蟾皮纹理",
      sequential_image_generation: "disabled",
      response_format: "url",
      size: "2K",
      stream: false,
      watermark: false
    });
  });

  it("adds the default quality prompt to style image generation", () => {
    const prompt = buildDoubaoPrompt("黑白蟾皮纹理", "style", "1:1");

    expect(prompt).toContain("黑白蟾皮纹理");
    expect(prompt).toContain(DEFAULT_IMAGE_QUALITY_PROMPT);
  });

  it("keeps product words from becoming the left-side generated subject", () => {
    const prompt = buildDoubaoPrompt("这是一个门帘的产品图，帮我生成皮卡丘图片更换产品图", "style", "1:1");

    expect(prompt).toContain("皮卡丘");
    expect(prompt).toContain("纯平面的图案素材");
    expect(prompt).toContain("绝对不要生成任何产品");
    expect(prompt).toContain("装饰画");
    expect(prompt).toContain("不要留白");
    expect(prompt).not.toContain("这是一个门帘的产品图");
  });

  it("adds reference images to image editing requests", () => {
    expect(buildDoubaoRequestBody("把图案贴到门帘上", "doubao-seedream-5-0-260128", ["data:image/png;base64,sample", "https://example.com/style.png"])).toMatchObject({
      image: ["data:image/png;base64,sample", "https://example.com/style.png"]
    });
  });

  it("extracts the first image url from Ark image responses", () => {
    expect(extractDoubaoImageUrl({ data: [{ url: "https://example.com/a.png" }] })).toBe(
      "https://example.com/a.png"
    );
  });

  it("extracts structured Ark error messages", () => {
    expect(extractDoubaoErrorMessage({ error: { code: "InvalidParameter", message: "image is invalid" } })).toBe(
      "请求参数或图片格式不符合平台要求。请换一张清晰的 JPG/PNG 图片后重试。"
    );
    expect(extractDoubaoErrorMessage({ message: "quota exceeded" })).toBe(
      "接口额度不足或调用频率受限，请检查火山 Ark 额度后稍后再试。"
    );
  });

  it("localizes sensitive input image errors", () => {
    expect(
      extractDoubaoErrorMessage({
        error: {
          code: "InputImageSensitiveContentDetected",
          message: "The request failed because the input image may contain sensitive information."
        }
      })
    ).toBe("上传的图片可能包含敏感内容，平台已拒绝处理。请更换为普通产品图、纹理图或插画后重试。");
  });

  it("creates product images by editing the uploaded product with the generated style image", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ url: "https://example.com/style.png" }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ url: "https://example.com/product.png" }] })
      });

    const results = await createDoubaoGenerationBatch(
      {
        prompt: "青绿色蟾皮纹理",
        size: "1:1",
        count: 1,
        sampleImageUrl: "data:image/png;base64,sample"
      },
      fetchMock
    );

    expect(results).toEqual([
      {
        id: "doubao-1-1-0",
        promptTitle: "风格图 1",
        productTitle: "产品图 1",
        promptImageUrl: "https://example.com/style.png",
        productImageUrl: "https://example.com/product.png",
        size: "1:1"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty("image");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      image: ["data:image/png;base64,sample", "https://example.com/style.png"]
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).prompt).toContain("只替换上传图片中的产品主体");
  });

  it("starts style image requests for multiple pairs in parallel", async () => {
    const pendingStyleResponses: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (!body.image) {
        return new Promise<Response>((resolve) => pendingStyleResponses.push(resolve));
      }

      const productIndex = fetchMock.mock.calls.filter(([, requestInit]) => {
        const requestBody = JSON.parse(String(requestInit?.body));
        return Boolean(requestBody.image);
      }).length;

      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [{ url: `https://example.com/product-${productIndex}.png` }] })
      } as Response);
    });

    const batchPromise = createDoubaoGenerationBatch(
      {
        prompt: "parallel pattern",
        size: "1:1",
        count: 2,
        sampleImageUrl: "data:image/png;base64,sample"
      },
      fetchMock
    );

    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).image)).toEqual([undefined, undefined]);

    pendingStyleResponses.forEach((resolve, index) => {
      resolve({
        ok: true,
        json: async () => ({ data: [{ url: `https://example.com/style-${index + 1}.png` }] })
      } as Response);
    });

    const results = await batchPromise;

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.promptImageUrl)).toEqual([
      "https://example.com/style-1.png",
      "https://example.com/style-2.png"
    ]);
  });

  it("adds distinct variation guidance when generating multiple pairs", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const url = body.image ? "https://example.com/product.png" : "https://example.com/style.png";

      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [{ url }] })
      } as Response);
    });

    await createDoubaoGenerationBatch(
      {
        prompt: "blue floral curtain pattern",
        size: "1:1",
        count: 3,
        sampleImageUrl: "data:image/png;base64,sample"
      },
      fetchMock
    );

    const stylePrompts = fetchMock.mock.calls
      .map(([, init]) => JSON.parse(String(init?.body)))
      .filter((body) => !body.image)
      .map((body) => body.prompt);

    expect(stylePrompts).toHaveLength(3);
    expect(new Set(stylePrompts).size).toBe(3);
    stylePrompts.forEach((prompt) => {
      expect(prompt).toContain("blue floral curtain pattern");
      expect(prompt).toContain("变化方案");
    });
  });

  it("builds and sends direct product paste requests with two uploaded images", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ url: "https://example.com/pasted.png" }] })
    });

    const result = await createDoubaoDirectPaste(
      "data:image/png;base64,product",
      "data:image/png;base64,pattern",
      "doubao-seedream-5-0-260128",
      fetchMock
    );

    expect(result).toMatchObject({
      title: "贴图产品图",
      imageUrl: "https://example.com/pasted.png",
      productImageUrl: "data:image/png;base64,product",
      patternImageUrl: "data:image/png;base64,pattern"
    });
    expect(buildDirectPastePrompt()).toContain("只把第二张图的图案内容贴合到第一张图中的主要产品表面");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      image: ["data:image/png;base64,product", "data:image/png;base64,pattern"]
    });
  });
});
