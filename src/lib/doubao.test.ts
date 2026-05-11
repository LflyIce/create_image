import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMAGE_QUALITY_PROMPT,
  buildDoubaoPrompt,
  buildDoubaoRequestBody,
  createDoubaoGenerationBatch,
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
    expect(prompt).toContain("不要生成装饰画");
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
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      image: "data:image/png;base64,sample"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      image: ["data:image/png;base64,sample", "https://example.com/style.png"]
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).prompt).toContain("只替换上传图片中的产品主体");
  });
});
