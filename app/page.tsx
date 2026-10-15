"use client";
import { useEffect, useMemo, useState } from "react";
import { sb, PIX_KEY, brl, fmtPhone } from "@/lib/supabase";

type P = { id: string; category: string; name: string; description: string; price_cents: number; image_url: string | null; available: boolean };
type Ev = { invite_text: string; event_date: string; event_time: string; address: string; notes: string };
type G = { gift_id: string; token: string; amount_cents: number; product_name: string };
const EMOJI: Record<string, string> = { "Cozinha e utensílios": "🍴", "Panelas e acessórios": "🍳", "Pratos, copos e talheres": "🍽️", "Eletroportáteis": "☕", "Organização da casa": "🧺", "Limpeza e lavanderia": "🧼", "Quarto e roupa de cama": "🛏️", "Banheiro": "🛁", "Sala e decoração": "🪴", "Móveis e itens maiores": "🛋️", "Área gourmet e churrasco": "🔥", "Pequenos detalhes": "💛" };

export default function Home() {
  const [prods, setProds] = useState<P[]>([]); const [ev, setEv] = useState<Ev | null>(null);
  const [cat, setCat] = useState("Todos"); const [q, setQ] = useState(""); const [sort, setSort] = useState("asc");
  const [sel, setSel] = useState<P | null>(null); const [step, setStep] = useState(0);
  const [name, setName] = useState(""); const [gift, setGift] = useState<G | null>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  const [loadErr, setLoadErr] = useState(false);

  const load = async () => {
    const [a, b] = await Promise.all([sb.rpc("list_products"), sb.from("event_settings").select("*").eq("id", 1).single()]);
    if (a.error) setLoadErr(true); else { setProds(a.data as P[]); setLoadErr(false); }
    if (b.data) setEv(b.data as Ev);
  };
  useEffect(() => { load(); }, []);

  const cats = useMemo(() => ["Todos", ...Array.from(new Set(prods.map(p => p.category)))], [prods]);
  const list = useMemo(() => prods
    .filter(p => (cat === "Todos" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "asc" ? a.price_cents - b.price_cents : b.price_cents - a.price_cents), [prods, cat, q, sort]);

  const close = () => { setSel(null); setStep(0); setGift(null); setName(""); setMsg(""); setErr(""); load(); };
  const open = (p: P) => { setSel(p); setStep(1); setErr(""); };

  async function reserve() {
    if (busy) return; if (name.trim().length < 2) return setErr("Digite seu nome (mínimo 2 letras).");
    setBusy(true); setErr("");
    const { data, error } = await sb.rpc("reserve_gift", { p_product: sel!.id, p_name: name });
    setBusy(false);
    if (error) return setErr(error.message.includes("indisponivel") ? "Ops! Alguém acabou de escolher este item. Escolha outro, por favor 💛" : "Erro de conexão. Tente novamente.");
    setGift((data as G[])[0]); setStep(2);
  }
  async function copy() { try { await navigator.clipboard.writeText(PIX_KEY); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setErr("Não foi possível copiar. Digite a chave manualmente."); } }
  async function paid() {
    if (busy) return; setBusy(true);
    const { error } = await sb.rpc("claim_paid", { p_gift: gift!.gift_id, p_token: gift!.token });
    setBusy(false); if (error) return setErr("Erro de conexão. Tente novamente."); setStep(3);
  }
  async function send() {
    if (busy) return; setBusy(true);
    if (msg.trim()) { const { error } = await sb.rpc("leave_message", { p_gift: gift!.gift_id, p_token: gift!.token, p_msg: msg }); if (error) { setBusy(false); return setErr("Não conseguimos salvar a mensagem. Tente novamente."); } }
    setBusy(false); setStep(4);
  }
  async function giveUp() { if (gift) await sb.rpc("release_gift", { p_gift: gift.gift_id, p_token: gift.token }); close(); }

  return (<>
    <header className="hero"><div className="wrap">
      <div className="deco">🏡 🌿 ♡</div><p className="muted">Chá de Casa Nova</p><h1>Carol &amp; Ray</h1>
      <p style={{ maxWidth: 560, margin: "12px auto 22px" }}>Um novo lar, uma nova história e muitos sonhos para compartilhar. Estamos preparando nosso cantinho e ficaremos muito felizes em ter você fazendo parte desse momento!</p>
      <a href="#presentes"><button className="btn">Escolher meu presente</button></a>
    </div></header>
    <main className="wrap">
      <section className="box"><h2>Convite &amp; informações</h2>
        {ev && (ev.invite_text || ev.event_date || ev.event_time || ev.address || ev.notes) ? (<>
          {ev.invite_text && <p style={{ whiteSpace: "pre-line" }}>{ev.invite_text}</p>}
          {ev.event_date && <p>📅 {ev.event_date}</p>}{ev.event_time && <p>🕒 {ev.event_time}</p>}
          {ev.address && <p>📍 {ev.address}</p>}{ev.notes && <p className="muted" style={{ whiteSpace: "pre-line" }}>{ev.notes}</p>}
        </>) : <p className="muted">Em breve divulgaremos aqui os detalhes do nosso churrasco. 🔥</p>}
      </section>
      <section className="box"><h2>Como funciona</h2>
        <p>Os itens abaixo são <b>sugestões</b>. Você escolhe um, contribui com o valor estimado por <b>Pix</b> e nós compramos o presente depois. Nada é entregue em casa — o carinho é o que importa. 💛</p></section>

      <section id="presentes"><h2>Lista de presentes</h2>
        <div className="row"><input placeholder="Buscar presente…" value={q} onChange={e => setQ(e.target.value)} />
          <select value={sort} onChange={e => setSort(e.target.value)}><option value="asc">Menor preço</option><option value="desc">Maior preço</option></select></div>
        <div className="tags">{cats.map(c => <button key={c} className={"tag" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}</div>
        {loadErr && <p className="err">Não foi possível carregar a lista. <button className="tag" onClick={load}>Tentar de novo</button></p>}
        <div className="grid">{list.map(p => (
          <article key={p.id} className={"card" + (p.available ? "" : " off")}>
            <div className="thumb">{p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : EMOJI[p.category] || "🎁"}</div>
            <h3 style={{ fontSize: "1.25rem" }}>{p.name}</h3><p className="muted">{p.description}</p>
            <p><span className="badge">{p.category}</span></p><p className="price">{brl(p.price_cents)} <span className="muted">(estimado)</span></p>
            {p.available ? <button className="btn" style={{ width: "100%" }} onClick={() => open(p)}>Presentear</button> : <span className="badge">Já escolhido</span>}
          </article>))}</div>
        {!list.length && !loadErr && <p className="muted">Nenhum item encontrado.</p>}
      </section>
      <footer className="muted" style={{ textAlign: "center", padding: 40 }}>Feito com carinho 🌿 Carol &amp; Ray</footer>
    </main>

    {sel && <div className="modal" onClick={e => e.target === e.currentTarget && step === 1 && close()}><div className="sheet">
      {step === 1 && <><h2>Presentear</h2><p><b>{sel.name}</b><br /><span className="price">{brl(sel.price_cents)}</span> <span className="muted">valor estimado</span></p>
        <p className="muted">Você contribui por Pix com esse valor e a Carol e o Ray compram o item depois.</p>
        <input placeholder="Seu nome" value={name} maxLength={80} onChange={e => setName(e.target.value)} />
        {err && <p className="err">{err}</p>}
        <div className="row"><button className="btn alt" onClick={close}>Voltar</button><button className="btn" disabled={busy} onClick={reserve}>{busy ? "Reservando…" : "Confirmar escolha"}</button></div></>}
      {step === 2 && gift && <><h2>Pagamento via Pix</h2>
        <p>Valor exato: <span className="price" style={{ fontSize: "1.4rem" }}>{brl(gift.amount_cents)}</span></p>
        <p>Chave Pix (telefone):<br /><b style={{ fontSize: "1.3rem" }}>{fmtPhone(PIX_KEY)}</b></p>
        <button className="btn alt" style={{ width: "100%" }} onClick={copy}>{copied ? "Chave copiada ✓" : "Copiar chave Pix"}</button>
        <ol className="muted"><li>Copie a chave.</li><li>Abra o app do seu banco e escolha Pix → Chave → Telefone.</li><li>Cole a chave e digite o valor exato.</li><li>Volte aqui e toque em “Já fiz o Pix”.</li></ol>
        <p className="muted">O site não confirma o pagamento sozinho: Carol e Ray conferem o recebimento. Sua reserva fica guardada por 30 minutos até você tocar em “Já fiz o Pix”.</p>
        {err && <p className="err">{err}</p>}
        <div className="row"><button className="btn alt" onClick={giveUp}>Desistir</button><button className="btn" disabled={busy} onClick={paid}>Já fiz o Pix</button></div></>}
      {step === 3 && <><h2>Deixe um recado 💌</h2><p className="muted">Presente: {gift?.product_name} · de {name}. Só a Carol e o Ray vão ler.</p>
        <textarea rows={5} maxLength={1000} placeholder="Escreva uma mensagem carinhosa…" value={msg} onChange={e => setMsg(e.target.value)} />
        {err && <p className="err">{err}</p>}<button className="btn" style={{ width: "100%" }} disabled={busy} onClick={send}>Enviar</button></>}
      {step === 4 && <><h2>Muito obrigado! ❤️</h2><p>Obrigado por fazer parte desse novo capítulo da nossa história! Seu carinho significa muito para nós.</p>
        <p className="muted">Assim que confirmarmos o recebimento do Pix, o presente fica registrado como seu.</p><button className="btn" style={{ width: "100%" }} onClick={close}>Fechar</button></>}
    </div></div>}
  </>);
}
