import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

async function selectGenerationCount(user: ReturnType<typeof userEvent.setup>, count: string) {
  await user.click(screen.getByLabelText("生成数量"));
  await user.click(await screen.findByTitle(`${count} 组`));
}

describe("App workbench", () => {
  it("disables generation until a sample image and prompt are provided", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /开始生成/ })).toBeDisabled();
  });

  it("shows estimated cost for the selected count", async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectGenerationCount(user, "3");

    expect(screen.getByText("预计消耗 6 点")).toBeInTheDocument();
  });

  it("generates paired middle and product images and deducts points", async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File(["sample"], "sample.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("上传示例图片"), file);
    await user.type(screen.getByLabelText("提示词"), "青绿色蟾皮纹理");
    await selectGenerationCount(user, "2");
    await user.click(screen.getByRole("button", { name: /开始生成/ }));

    await waitFor(() => {
      expect(screen.getAllByRole("img", { name: /风格图/ })).toHaveLength(2);
    });
    expect(screen.getAllByRole("img", { name: /产品图/ })).toHaveLength(2);
    expect(screen.getByText("剩余 116 点")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /预览/ })).toHaveLength(4);
    expect(screen.getAllByRole("link", { name: /保存/ })).toHaveLength(4);
    expect(screen.queryByText("风格图 1")).not.toBeInTheDocument();
    expect(screen.queryByText("产品图 1")).not.toBeInTheDocument();
    expect(screen.queryByText("已贴膜")).not.toBeInTheDocument();
  });
});
