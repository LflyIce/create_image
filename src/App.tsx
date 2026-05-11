import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  App as AntApp,
  Alert,
  Button,
  Card,
  ConfigProvider,
  Divider,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography
} from "antd";
import {
  DashboardOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  EyeOutlined,
  LogoutOutlined,
  PictureOutlined,
  PlusCircleOutlined,
  SearchOutlined,
  ShoppingOutlined,
  UploadOutlined,
  UserOutlined,
  WalletOutlined
} from "@ant-design/icons";
import {
  calculateDirectPasteCost,
  calculateGenerationCost,
  createDirectPastePreview,
  createGenerationBatch,
  DirectPasteResult,
  GenerationPair,
  ImageSize,
  ImageModel,
  IMAGE_MODEL_OPTIONS,
  isDoubaoModel,
  isIrisModel
} from "./lib/generator";
import { createDoubaoDirectPaste, createDoubaoGenerationBatch } from "./lib/doubao";
import { createIrisDirectPaste, createIrisGenerationBatch } from "./lib/iris";
import "./App.css";

const { Text, Title } = Typography;
const { TextArea } = Input;

const imageSizes: ImageSize[] = ["1:1", "4:3", "3:4", "16:9"];
const generationCounts = [1, 2, 3, 4, 6];

type UserInfo = { id: number; phone: string; points: number; role: string };

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "https://pod.jiuyueice.cloud").replace(/\/+$/, "");
const LOCAL_DEV_USER: UserInfo = { id: 0, phone: "13800000000", points: 120, role: "user" };

function shouldBypassAuth() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getToken(): string { return localStorage.getItem("pod_token") || ""; }
function setToken(token: string) { localStorage.setItem("pod_token", token); }
function clearToken() { localStorage.removeItem("pod_token"); }
async function api<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
  });
  return (await res.json()) as T;
}

// ═══════════════════════════════════════════════
// Login Page
// ═══════════════════════════════════════════════
function LoginPage({ onLogin }: { onLogin: (user: UserInfo) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [smsCooldown, setSmsCooldown] = useState(0);

  useEffect(() => {
    if (smsCooldown <= 0) return;
    const timer = setTimeout(() => setSmsCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [smsCooldown]);

  async function sendCode(phone: string) {
    if (!/^1[3-9]\d{9}$/.test(phone)) { setError("请输入正确的手机号"); return; }
    setError("");
    try {
      const data = await api<{ ok?: boolean; error?: string }>("/api/sms/send", { method: "POST", body: JSON.stringify({ phone }) });
      if (data.error) setError(data.error); else setSmsCooldown(60);
    } catch { setError("发送失败，请重试"); }
  }

  async function handleLogin(values: { phone: string; password: string }) {
    setError(""); setLoading(true);
    try {
      const data = await api<{ ok?: boolean; token?: string; user?: UserInfo; error?: string }>("/api/login", { method: "POST", body: JSON.stringify(values) });
      if (data.error) setError(data.error);
      else if (data.token && data.user) { setToken(data.token); onLogin(data.user); }
    } catch { setError("网络错误"); } finally { setLoading(false); }
  }

  async function handleRegister(values: { phone: string; password: string; code: string }) {
    setError(""); setLoading(true);
    try {
      const data = await api<{ ok?: boolean; token?: string; user?: UserInfo; error?: string }>("/api/register", { method: "POST", body: JSON.stringify(values) });
      if (data.error) setError(data.error);
      else if (data.token && data.user) { setToken(data.token); onLogin(data.user); }
    } catch { setError("网络错误"); } finally { setLoading(false); }
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-header">
          <Text className="eyebrow">AI product studio</Text>
          <Title level={2}>{mode === "login" ? "登录" : "注册"}</Title>
          <Text type="secondary">{mode === "login" ? "使用手机号和密码登录" : "注册账号获取 50 免费点数"}</Text>
        </div>
        {error ? <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} closable onClose={() => setError("")} /> : null}
        {mode === "login" ? (
          <Form onFinish={handleLogin} layout="vertical" requiredMark={false}>
            <Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }, { pattern: /^1[3-9]\d{9}$/, message: "手机号格式不正确" }]}>
              <Input prefix={<UserOutlined />} placeholder="输入手机号" size="large" maxLength={11} />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password placeholder="输入密码" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" className="login-submit">登录</Button>
          </Form>
        ) : (
          <Form onFinish={handleRegister} layout="vertical" requiredMark={false}>
            <Form.Item name="phone" label="手机号" rules={[{ required: true, message: "请输入手机号" }, { pattern: /^1[3-9]\d{9}$/, message: "手机号格式不正确" }]}>
              <Input prefix={<UserOutlined />} placeholder="输入手机号" size="large" maxLength={11} />
            </Form.Item>
            <Form.Item label="验证码" required>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item name="code" noStyle rules={[{ required: true, message: "请输入验证码" }]}>
                  <Input placeholder="6位验证码" size="large" maxLength={6} style={{ flex: 1 }} />
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.phone !== cur.phone}>
                  {({ getFieldValue }) => (
                    <Button size="large" disabled={smsCooldown > 0 || !/^1[3-9]\d{9}$/.test(getFieldValue("phone") || "")} onClick={() => sendCode(getFieldValue("phone"))} style={{ minWidth: 120 }}>
                      {smsCooldown > 0 ? `${smsCooldown}s` : "获取验证码"}
                    </Button>
                  )}
                </Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item name="password" label="设置密码" rules={[{ required: true, message: "请设置密码" }, { min: 4, message: "密码至少4个字符" }]}>
              <Input.Password placeholder="设置登录密码" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" className="login-submit">注册</Button>
          </Form>
        )}
        <div className="login-switch">
          <Text type="secondary">{mode === "login" ? "没有账号？" : "已有账号？"}</Text>
          <Button type="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "去注册" : "去登录"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Admin Dashboard
