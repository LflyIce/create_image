#!/usr/bin/env python3
"""
POD 模板贴图工具
用法：
  1. 交互模式（选点）：python pod_tool.py --template scene.jpg --pattern design.png
  2. 配置模式（预设区域）：python pod_tool.py --template scene.jpg --pattern design.png --config region.json
  3. 批量模式：python pod_tool.py --template scene.jpg --patterns ./designs/ --config region.json
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance
import json
import os
import sys
import argparse
from pathlib import Path


class PODTool:
    """POD 产品图贴图工具"""

    def __init__(self, template_path):
        self.template = cv2.imread(template_path)
        if self.template is None:
            raise FileNotFoundError(f"找不到模板图片: {template_path}")
        self.template_path = template_path
        self.corners = None  # 四个角点 [TL, TR, BR, BL]

    def select_region_interactive(self):
        """交互式选择贴图区域（需要GUI环境）"""
        print("请在窗口中点击门帘区域的四个角点（左上→右上→右下→左下）")
        print("按 ESC 取消，按 R 重新选点")

        points = []

        def mouse_callback(event, x, y, flags, param):
            if event == cv2.EVENT_LBUTTONDOWN and len(points) < 4:
                points.append([x, y])
                # 画点
                cv2.circle(clone, (x, y), 5, (0, 255, 0), -1)
                if len(points) > 1:
                    cv2.line(clone, tuple(points[-2]), tuple(points[-1]), (0, 255, 0), 2)
                if len(points) == 4:
                    cv2.line(clone, tuple(points[-1]), tuple(points[0]), (0, 255, 0), 2)
                cv2.imshow("Select Region - Click 4 corners", clone)
                print(f"  点 {len(points)}/4: ({x}, {y})")

        clone = self.template.copy()
        cv2.namedWindow("Select Region - Click 4 corners")
        cv2.setMouseCallback("Select Region - Click 4 corners", mouse_callback)

        while True:
            cv2.imshow("Select Region - Click 4 corners", clone)
            key = cv2.waitKey(1) & 0xFF
            if key == 27:  # ESC
                cv2.destroyAllWindows()
                return None
            if key == ord('r'):  # Reset
                points.clear()
                clone = self.template.copy()
                print("已重置，重新选点")
            if len(points) == 4:
                break

        cv2.destroyAllWindows()
        self.corners = np.float32(points)
        return self.corners

    def set_region(self, corners):
        """
        设置贴图区域
        corners: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] 左上、右上、右下、左下
        """
        if len(corners) != 4:
            raise ValueError("需要4个角点")
        self.corners = np.float32(corners)

    def auto_detect_region(self):
        """自动检测贴图区域（基于颜色/边缘，预留接口）"""
        # TODO: 可用边缘检测+轮廓查找自动定位
        raise NotImplementedError("自动检测待实现，请用手动选点或配置文件")

    def apply_pattern(self, pattern_path, output_path=None, blend_mode="overlay",
                      texture_strength=0.3, brightness_adj=0.0):
        """
        将图案贴到模板的指定区域

        Args:
            pattern_path: 图案图片路径
            output_path: 输出路径（默认自动命名）
            blend_mode: 融合模式 - "replace"(替换), "overlay"(叠加), "multiply"(正片叠底)
            texture_strength: 原始纹理强度 0~1（保留多少门帘褶皱质感）
            brightness_adj: 亮度调整 -1~1
        """
        if self.corners is None:
            raise ValueError("请先设置贴图区域 (set_region 或 select_region_interactive)")

        pattern = cv2.imread(pattern_path)
        if pattern is None:
            raise FileNotFoundError(f"找不到图案图片: {pattern_path}")

        result = self.template.copy()

        # 计算目标区域的宽高
        width_top = np.linalg.norm(self.corners[1] - self.corners[0])
        width_bottom = np.linalg.norm(self.corners[2] - self.corners[3])
        height_left = np.linalg.norm(self.corners[3] - self.corners[0])
        height_right = np.linalg.norm(self.corners[2] - self.corners[1])

        out_w = int(max(width_top, width_bottom))
        out_h = int(max(height_left, height_right))

        # 图案源四角点
        src_pts = np.float32([
            [0, 0],
            [pattern.shape[1], 0],
            [pattern.shape[1], pattern.shape[0]],
            [0, pattern.shape[0]]
        ])

        # 透视变换
        M = cv2.getPerspectiveTransform(src_pts, self.corners)
        warped = cv2.warpPerspective(pattern, M,
                                     (result.shape[1], result.shape[0]),
                                     flags=cv2.INTER_LINEAR,
                                     borderMode=cv2.BORDER_CONSTANT,
                                     borderValue=(0, 0, 0))

        # 创建蒙版
        mask = np.zeros((result.shape[0], result.shape[1]), dtype=np.uint8)
        cv2.fillConvexPoly(mask, self.corners.astype(np.int32), 255)

        # 提取原始区域的纹理（用于叠加褶皱效果）
        if texture_strength > 0:
            gray_template = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
            # 用高通滤波提取纹理细节
            blurred = cv2.GaussianBlur(gray_template, (0, 0), 3)
            texture = cv2.subtract(gray_template, blurred)
            texture_3ch = cv2.cvtColor(texture, cv2.COLOR_GRAY2BGR)

        # 融合
        if blend_mode == "replace":
            # 直接替换
            for i in range(3):
                result[:, :, i] = np.where(mask == 255, warped[:, :, i], result[:, :, i])
        elif blend_mode == "overlay":
            # 叠加模式
            for i in range(3):
                result[:, :, i] = np.where(mask == 255, warped[:, :, i], result[:, :, i])
            # 叠加纹理
            if texture_strength > 0:
                result = np.where(
                    mask[:, :, np.newaxis] == 255,
                    np.clip(result.astype(np.float32) + texture_3ch.astype(np.float32) * texture_strength * 3, 0, 255).astype(np.uint8),
                    result
                )
        elif blend_mode == "multiply":
            # 正片叠底
            blended = cv2.multiply(warped, result, scale=1/255)
            for i in range(3):
                result[:, :, i] = np.where(mask == 255, blended[:, :, i], result[:, :, i])

        # 亮度调整
        if brightness_adj != 0:
            h, w = result.shape[:2]
            for i in range(3):
                result[:, :, i] = np.where(
                    mask == 255,
                    np.clip(result[:, :, i].astype(np.float32) + brightness_adj * 255, 0, 255).astype(np.uint8),
                    result[:, :, i]
                )

        # 边缘柔化（让贴图边缘不那么硬）
        mask_blur = cv2.GaussianBlur(mask, (5, 5), 2)
        mask_blur = mask_blur.astype(np.float32) / 255.0
        # 只在边缘做混合
        edge_zone = ((mask > 0) & (mask < 255))
        if edge_zone.any():
            for i in range(3):
                result[:, :, i] = np.where(
                    edge_zone,
                    (warped[:, :, i] * mask_blur + result[:, :, i] * (1 - mask_blur)).astype(np.uint8),
                    result[:, :, i]
                )

        # 保存
        if output_path is None:
            tpl_name = Path(self.template_path).stem
            pat_name = Path(pattern_path).stem
            output_path = f"output_{tpl_name}_{pat_name}.png"

        cv2.imwrite(output_path, result)
        print(f"✅ 已保存: {output_path}")
        return output_path

    def save_config(self, config_path="region.json"):
        """保存区域配置"""
        if self.corners is None:
            raise ValueError("没有设置区域")
        config = {
            "template": self.template_path,
            "corners": self.corners.tolist(),
            "corners_order": ["top-left", "top-right", "bottom-right", "bottom-left"]
        }
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"✅ 配置已保存: {config_path}")

    def load_config(self, config_path):
        """加载区域配置"""
        with open(config_path, 'r') as f:
            config = json.load(f)
        self.corners = np.float32(config["corners"])
        print(f"✅ 配置已加载: {config_path}")
        print(f"   角点: {config['corners']}")
        return self.corners


def batch_process(template_path, patterns_dir, config_path, output_dir="./output"):
    """批量处理"""
    os.makedirs(output_dir, exist_ok=True)
    tool = PODTool(template_path)
    tool.load_config(config_path)

    patterns = []
    for ext in ['*.png', '*.jpg', '*.jpeg', '*.webp']:
        patterns.extend(Path(patterns_dir).glob(ext))

    if not patterns:
        print(f"❌ 在 {patterns_dir} 中没有找到图案文件")
        return

    print(f"📦 找到 {len(patterns)} 个图案，开始批量处理...\n")
    for p in patterns:
        out = os.path.join(output_dir, f"pod_{p.stem}.png")
        tool.apply_pattern(str(p), out, blend_mode="overlay", texture_strength=0.3)

    print(f"\n🎉 批量完成！共 {len(patterns)} 张，保存在 {output_dir}/")


def main():
    parser = argparse.ArgumentParser(description="POD 产品图贴图工具")
    parser.add_argument("--template", "-t", required=True, help="模板产品图路径")
    parser.add_argument("--pattern", "-p", help="单个图案路径")
    parser.add_argument("--patterns", "-P", help="图案目录（批量模式）")
    parser.add_argument("--config", "-c", help="区域配置文件 (JSON)")
    parser.add_argument("--save-config", "-s", help="保存当前区域到配置文件")
    parser.add_argument("--output", "-o", help="输出路径")
    parser.add_argument("--output-dir", default="./pod_output", help="批量输出目录")
    parser.add_argument("--blend", choices=["replace", "overlay", "multiply"],
                        default="overlay", help="融合模式")
    parser.add_argument("--texture", type=float, default=0.3, help="纹理强度 0~1")
    parser.add_argument("--interactive", "-i", action="store_true", help="交互式选点")

    args = parser.parse_args()

    tool = PODTool(args.template)

    # 设置区域
    if args.config:
        tool.load_config(args.config)
    elif args.interactive:
        tool.select_region_interactive()
        if tool.corners is None:
            print("取消选择")
            return
    else:
        print("请用 --config 指定区域配置 或 --interactive 交互选点")
        return

    # 保存配置
    if args.save_config:
        tool.save_config(args.save_config)

    # 处理
    if args.patterns:
        batch_process(args.template, args.patterns, args.config or args.save_config, args.output_dir)
    elif args.pattern:
        tool.apply_pattern(args.pattern, args.output, args.blend, args.texture)
    else:
        print("请指定 --pattern (单图) 或 --patterns (批量目录)")


if __name__ == "__main__":
    main()
