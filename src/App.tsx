import { ChangeEvent, useMemo, useState } from "react";
import {
  App as AntApp,
  Alert,
  Button,
  Card,
  ConfigProvider,
  Empty,
  Flex,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Typography
} from "antd";
import { DownloadOutlined, ExperimentOutlined, EyeOutlined, PictureOutlined, UploadOutlined } from "@ant-design/icons";
import {
  calculateGenerationCost,
  createGenerationBatch,
  GenerationPair,
  ImageSize
} from "./lib/generator";
import { createDoubaoGenerationBatch } from "./lib/doubao";
import "./App.css";

const { Text, Title } = Typography;
const { TextArea } = Input;

const imageSizes: ImageSize[] = ["1:1", "4:3", "3:4", "16:9"];
const generationCounts = [1, 2, 3, 4, 6];

export default function App() {
  const [sampleImageUrl, setSampleImageUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSize>("1:1");
  const [count, setCount] = useState(4);
  const [points, setPoints] = useState(120);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationPair[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewImage, setPreviewImage] = useState<{ title: string; imageUrl: string } | null>(null);

  const estimatedCost = useMemo(() => calculateGenerationCost(count), [count]);
  const canGenerate = Boolean(sampleImageUrl && prompt.trim()) && points >= estimatedCost && !isGenerating;

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setSampleImageUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!sampleImageUrl || !prompt.trim()) {
      setError("请先上传示例图片并填写提示词。");
      return;
    }

    if (points < estimatedCost) {
      setError("点数不足，无法生成当前数量的图片。");
      return;
    }

    setError("");
    setNotice("");
    setIsGenerating(true);
    setResults([]);

    try {
      const batch = await createDoubaoGenerationBatch({
        prompt: prompt.trim(),
        size,
        count,
        sampleImageUrl
      });

      setResults(batch);
      setPoints((current) => current - estimatedCost);
    } catch (generationError) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      const batch = createGenerationBatch({
        prompt: prompt.trim(),
        size,
        count,
        sampleImageUrl
      });

      setResults(batch);
      setPoints((current) => current - estimatedCost);
      setNotice(
        generationError instanceof Error
          ? `${generationError.message}；已切换为本地模拟生成。`
          : "Doubao 图片生成失败；已切换为本地模拟生成。"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#f0b35a",
          colorSuccess: "#8dd8bd",
          borderRadius: 8,
          fontFamily:
            "Aptos, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        },
        components: {
          Button: {
            controlHeight: 46,
            fontWeight: 800
          },
          Card: {
            borderRadiusLG: 8
          }
        }
      }}
    >
      <AntApp>
        <main className="app-shell">
          <header className="topbar">
            <div>
              <Text className="eyebrow">AI product studio</Text>
              <Title level={1}>产品图片生成器</Title>
              <Text className="topbar-copy">
                从蟾皮纹理到门帘贴膜效果，一屏完成生成、预览和点数核算。
              </Text>
            </div>
            <Card className="points-panel" aria-label="点数余额">
              <Statistic title="Balance" value={`剩余 ${points} 点`} />
              <Text type="secondary">每张图片 1 点</Text>
            </Card>
          </header>

          <section className="workbench" aria-label="产品图片生成工作台">
            <Card className="control-panel" variant="borderless">
              <Text className="rail-label">Input console</Text>
              <Flex className="panel-heading" align="center" gap={10}>
                <ExperimentOutlined />
                <Title level={2}>生成设置</Title>
              </Flex>

              <label className="upload-box">
                <input aria-label="上传示例图片" type="file" accept="image/*" onChange={handleUpload} />
                {sampleImageUrl ? (
                  <img src={sampleImageUrl} alt="示例产品预览" />
                ) : (
                  <Space orientation="vertical" align="center">
                    <UploadOutlined />
                    <Text>上传示例图片</Text>
                  </Space>
                )}
              </label>

              <Space orientation="vertical" size={16} className="form-stack">
                <label className="field">
                  <span>提示词</span>
                  <TextArea
                    aria-label="提示词"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="例如：青绿色蟾皮纹理，细腻颗粒，高级哑光质感"
                    rows={5}
                    showCount
                    maxLength={180}
                  />
                </label>

                <div className="field">
                  <span>图片规格</span>
                  <Segmented<ImageSize>
                    block
                    options={imageSizes}
                    value={size}
                    onChange={(value) => setSize(value)}
                  />
                </div>

                <label className="field">
                  <span>生成数量</span>
                  <Select
                    aria-label="生成数量"
                    value={count}
                    onChange={(value) => setCount(value)}
                    options={generationCounts.map((item) => ({
                      value: item,
                      label: `${item} 组`
                    }))}
                  />
                </label>

                <Alert
                  className="cost-line"
                  type="success"
                  showIcon
                  title={`预计消耗 ${estimatedCost} 点`}
                  description={`${count} 张风格图 + ${count} 张产品图`}
                />

                {error ? <Alert type="error" title={error} showIcon /> : null}
                {notice ? <Alert type="warning" title={notice} showIcon /> : null}

                <Button
                  block
                  className="generate-button"
                  disabled={!canGenerate}
                  icon={<PictureOutlined />}
                  loading={isGenerating}
                  onClick={handleGenerate}
                  type="primary"
                >
                  开始生成
                </Button>
              </Space>
            </Card>

            <ResultColumn
              title="生成图片"
              subtitle="根据提示词生成的风格图"
              emptyText="生成后将在这里显示中间风格图"
              isGenerating={isGenerating}
              onPreview={setPreviewImage}
              results={results.map((item) => ({
                id: `${item.id}-prompt`,
                title: item.promptTitle,
                imageUrl: item.promptImageUrl
              }))}
            />

            <ResultColumn
              title="产品贴膜图"
              subtitle="把中间风格图套用到示例产品"
              emptyText="右侧会显示对应的产品贴膜效果"
              isGenerating={isGenerating}
              onPreview={setPreviewImage}
              results={results.map((item) => ({
                id: `${item.id}-product`,
                title: item.productTitle,
                imageUrl: item.productImageUrl,
                overlayImageUrl: item.productOverlayImageUrl
              }))}
            />
          </section>
          <Modal
            centered
            footer={null}
            onCancel={() => setPreviewImage(null)}
            open={Boolean(previewImage)}
            title={previewImage?.title}
            width="min(92vw, 960px)"
          >
            {previewImage ? <img className="preview-image" src={previewImage.imageUrl} alt={previewImage.title} /> : null}
          </Modal>
        </main>
      </AntApp>
    </ConfigProvider>
  );
}