// ═══════════════════════════════════════════════
function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<Array<{ id: number; phone: string; points: number; role: string; created_at: string }>>([]);
  const [logs, setLogs] = useState<Array<{ id: number; user_id: number; phone: string; change: number; reason: string; created_at: string }>>([]);
  const [stats, setStats] = useState({ userCount: 0, totalConsumed: 0, totalRecharged: 0 });
  const [loading, setLoading] = useState(true);
  const [rechargeModal, setRechargeModal] = useState<{ open: boolean; userId: number; phone: string }>({ open: false, userId: 0, phone: "" });
  const [rechargeForm] = Form.useForm();
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState("");
  const pageSize = 20;

  async function loadData() {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        api<{ users: typeof users }>("/api/admin/users"),
        api<{ userCount: number; totalConsumed: number; totalRecharged: number }>("/api/admin/stats"),
      ]);
      setUsers(u.users || []);
      setStats(s);
    } catch {} finally { setLoading(false); }
  }

  async function loadLogs(page: number) {
    const data = await api<{ logs: typeof logs; total: number }>(`/api/admin/logs?page=${page}&pageSize=${pageSize}`);
    setLogs(data.logs || []);
    setLogTotal(data.total || 0);
    setLogPage(page);
  }

  useEffect(() => { loadData(); loadLogs(1); }, []);

  async function handleRecharge(values: { points: number; reason: string }) {
    const data = await api<{ ok?: boolean; error?: string }>("/api/admin/add-points", {
      method: "POST",
      body: JSON.stringify({ userId: rechargeModal.userId, ...values }),
    });
    if (data.ok) {
      setRechargeModal({ open: false, userId: 0, phone: "" });
      rechargeForm.resetFields();
      loadData();
      loadLogs(1);
    }
  }

  const userColumns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "手机号", dataIndex: "phone", render: (p: string) => `${p.slice(0, 3)}****${p.slice(7)}` },
    { title: "剩余点数", dataIndex: "points", render: (p: number) => <Text strong style={{ color: "var(--brand)" }}>{p}</Text> },
    { title: "角色", dataIndex: "role", render: (r: string) => <Tag color={r === "admin" ? "gold" : "default"}>{r === "admin" ? "管理员" : "用户"}</Tag> },
    { title: "注册时间", dataIndex: "created_at", width: 170 },
    {
      title: "操作", width: 120, render: (_: unknown, record: typeof users[0]) => (
        <Button size="small" type="primary" icon={<PlusCircleOutlined />} onClick={() => setRechargeModal({ open: true, userId: record.id, phone: record.phone })}>充值</Button>
      ),
    },
  ];

  const logColumns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "手机号", dataIndex: "phone", render: (p: string) => p ? `${p.slice(0, 3)}****${p.slice(7)}` : "-" },
    { title: "变动", dataIndex: "change", render: (c: number) => (
      <Text style={{ color: c > 0 ? "#27a644" : "#ff4d4f", fontWeight: 600 }}>{c > 0 ? `+${c}` : c}</Text>
    )},
    { title: "原因", dataIndex: "reason" },
    { title: "时间", dataIndex: "created_at", width: 170 },
  ];

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <Text className="eyebrow">Admin Panel</Text>
          <Title level={2} style={{ margin: "4px 0 0" }}>管理后台</Title>
        </div>
        <Button icon={<DashboardOutlined />} onClick={onBack}>返回工作台</Button>
      </header>

      <div className="admin-stats">
        <Card className="admin-stat-card"><Statistic title="注册用户" value={stats.userCount} /></Card>
        <Card className="admin-stat-card"><Statistic title="累计消耗" value={stats.totalConsumed} suffix="点" valueStyle={{ color: "#ff4d4f" }} /></Card>
        <Card className="admin-stat-card"><Statistic title="累计充值" value={stats.totalRecharged} suffix="点" valueStyle={{ color: "#27a644" }} /></Card>
      </div>

      <Card className="admin-table-card">
        <Tabs items={[
          {
            key: "users", label: `用户管理 (${users.length})`,
            children: (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="搜索手机号后四位"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    allowClear
                    style={{ width: 240 }}
                  />
                </div>
                <Table
                  dataSource={searchKeyword
                    ? users.filter((u) => u.phone.includes(searchKeyword))
                    : users
                  }
                  columns={userColumns} rowKey="id" loading={loading}
                  pagination={false} size="middle" className="admin-table" />
              </>
            ),
          },
          {
            key: "logs", label: `点数日志`,
            children: (
              <Table dataSource={logs} columns={logColumns} rowKey="id" loading={loading}
                size="middle" className="admin-table"
                pagination={{ current: logPage, pageSize, total: logTotal, onChange: loadLogs, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }} />
            ),
          },
        ]} />
      </Card>

      <Modal title={`给 ${rechargeModal.phone.slice(0, 3)}****${rechargeModal.phone.slice(7)} 充值`} open={rechargeModal.open} onCancel={() => setRechargeModal({ open: false, userId: 0, phone: "" })} footer={null}>
        <Form form={rechargeForm} onFinish={handleRecharge} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="points" label="充值点数" rules={[{ required: true, message: "请输入点数" }]}>
            <InputNumber min={1} max={10000} style={{ width: "100%" }} placeholder="输入点数" />
          </Form.Item>
          <Form.Item name="reason" label="备注" initialValue="管理员充值">
            <Input placeholder="充值原因" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block className="login-submit">确认充值</Button>
        </Form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Main App
