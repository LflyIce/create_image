import { describe, expect, it } from "vitest";
import { calculateGenerationCost, createGenerationBatch } from "./generator";

describe("generation helpers", () => {
  it("charges one point for each middle image and each product image", () => {
    expect(calculateGenerationCost(4)).toBe(8);
  });

  it("creates paired prompt and product results for the requested count", () => {
    const results = createGenerationBatch({
      prompt: "青绿色蟾皮纹理",
      size: "1:1",
      count: 3,
      sampleImageUrl: "data:image/png;base64,sample"
    });

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      id: "青绿色蟾皮纹理-1-1-0",
      promptTitle: "风格图 1",
      productTitle: "产品图 1",
      size: "1:1"
    });
    expect(results[0].promptImageUrl).toContain("data:image/svg+xml");
    expect(results[0].productImageUrl).toBe("data:image/png;base64,sample");
    expect(results[0].productOverlayImageUrl).toBe(results[0].promptImageUrl);
  });
});
