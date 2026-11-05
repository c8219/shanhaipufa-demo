// LLM 配置：可配置实时问答模式。不硬编码任何密钥，Key 仅存于浏览器 localStorage。
// 未配置 Key 时，应用自动回退到 data.js 的静态预置内容（与方案"静态预置、关闭实时生成"声明一致）。
window.LLM = (function () {
  const KEY = "shanhaipufa.llm";

  // 兼容 OpenAI Chat Completions 协议的常见供应商预设
  const PRESETS = {
    deepseek: { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    openai:   { name: "OpenAI",   baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    qwen:     { name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
    zhipu:    { name: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
    custom:   { name: "自定义",    baseUrl: "", model: "" }
  };

  const SYS_PROMPT = `你是“山海普法通”，一个面向基层群众的法律科普助手。请用通俗易懂的中文回答，引用法条时写明名称与条号（如《民法典》第1062条）。涉及人身安全、紧迫危险或你无法确认的事项，请建议拨打 110 或 12348 公共法律服务热线。不要编造不存在的法条。`;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(cfg) { localStorage.setItem(KEY, JSON.stringify(cfg)); }

  function isLive() {
    const c = load();
    return !!(c.apiKey && c.baseUrl && c.model);
  }

  // 调用兼容端点；失败抛出，由调用方回退到预置
  async function chat(userText, onToken) {
    const c = load();
    if (!isLive()) throw new Error("未配置实时模型");
    const url = c.baseUrl.replace(/\/$/, "") + "/chat/completions";
    const body = {
      model: c.model,
      messages: [
        { role: "system", content: SYS_PROMPT },
        { role: "user", content: userText }
      ],
      temperature: 0.3,
      stream: false
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + c.apiKey },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error("LLM " + resp.status);
    const data = await resp.json();
    return (data.choices && data.choices[0] && data.choices[0].message.content) || "";
  }

  return { PRESETS, load, save, isLive, chat };
})();