// ═══════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [sampleImageUrl, setSampleImageUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSize>("1:1");
  const [model, setModel] = useState<ImageModel>("doubao-seedream-5-0-260128");
  const [count, setCount] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationPair[]>([]);
  const [pasteProductImageUrl, setPasteProductImageUrl] = useState("");
  const [pastePatternImageUrl, setPastePatternImageUrl] = useState("");
  const [isPasting, setIsPasting] = useState(false);
  const [pasteResult, setPasteResult] = useState<DirectPasteResult | null>(null);
  const [pasteError, setPasteError] = useState("");
  const [pasteNotice, setPasteNotice] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewImage, setPreviewImage] = useState<{ title: string; imageUrl: string } | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [pointsExhausted, setPointsExhausted] = useState(false);

  useEffect(() => {
    if (shouldBypassAuth()) {
      setUser(LOCAL_DEV_USER);
      setAuthReady(true);
      return;
    }

    const token = getToken();
    if (!token) { setAuthReady(true); return; }
    api<{ user?: UserInfo; error?: string }>("/api/me")
      .then((data) => { if (data.user) setUser(data.user); else clearToken(); })
      .catch(() => clearToken())
      .finally(() => setAuthReady(true));
  }, []);

  const points = user?.points ?? 0;
  const estimatedCost = useMemo(() => calculateGenerationCost(count), [count]);
  const directPasteCost = useMemo(() => calculateDirectPasteCost(), []);
  const canGenerate = Boolean(sampleImageUrl && prompt.trim()) && points >= estimatedCost && !isGenerating;
  const canDirectPaste = Boolean(pasteProductImageUrl && pastePatternImageUrl) && points >= directPasteCost && !isPasting;

  function handleLogout() {
    clearToken();
    setShowAdmin(false);
    setUser(shouldBypassAuth() ? LOCAL_DEV_USER : null);
  }
  function readUploadedImage(event: ChangeEvent<HTMLInputElement>, onLoad: (imageUrl: string) => void) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLoad(String(reader.result));
    reader.readAsDataURL(file);
  }
  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    readUploadedImage(event, setSampleImageUrl);
  }
  function handlePasteProductUpload(event: ChangeEvent<HTMLInputElement>) {
    readUploadedImage(event, setPasteProductImageUrl);
  }
  function handlePastePatternUpload(event: ChangeEvent<HTMLInputElement>) {
    readUploadedImage(event, setPastePatternImageUrl);
  }

  async function handleGenerate() {
    if (!sampleImageUrl || !prompt.trim()) { setError("请先上传示例图片并填写提示词。"); return; }
    if (points < estimatedCost) {
      setPointsExhausted(true);
      return;
    }
    setError(""); setNotice("");
    if (shouldBypassAuth()) {
      setUser((current) => current ? { ...current, points: current.points - estimatedCost } : LOCAL_DEV_USER);
    } else {
      try {
        const deductResult = await api<{ ok?: boolean; remaining?: number; error?: string }>("/api/points/deduct", { method: "POST", body: JSON.stringify({ amount: estimatedCost }) });
        if (deductResult.error) {
          if (deductResult.error.includes("不足")) {
            setPointsExhausted(true);
          } else {
            setError(deductResult.error);
          }
          return;
        }
        if (user) setUser({ ...user, points: deductResult.remaining ?? 0 });
      } catch {
        setError("扣费失败，请重试");
        return;
      }
    }
    setIsGenerating(true); setResults([]);
    try {
      const batch = isIrisModel(model)
        ? await createIrisGenerationBatch({ prompt: prompt.trim(), size, count, sampleImageUrl, model })
        : await createDoubaoGenerationBatch({ prompt: prompt.trim(), size, count, sampleImageUrl, model });
      setResults(batch);
    } catch (generationError) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      const batch = createGenerationBatch({ prompt: prompt.trim(), size, count, sampleImageUrl, model });
      setResults(batch);
      setNotice(generationError instanceof Error ? `${generationError.message}；已切换为本地模拟生成。` : "Doubao 图片生成失败；已切换为本地模拟生成。");
    } finally { setIsGenerating(false); }
  }

  async function handleDirectPaste() {
    if (!pasteProductImageUrl || !pastePatternImageUrl) {
      setPasteError("请先上传产品图和要贴到产品上的图片。");
      return;
    }
    if (points < directPasteCost) {
      setPasteError(`点数不足，本次贴图需要 ${directPasteCost} 点。`);
      return;
    }

    setPasteError("");
    setPasteNotice("");
    setPasteResult(null);

    if (shouldBypassAuth()) {
      setUser((current) => current ? { ...current, points: current.points - directPasteCost } : LOCAL_DEV_USER);
    } else {
      try {
        const deductResult = await api<{ ok?: boolean; remaining?: number; error?: string }>("/api/points/deduct", {
          method: "POST",
          body: JSON.stringify({ amount: directPasteCost })
        });
        if (deductResult.error) {
          setPasteError(deductResult.error);
          return;
        }
        if (user) setUser({ ...user, points: deductResult.remaining ?? 0 });
      } catch {
        setPasteError("扣费失败，请重试");
        return;
      }
    }

    setIsPasting(true);
    try {
      const result = isIrisModel(model)
        ? await createIrisDirectPaste(pasteProductImageUrl, pastePatternImageUrl, model)
        : await createDoubaoDirectPaste(pasteProductImageUrl, pastePatternImageUrl, isDoubaoModel(model) ? model : "doubao-seedream-5-0-260128");
      setPasteResult(result);
    } catch (generationError) {
      await new Promise((resolve) => setTimeout(resolve, 360));
      setPasteResult(createDirectPastePreview(pasteProductImageUrl, pastePatternImageUrl));
      setPasteNotice(
        generationError instanceof Error
          ? `${generationError.message}；已切换为本地贴图预览。`
          : "Doubao 贴图生成失败；已切换为本地贴图预览。"
      );
    } finally {
      setIsPasting(false);
    }
  }

  const darkTheme = {
    token: { colorPrimary: "#f0b35a", colorSuccess: "#27a644", borderRadius: 6, fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", colorBgContainer: "#191a1b", colorBgElevated: "#191a1b", colorText: "#f7f8f8", colorTextSecondary: "#8a8f98", colorTextTertiary: "#62666d", colorBorder: "rgba(255,255,255,0.08)", colorFillSecondary: "rgba(255,255,255,0.04)", colorError: "#ff4d4f", colorWarning: "#faad14" },
    components: { Button: { controlHeight: 44, fontWeight: 600, defaultBg: "rgba(255,255,255,0.04)", defaultColor: "#d0d6e0", defaultBorderColor: "rgba(255,255,255,0.08)" }, Card: { borderRadiusLG: 12, colorBgContainer: "#0f1011", colorBorderSecondary: "rgba(255,255,255,0.08)" }, Input: { colorBgContainer: "rgba(255,255,255,0.04)", activeBorderColor: "#f0b35a", hoverBorderColor: "rgba(255,255,255,0.15)" }, Segmented: { colorBgContainer: "rgba(255,255,255,0.03)" }, Select: { colorBgContainer: "rgba(255,255,255,0.04)", optionSelectedBg: "#28282c" }, Alert: { colorBgContainer: "transparent" }, Statistic: { colorText: "#f7f8f8" }, Table: { colorBgContainer: "#0f1011", headerBg: "#191a1b", rowHoverBg: "rgba(255,255,255,0.04)" }, Tabs: { inkBarColor: "#f0b35a", itemActiveColor: "#f0b35a", itemSelectedColor: "#f0b35a" } }
  };

  if (!authReady) return (<div className="login-page"><Spin size="large" /></div>);
  if (!user) return (<ConfigProvider theme={darkTheme}><LoginPage onLogin={(u) => setUser(u)} /></ConfigProvider>);

  const phoneDisplay = user.phone ? `${user.phone.slice(0, 3)}****${user.phone.slice(7)}` : "";

  if (showAdmin && user.role === "admin") {
    return (
      <ConfigProvider theme={darkTheme}>
        <AdminDashboard onBack={() => setShowAdmin(false)} />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={darkTheme}>
      <AntApp>
        <main className="app-shell">
          <header className="topbar">
            <div>
              <Text className="eyebrow">AI product studio</Text>
              <Title level={1}>产品图片生成器</Title>
              <Text className="topbar-copy">从蟾皮纹理到门帘贴膜效果，一屏完成生成、预览和点数核算。</Text>
            </div>
            <Space align="center" size={10}>
              {user.role === "admin" && (
                <Button type="text" className="account-trigger" onClick={() => setShowAdmin(true)}>
                  <DashboardOutlined /><span>管理后台</span>
                </Button>
              )}
              <Popover
                placement="bottomRight" trigger="click"
                content={
                  <div className="account-panel">
                    <div className="account-row">
                      <WalletOutlined style={{ color: "var(--brand)" }} />
                      <span>剩余点数</span>
                      <strong className="account-points">{points} 点</strong>
                    </div>
                    <div className="account-divider" />
                    <Button icon={<ShoppingOutlined />} block className="account-action account-buy" onClick={() => setShowPricing(true)}>购买点数</Button>
                    <Button icon={<LogoutOutlined />} block className="account-action account-logout" onClick={handleLogout}>退出登录</Button>
                  </div>
                }
                title={<div className="account-title"><UserOutlined style={{ marginRight: 6 }} />{phoneDisplay}</div>}
              >
                <Button type="text" className="account-trigger">
                  <UserOutlined /><span>{phoneDisplay}</span>
                </Button>
              </Popover>
            </Space>
          </header>

          <Tabs
            className="workspace-tabs"
            defaultActiveKey="paste"
            items={[
              {
                key: "paste",
                label: "上传图片贴图",
                children: (
          <section className="paste-module" aria-label="直接贴图生成模块">
            <Card className="paste-control-panel" variant="borderless">
              <Text className="rail-label">Direct paste</Text>
              <Flex className="panel-heading" align="center" justify="space-between" gap={10}>
                <Flex align="center" gap={10}>
                  <PictureOutlined />
                  <Title level={2}>上传图片直接贴图</Title>
                </Flex>
                <Tag color="gold">消耗 {directPasteCost} 点</Tag>
              </Flex>

              <div className="paste-upload-grid">
                <label className="upload-box paste-upload-box">
                  <input aria-label="上传产品图" type="file" accept="image/*" onChange={handlePasteProductUpload} />
                  {pasteProductImageUrl ? (
                    <img src={pasteProductImageUrl} alt="待贴图产品预览" />
                  ) : (
                    <Space orientation="vertical" align="center">
                      <UploadOutlined />
                      <Text>上传产品图</Text>
                    </Space>
                  )}
                </label>
                <label className="upload-box paste-upload-box">
                  <input aria-label="上传贴图图片" type="file" accept="image/*" onChange={handlePastePatternUpload} />
                  {pastePatternImageUrl ? (
                    <img src={pastePatternImageUrl} alt="贴图图片预览" />
                  ) : (
                    <Space orientation="vertical" align="center">
                      <UploadOutlined />
                      <Text>上传贴图图片</Text>
                    </Space>
                  )}
                </label>
              </div>

              <Space orientation="vertical" size={12} className="form-stack">
                <div className="field"><span>生成模型</span><Select aria-label="直接贴图生成模型" value={model} onChange={(v) => setModel(v)} options={IMAGE_MODEL_OPTIONS} /></div>
                {pasteError ? <Alert type="error" title={pasteError} showIcon closable onClose={() => setPasteError("")} /> : null}
                {pasteNotice ? <Alert type="warning" title={pasteNotice} showIcon closable onClose={() => setPasteNotice("")} /> : null}
                <Button block className="generate-button" disabled={!canDirectPaste} icon={<PictureOutlined />} loading={isPasting} onClick={handleDirectPaste} type="primary">
                  {points < directPasteCost ? "点数不足" : "生成贴图产品图"}
                </Button>
              </Space>
            </Card>

            <ResultColumn title="贴图结果" subtitle="产品图与上传图片直接合成的成品图" emptyText="上传两张图片后将在这里显示贴图产品图"
              isGenerating={isPasting} onPreview={setPreviewImage}
              results={pasteResult ? [{ id: pasteResult.id, title: pasteResult.title, imageUrl: pasteResult.imageUrl }] : []} />
          </section>
                )
              },
              {
                key: "prompt",
                label: "提示词生成",
                children: (

          <section className="workbench" aria-label="产品图片生成工作台">
            <Card className="control-panel" variant="borderless">
              <Text className="rail-label">Input console</Text>
              <Flex className="panel-heading" align="center" gap={10}>
                <ExperimentOutlined /><Title level={2}>生成设置</Title>
              </Flex>
              <label className="upload-box">
                <input aria-label="上传示例图片" type="file" accept="image/*" onChange={handleUpload} />
                {sampleImageUrl ? (<img src={sampleImageUrl} alt="示例产品预览" />) : (
                  <Space orientation="vertical" align="center"><UploadOutlined /><Text>上传示例图片</Text></Space>
                )}
              </label>
              <Space orientation="vertical" size={16} className="form-stack">
                <label className="field">
                  <span>提示词</span>
                  <TextArea aria-label="提示词" value={prompt} onChange={(e) => setPrompt(e.target.value)}
                    placeholder="例如：这是一个门帘产品图，生成在阳光下绽放的茉莉花图片，蓝色的天空，白色的云" rows={5} showCount maxLength={180} />
                </label>
                <div className="field"><span>生成模型</span><Select aria-label="生成模型" value={model} onChange={(v) => setModel(v)} options={IMAGE_MODEL_OPTIONS} /></div>
                <div className="field"><span>图片规格</span><Segmented<ImageSize> block options={imageSizes} value={size} onChange={(v) => setSize(v)} /></div>
                <label className="field"><span>生成数量</span>
                  <Select aria-label="生成数量" value={count} onChange={(v) => setCount(v)}
                    options={generationCounts.map((i) => ({ value: i, label: `${i} 组` }))} />
                </label>
                <Alert className="cost-line" type="success" showIcon title={`预计消耗 ${estimatedCost} 点`} description={`${count} 张风格图 + ${count} 张产品图`} />
                {error ? <Alert type="error" title={error} showIcon closable onClose={() => setError("")} /> : null}
                {notice ? <Alert type="warning" title={notice} showIcon closable onClose={() => setNotice("")} /> : null}
                <Button block className="generate-button" disabled={!canGenerate} icon={<PictureOutlined />} loading={isGenerating} onClick={handleGenerate} type="primary">
                  {points < estimatedCost ? "点数不足" : "开始生成"}
                </Button>
              </Space>
            </Card>
            <ResultColumn title="生成图片" subtitle="根据提示词生成的风格图" emptyText="生成后将在这里显示中间风格图"
              isGenerating={isGenerating} onPreview={setPreviewImage}
              results={results.map((i) => ({ id: `${i.id}-prompt`, title: i.promptTitle, imageUrl: i.promptImageUrl }))} />
            <ResultColumn title="产品贴膜图" subtitle="把中间风格图套用到示例产品" emptyText="右侧会显示对应的产品贴膜效果"
              isGenerating={isGenerating} onPreview={setPreviewImage}
              results={results.map((i) => ({ id: `${i.id}-product`, title: i.productTitle, imageUrl: i.productImageUrl, overlayImageUrl: i.productOverlayImageUrl }))} />
          </section>
                )
              }
            ]}
          />
          <Modal centered footer={null} onCancel={() => setPreviewImage(null)} open={Boolean(previewImage)} title={previewImage?.title} width="min(92vw, 960px)">
            {previewImage ? <img className="preview-image" src={previewImage.imageUrl} alt={previewImage.title} /> : null}
          </Modal>

          {/* 充值套餐弹窗 */}
          <Modal
            centered
            title={<span><ShoppingOutlined style={{ marginRight: 8, color: "var(--brand)" }} />购买点数</span>}
            open={showPricing}
            onCancel={() => setShowPricing(false)}
            footer={null}
            width={520}
          >
            <div className="pricing-grid">
              {[
                { price: 29.9, points: 100, label: "基础包", perPoint: "0.299" },
                { price: 49.9, points: 180, label: "超值包", perPoint: "0.277", hot: true },
                { price: 99.9, points: 380, label: "专业包", perPoint: "0.263" },
              ].map((plan) => (
                <Card key={plan.price} className={`pricing-card ${plan.hot ? "pricing-card-hot" : ""}`} hoverable>
                  {plan.hot ? <div className="pricing-badge">推荐</div> : null}
                  <div className="pricing-label">{plan.label}</div>
                  <div className="pricing-points">{plan.points} 点</div>
                  <div className="pricing-price">¥{plan.price}</div>
                  <div className="pricing-per">¥{plan.perPoint}/点</div>
                  <Button type="primary" block className="login-submit" style={{ marginTop: 12, height: 36, fontSize: 13 }}>
                    联系客服购买
                  </Button>
                </Card>
              ))}
            </div>
          </Modal>

          {/* 点数不足弹窗 */}
          <Modal
            centered
            title={<span style={{ color: "#ff4d4f" }}>⚠️ 点数不足</span>}
            open={pointsExhausted}
            onCancel={() => setPointsExhausted(false)}
            footer={[
              <Button key="cancel" onClick={() => setPointsExhausted(false)}>取消</Button>,
              <Button key="buy" type="primary" className="login-submit" onClick={() => { setPointsExhausted(false); setShowPricing(true); }}>购买点数</Button>,
            ]}
          >
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💔</div>
              <Text style={{ fontSize: 16, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
                当前剩余 <Text strong style={{ color: "var(--brand)", fontSize: 20 }}>{points}</Text> 点，
                本次生成需要 <Text strong style={{ color: "#ff4d4f", fontSize: 20 }}>{estimatedCost}</Text> 点
              </Text>
              <Text type="secondary">点数不足无法生成，请购买点数后继续使用</Text>
            </div>
          </Modal>
        </main>
      </AntApp>
    </ConfigProvider>
  );
}

// ═══════════════════════════════════════════════
// Result Column
// ═══════════════════════════════════════════════
type ResultColumnProps = {
  title: string; subtitle: string; emptyText: string; isGenerating: boolean;
  onPreview: (image: { title: string; imageUrl: string }) => void;
  results: Array<{ id: string; title: string; imageUrl: string; overlayImageUrl?: string }>;
};

function ResultColumn({ title, subtitle, emptyText, isGenerating, onPreview, results }: ResultColumnProps) {
  return (
    <Card className="result-column" variant="borderless">
      <Text className="rail-label">Output bay</Text>
      <div className="column-title"><Title level={2}>{title}</Title><Text type="secondary">{subtitle}</Text></div>
      {isGenerating ? (<div className="loading-state"><Spin size="large" /><Text>正在生成...</Text></div>) : null}
      {!isGenerating && results.length === 0 ? (<Empty className="empty-state" image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />) : null}
      <div className="result-grid">
        {results.map((item) => {
          const displayImageUrl = item.overlayImageUrl ?? item.imageUrl;
          return (
            <Card className="result-card" cover={
              <div className="result-card-visual">
                {item.overlayImageUrl ? (
                  <div className="product-composite">
                    <img className="product-base" src={item.imageUrl} alt={item.title} />
                    <img className="product-overlay" src={item.overlayImageUrl} alt="" aria-hidden="true" />
                  </div>
                ) : (<img src={item.imageUrl} alt={item.title} />)}
                <Space className="result-actions" size={6}>
                  <Button aria-label={`预览 ${item.title}`} icon={<EyeOutlined />} onClick={() => onPreview({ title: item.title, imageUrl: displayImageUrl })} size="small" />
                  <Button aria-label={`保存 ${item.title}`} download={`${item.title}.png`} href={displayImageUrl} icon={<DownloadOutlined />} size="small" target="_blank" />
                </Space>
              </div>
            } key={item.id} size="small" />
          );
        })}
      </div>
    </Card>
  );
}
