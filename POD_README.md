# POD 产品图贴图工具

一键将设计图案贴到产品模板图的指定区域，支持透视变换和纹理融合。

## 使用步骤

### 1️⃣ 准备模板图
拍一张或生成一张产品场景图（如门帘挂在门上的照片）

### 2️⃣ 标记贴图区域
用看图软件找到门帘区域四个角的像素坐标，写入配置文件：

```json
{
  "template": "template.jpg",
  "corners": [
    [x1, y1],  // 左上角
    [x2, y2],  // 右上角
    [x3, y3],  // 右下角
    [x4, y4]   // 左下角
  ]
}
```

### 3️⃣ 单张贴图
```bash
python pod_tool.py -t template.jpg -p design.png -c region.json -o result.png
```

### 4️⃣ 批量贴图
```bash
python pod_tool.py -t template.jpg -P ./designs/ -c region.json --output-dir ./output/
```

## 参数说明

| 参数 | 说明 |
|------|------|
| `--blend replace` | 直接替换（最清晰） |
| `--blend overlay` | 叠加纹理（保留门帘褶皱感） |
| `--blend multiply` | 正片叠底（更自然） |
| `--texture 0.3` | 纹理强度，0=无纹理，1=全纹理 |

## 快速上手示例

```bash
# 单张
python pod_tool.py -t my_door.jpg -p pattern1.png -c region.json

# 批量
python pod_tool.py -t my_door.jpg -P ./patterns/ -c region.json
```
