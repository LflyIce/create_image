#!/usr/bin/env python3
"""
POD 贴图工具 v2 - 精确蒙版版
支持多边形蒙版精确裁剪地垫形状（包括U形镂空）
"""

import cv2
import numpy as np
from PIL import Image
import json
import os
import sys
import argparse
from pathlib import Path


class PODToolV2:
    def __init__(self, template_path):
        self.template = cv2.imread(template_path)
        if self.template is None:
            raise FileNotFoundError(f"找不到模板图片: {template_path}")
        self.template_path = template_path
        self.outer_polygon = None  # 外轮廓
        self.inner_polygons = []   # 内部镂空（如马桶位置）
        self.corners = None        # 四角点（用于透视变换）

    def load_config(self, config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        self.corners = np.float32(config["corners"])
        
        # 外轮廓（完整地垫形状）
        if "outer_polygon" in config:
            self.outer_polygon = np.array(config["outer_polygon"], dtype=np.int32)
        
        # 内部镂空区域
        if "inner_polygons" in config:
            self.inner_polygons = [np.array(p, dtype=np.int32) for p in config["inner_polygons"]]
        
        print(f"✅ 配置已加载: {config_path}")

    def save_config(self, config_path):
        config = {
            "template": self.template_path,
            "corners": self.corners.tolist(),
        }
        if self.outer_polygon is not None:
            config["outer_polygon"] = self.outer_polygon.tolist()
        if self.inner_polygons:
            config["inner_polygons"] = [p.tolist() for p in self.inner_polygons]
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"✅ 配置已保存: {config_path}")

    def _create_mask(self):
        """创建精确蒙版"""
        h, w = self.template.shape[:2]
        mask = np.zeros((h, w), dtype=np.uint8)
        
        if self.outer_polygon is not None:
            cv2.fillPoly(mask, [self.outer_polygon], 255)
        else:
            cv2.fillConvexPoly(mask, self.corners.astype(np.int32), 255)
        
        # 减去内部镂空
        for inner in self.inner_polygons:
            cv2.fillPoly(mask, [inner], 0)
        
        return mask

    def apply_pattern(self, pattern_path, output_path=None, texture_strength=0.3,
                      edge_softness=3):
        """
        将图案贴到地垫区域
        
        Args:
            pattern_path: 图案路径
            output_path: 输出路径
            texture_strength: 原始纹理保留程度 0~1
            edge_softness: 边缘柔化像素数
        """
        if self.corners is None:
            raise ValueError("请先加载配置")

        pattern = cv2.imread(pattern_path, cv2.IMREAD_UNCHANGED)
        if pattern is None:
            raise FileNotFoundError(f"找不到图案: {pattern_path}")
        
        # 如果有alpha通道，分离出来
        if pattern.shape[2] == 4:
            pattern_alpha = pattern[:, :, 3] / 255.0
            pattern = pattern[:, :, :3]
        else:
            pattern_alpha = None

        result = self.template.copy()
        h, w = result.shape[:2]

        # 计算目标区域尺寸
        width_top = np.linalg.norm(self.corners[1] - self.corners[0])
        width_bottom = np.linalg.norm(self.corners[2] - self.corners[3])
        height_left = np.linalg.norm(self.corners[3] - self.corners[0])
        height_right = np.linalg.norm(self.corners[2] - self.corners[1])
        out_w = int(max(width_top, width_bottom))
        out_h = int(max(height_left, height_right))

        # 透视变换
        src_pts = np.float32([
            [0, 0],
            [pattern.shape[1], 0],
            [pattern.shape[1], pattern.shape[0]],
            [0, pattern.shape[0]]
        ])
        M = cv2.getPerspectiveTransform(src_pts, self.corners)
        warped = cv2.warpPerspective(pattern, M, (w, h),
                                     flags=cv2.INTER_LINEAR,
                                     borderMode=cv2.BORDER_REPLICATE)

        # 创建精确蒙版
        mask = self._create_mask()
        
        # 边缘柔化
        if edge_softness > 0:
            mask = cv2.GaussianBlur(mask, (edge_softness * 2 + 1, edge_softness * 2 + 1), 0)

        mask_float = mask.astype(np.float32) / 255.0

        # 提取原始纹理
        if texture_strength > 0:
            gray = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY).astype(np.float32)
            blurred = cv2.GaussianBlur(gray, (0, 0), 3)
            texture = (gray - blurred)  # 高频细节
            texture_3ch = np.stack([texture] * 3, axis=-1)
        else:
            texture_3ch = np.zeros_like(result, dtype=np.float32)

        # 混合
        result_f = result.astype(np.float32)
        warped_f = warped.astype(np.float32)
        
        for i in range(3):
            blended = warped_f[:, :, i] + texture_3ch[:, :, i] * texture_strength * 3
            blended = np.clip(blended, 0, 255)
            result_f[:, :, i] = (
                result_f[:, :, i] * (1 - mask_float) + 
                blended * mask_float
            )
        
        result = result_f.astype(np.uint8)

        if output_path is None:
            tpl = Path(self.template_path).stem
            pat = Path(pattern_path).stem
            output_path = f"output_{tpl}_{pat}.png"

        cv2.imwrite(output_path, result)
        print(f"✅ 已保存: {output_path}")
        return output_path

    def preview_region(self, output_path="preview_region.png"):
        """预览选中的区域"""
        result = self.template.copy()
        mask = self._create_mask()
        
        # 半透明绿色覆盖
        overlay = result.copy()
        overlay[mask > 0] = [0, 255, 0]
        result = cv2.addWeighted(result, 0.7, overlay, 0.3, 0)
        
        # 画轮廓
        if self.outer_polygon is not None:
            cv2.polylines(result, [self.outer_polygon], True, (0, 255, 0), 2)
        for inner in self.inner_polygons:
            cv2.polylines(result, [inner], True, (0, 0, 255), 2)
        
        # 画四角点
        for i, pt in enumerate(self.corners.astype(int)):
            cv2.circle(result, tuple(pt), 6, (0, 0, 255), -1)
            cv2.putText(result, str(i+1), (pt[0]+10, pt[1]-10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)
        
        cv2.imwrite(output_path, result)
        print(f"✅ 预览已保存: {output_path}")


def batch_process(template_path, patterns_dir, config_path, output_dir="./pod_output"):
    os.makedirs(output_dir, exist_ok=True)
    tool = PODToolV2(template_path)
    tool.load_config(config_path)

    patterns = []
    for ext in ['*.png', '*.jpg', '*.jpeg', '*.webp']:
        patterns.extend(Path(patterns_dir).glob(ext))

    if not patterns:
        print(f"❌ 没有找到图案文件")
        return

    print(f"📦 找到 {len(patterns)} 个图案，开始批量处理...\n")
    for p in patterns:
        out = os.path.join(output_dir, f"pod_{p.stem}.png")
        tool.apply_pattern(str(p), out, texture_strength=0.3)

    print(f"\n🎉 批量完成！{len(patterns)} 张 → {output_dir}/")


def main():
    parser = argparse.ArgumentParser(description="POD v2 精确贴图工具")
    parser.add_argument("-t", "--template", required=True, help="模板图")
    parser.add_argument("-p", "--pattern", help="单个图案")
    parser.add_argument("-P", "--patterns", help="图案目录（批量）")
    parser.add_argument("-c", "--config", help="区域配置文件")
    parser.add_argument("-o", "--output", help="输出路径")
    parser.add_argument("--output-dir", default="./pod_output", help="批量输出目录")
    parser.add_argument("--texture", type=float, default=0.3, help="纹理强度 0~1")
    parser.add_argument("--preview", action="store_true", help="只预览区域")
    args = parser.parse_args()

    tool = PODToolV2(args.template)
    if args.config:
        tool.load_config(args.config)

    if args.preview:
        tool.preview_region()
        return

    if args.patterns:
        batch_process(args.template, args.patterns, args.config, args.output_dir)
    elif args.pattern:
        tool.apply_pattern(args.pattern, args.output, texture_strength=args.texture)
    else:
        print("请指定 -p (单图) 或 -P (批量)")


if __name__ == "__main__":
    main()
