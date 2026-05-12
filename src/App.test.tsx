import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

async function selectGenerationCount(user: ReturnType<typeof userEvent.setup>, count: string) {
  await user.click(screen.getByLabelText("生成数量"));
  await user.click(await screen.findByTitle(`${count} 组`));
}

describe("App workbench", () => {
  beforeEach(() => {
    localStorage.setItem("pod_token", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const pathname = new URL(url, "http://127.0.0.1").pathname;

        if (pathname === "/api/me") {
          return {
            ok: true,
            json: async () => ({ user: { id: 1, phone: "13812345678", points: 120, role: "user" } })
          };
        }

        if (pathname === "/api/points/deduct") {
          const body = JSON.parse(String(init?.body ?? "{}")) as { amount?: number };
          return {
            ok: true,
            json: async () => ({ ok: true, remaining: 120 - (body.amount ?? 0) })
          };
        }

        if (pathname === "/api/doubao/images") {
          return {
            ok: true,
            json: async () => ({ error: "测试环境不调用 Doubao" })
          };
        }

        return {
          ok: false,
          json: async () => ({ error: "unknown endpoint" })
        };
      })
    );
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  async function openPromptGenerationTab(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("tab", { name: "提示词生成" }));
  }

  it("disables generation until a sample image and prompt are provided", async () => {
    const user = userEvent.setup();
    render(<App />);

    await openPromptGenerationTab(user);
    expect(await screen.findByRole("button", { name: /开始生成/ })).toBeDisabled();
  });

  it("shows estimated cost for the selected count", async () => {
    const user = userEvent.setup();
    render(<App />);

    await openPromptGenerationTab(user);
    await screen.findByRole("button", { name: /开始生成/ });
    await selectGenerationCount(user, "3");

    expect(screen.getByText("预计消耗 6 点")).toBeInTheDocument();
  });

  it("generates paired middle and product images and deducts points", async () => {
    const user = userEvent.setup();
    render(<App />);

    await openPromptGenerationTab(user);
    const file = new File(["sample"], "sample.png", { type: "image/png" });
    await user.upload(await screen.findByLabelText("上传示例图片"), file);
    await user.type(screen.getByLabelText("提示词"), "青绿色蟾皮纹理");
    await selectGenerationCount(user, "2");
    await user.click(screen.getByRole("button", { name: /开始生成/ }));

    await waitFor(() => {
      expect(screen.getAllByRole("img", { name: /风格图/ })).toHaveLength(2);
    });
    expect(screen.getAllByRole("img", { name: /产品图/ })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /138\*\*\*\*0000/ }));
    expect(await screen.findByText("116 点")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /预览/ })).toHaveLength(4);
    expect(screen.getAllByRole("link", { name: /保存/ })).toHaveLength(4);
    expect(screen.queryByText("风格图 1")).not.toBeInTheDocument();
    expect(screen.queryByText("产品图 1")).not.toBeInTheDocument();
    expect(screen.queryByText("已贴膜")).not.toBeInTheDocument();
  });

  it("downloads all images in a result column with one action", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<App />);

    await openPromptGenerationTab(user);
    const file = new File(["sample"], "sample.png", { type: "image/png" });
    await user.upload(await screen.findByLabelText("上传示例图片"), file);
    await user.type(screen.getByLabelText("提示词"), "green texture");
    await selectGenerationCount(user, "2");
    await user.click(screen.getByRole("button", { name: /开始生成/ }));

    await waitFor(() => {
      expect(document.querySelectorAll("a[download]")).toHaveLength(4);
    });

    const downloadAllButtons = await screen.findAllByRole("button", { name: /下载全部/ });
    await user.click(downloadAllButtons[0]);

    expect(clickSpy).toHaveBeenCalledTimes(2);
  });
});