type ResultColumnProps = {
  title: string;
  subtitle: string;
  emptyText: string;
  isGenerating: boolean;
  onPreview: (image: { title: string; imageUrl: string }) => void;
  results: Array<{ id: string; title: string; imageUrl: string; overlayImageUrl?: string }>;
};

function ResultColumn({ title, subtitle, emptyText, isGenerating, onPreview, results }: ResultColumnProps) {
  return (
    <Card className="result-column" variant="borderless">
      <Text className="rail-label">Output bay</Text>
      <div className="column-title">
        <Title level={2}>{title}</Title>
        <Text type="secondary">{subtitle}</Text>
      </div>

      {isGenerating ? (
        <div className="loading-state">
          <Spin size="large" />
          <Text>正在生成...</Text>
        </div>
      ) : null}

      {!isGenerating && results.length === 0 ? (
        <Empty className="empty-state" image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      ) : null}

      <div className="result-grid">
        {results.map((item) => {
          const displayImageUrl = item.overlayImageUrl ?? item.imageUrl;

          return (
            <Card
              className="result-card"
              cover={
                <div className="result-card-visual">
                  {item.overlayImageUrl ? (
                    <div className="product-composite">
                      <img className="product-base" src={item.imageUrl} alt={item.title} />
                      <img className="product-overlay" src={item.overlayImageUrl} alt="" aria-hidden="true" />
                    </div>
                  ) : (
                    <img src={item.imageUrl} alt={item.title} />
                  )}
                  <Space className="result-actions" size={6}>
                    <Button
                      aria-label={`预览 ${item.title}`}
                      icon={<EyeOutlined />}
                      onClick={() => onPreview({ title: item.title, imageUrl: displayImageUrl })}
                      size="small"
                    />
                    <Button
                      aria-label={`保存 ${item.title}`}
                      download={`${item.title}.png`}
                      href={displayImageUrl}
                      icon={<DownloadOutlined />}
                      size="small"
                      target="_blank"
                    />
                  </Space>
                </div>
              }
              key={item.id}
              size="small"
            />
          );
        })}
      </div>
    </Card>
  );
}
