"use client";

import {
  BadgeCheck,
  BarChart3,
  Cloud,
  EyeOff,
  Facebook,
  FileSpreadsheet,
  Globe2,
  Instagram,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  UserRound,
  Users
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [captcha, setCaptcha] = useState("");
  const [captchaSrc, setCaptchaSrc] = useState(() => `/api/auth/captcha?t=${Date.now()}`);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const redirect = useMemo(() => {
    if (typeof window === "undefined") return "/admin";
    return new URLSearchParams(window.location.search).get("redirect") || "/admin";
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, captcha, remember })
    });
    setLoading(false);
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? "登录失败");
      return;
    }
    window.location.href = redirect;
  }

  function refreshCaptcha() {
    setCaptcha("");
    setCaptchaSrc(`/api/auth/captcha?t=${Date.now()}`);
  }

  return (
    <main className="login-page">
      <header className="login-header">
        <div className="login-brand">
          <div className="login-cloud"><Cloud size={32} /></div>
          <strong>MOTARRO<span>+</span></strong>
          <i />
          <b>询盘管理系统</b>
        </div>
        <button className="login-lang"><Globe2 size={18} /> 简体中文</button>
      </header>

      <section className="login-hero">
        <div className="login-copy">
          <h1>智能询盘管理<br />助力外贸<span>高效增长</span></h1>
          <p>整合询盘、报价、客户管理、数据分析等功能<br />让外贸业务更高效、更智能、更简单</p>
          <div className="login-features">
            <Feature icon={MessageCircle} color="blue" title="询盘跟进管理" text="实时跟踪客户询盘状态" />
            <Feature icon={FileSpreadsheet} color="green" title="智能报价管理" text="快速生成专业报价单" />
            <Feature icon={BarChart3} color="purple" title="客户数据分析" text="多维度分析客户行为" />
            <Feature icon={Users} color="orange" title="团队协同工作" text="提升团队协作效率" />
          </div>
          <div className="login-stats">
            <Stat value="50,000+" label="活跃用户" />
            <Stat value="120,000+" label="询盘总数" />
            <Stat value="98.5%" label="客户满意度" />
            <Stat value="24/7" label="技术支持" />
          </div>
        </div>
        <div className="login-visual" aria-hidden="true">
          <div className="visual-card main-card">
            <div className="visual-top"><span /><span /><span /></div>
            <div className="visual-chart" />
            <div className="visual-list"><span /><span /><span /></div>
            <div className="visual-donut" />
          </div>
          <div className="visual-card mini-card">
            <div className="bar-set"><span /><span /><span /></div>
          </div>
          <div className="visual-chat"><MessageCircle size={28} /></div>
          <div className="visual-user"><UserRound size={26} /></div>
          <div className="visual-globe" />
        </div>
      </section>

      <form className="login-card" onSubmit={submit}>
        <h2>欢迎登录</h2>
        <p>MOTARRO+ 询盘管理系统</p>
        <label>
          用户名
          <span><UserRound size={20} /><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入用户名" /></span>
        </label>
        <label>
          密码
          <span><LockKeyhole size={20} /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="请输入密码" /><EyeOff size={20} /></span>
        </label>
        <label>
          验证码
          <div className="captcha-row">
            <span><input value={captcha} onChange={(event) => setCaptcha(event.target.value.toUpperCase())} placeholder="请输入验证码" autoComplete="off" /></span>
            <button className="captcha-image-button" type="button" onClick={refreshCaptcha} aria-label="刷新验证码">
              <img src={captchaSrc} alt="验证码" />
            </button>
            <button className="captcha-refresh" type="button" onClick={refreshCaptcha} aria-label="刷新验证码"><RefreshCw size={22} /></button>
          </div>
        </label>
        <div className="login-options">
          <div className="remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> 记住我</div>
          <button type="button">忘记密码?</button>
        </div>
        {error && <div className="login-error">{error}</div>}
        <button className="login-submit" disabled={loading}>{loading ? "登录中..." : "登录"}</button>
        <div className="login-divider"><span />或使用以下方式登录<span /></div>
        <div className="social-login">
          <SocialButton className="wechat" label="微信">微</SocialButton>
          <SocialButton className="alipay" label="支付宝">支</SocialButton>
          <SocialButton className="google" label="Google">G</SocialButton>
          <SocialButton className="x" label="X">X</SocialButton>
          <SocialButton className="whatsapp" label="WhatsApp">WA</SocialButton>
          <SocialButton className="facebook" label="Facebook"><Facebook size={22} /></SocialButton>
          <SocialButton className="instagram" label="Instagram"><Instagram size={22} /></SocialButton>
        </div>
        <div className="social-note"><BadgeCheck size={15} /> 第三方账号绑定入口已预留，后续接入 OAuth / OpenID Connect</div>
        <div className="register-line">还没有账号? <button type="button">立即注册</button></div>
      </form>

      <footer className="login-footer">© 2026 MOTARRO+ 询盘管理系统　版权所有</footer>
    </main>
  );
}

function Feature({ icon: Icon, color, title, text }: { icon: React.ElementType; color: string; title: string; text: string }) {
  return (
    <div className="login-feature">
      <div className={`feature-icon ${color}`}><Icon size={23} /></div>
      <div><strong>{title}</strong><span>{text}</span></div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="login-stat"><strong>{value}</strong><span>{label}</span></div>;
}

function SocialButton({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} aria-label={label} title={`${label} 登录暂未开通`}>
      {children}
    </button>
  );
}
