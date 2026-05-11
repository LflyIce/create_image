import { describe, expect, it, vi } from "vitest";
import {
  buildIrisRequestBody,
  createIrisDirectPaste,
  createIrisImage,
  extractIrisImageUrl,
  extractIrisTaskId
} from "./iris";

describe("iris image generation", () => {
  it("builds request bodies for Iris models", () => {
    expect(buildIrisRequestBody("画一只猫", "nano-banana-2", "1:1", ["https://example.com/a.png"])).toMatchObject({
      prompt: "画一只猫",
      model: "nano-banana-2",
      aspect_ratio: "1:1",
      resolution: "2K",
      image_urls: ["https://example.com/a.png"]
    });

    expect(buildIrisRequestBody("画一只猫", "gpt-image-2", "16:9")).toMatchObject({
      model: "gpt-image-2",
      quality: "auto"
    });
    expect(buildIrisRequestBody("画一只猫", "gpt-image-2", "16:9")).not.toHaveProperty("resolution");
  });

  it("extracts image urls and task ids from public API responses", () => {
    expect(extractIrisTaskId({ task_id: "task_1" })).toBe("task_1");
    expect(extractIrisImageUrl({ data: { image_url: "https://example.com/out.png" } })).toBe(
      "https://example.com/out.png"
    );
  });

  it("polls Iris task results until an image url is available", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: "task_1", status: "queuing" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: "task_1", status: "success", image_url: "https://example.com/out.png" })
      });

    const imageUrl = await createIrisImage("画一只猫", "nano-banana-2", "1:1", fetchMock);

    expect(imageUrl).toBe("https://example.com/out.png");
    expect(fetchMock).toHaveBeenCalledWith("/api/iris/images/generations", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/iris/images/generations/task_1");
  });

  it("creates direct paste requests with two reference images", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ image_url: "https://example.com/pasted.png" })
    });

    const result = await createIrisDirectPaste(
      "https://example.com/product.png",
      "https://example.com/pattern.png",
      "nano-banana-2",
      fetchMock
    );

    expect(result.imageUrl).toBe("https://example.com/pasted.png");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      image_urls: ["https://example.com/product.png", "https://example.com/pattern.png"]
    });
  });
});
