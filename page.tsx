"use client";
import { useEffect, useState } from "react";
import { sb, brl } from "@/lib/supabase";

type Gift = { id: string; guest_name: string; amount_cents: number; status: string; guest_claimed_paid: boolean; message: string | null; created_at: string; products: { name: string } | null };
type Prod = { id: string; name: string; description: string | null; price_cents: number; visible: boolean; image_url: string | null; category_id: number | null };

export default function Admin() {
  const [ok, setOk] = useState<boolean | null>(null); const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  const [gifts, setGifts] = useState<Gift[]>([]); const [prods, setProds] = useState<Prod[]>([]); const [ev, setEv] = useState<any>({});
  const [np, setNp] = useState({ name: "", price: "", category_id: "1", image_url: "" });

  const load = async () => {
    const g = await sb.from("gifts").select("*, products(name)").order("created_at", { ascending: false });
    if (g.error || !(await sb.auth.getSession()).data.session) return setOk(false);
    // Se o usuário logado não for admin, o RLS devolve lista vazia e não permite gravar.
    const chk = await sb.rpc("is_admin"); if (!chk.data) { setErr("Este usuário não é administrador."); return setOk(false); }
    setOk(true); setGifts(g.data as any);
    setProds(((await sb.from("products").select("*").order("created_at")).data as any) || []);
    setEv((await sb.from("event_settings").select("*").eq("id", 1).single()).data || {});
  };
  useEffect(() => { load(); }, []);

  async function login(e: React.FormEvent) { e.preventDefault(); setErr(""); const { error } = await sb.auth.signInWithPassword({ email, password: pw }); if (error) setErr("E-mail ou senha incorretos."); else load(); }
  const setStatus = async (id: string, status: string) => { await sb.from("gifts").update({ status, updated_at: new Date().toISOString() }).eq("id", id); load(); };
  const saveEv = async () => { const { error } = await sb.from("event_settings").update({ invite_text: ev.invite_text, event_date: ev.event_date, event_time: ev.event_time, address: ev.address, notes: ev.notes }).eq("id", 1); alert(error ? "Erro ao salvar" : "Salvo!"); };
  const setPrice = async (p: Prod, v: string) => { const c = Math.round(parseFloat(v.replace(",", ".")) * 100); if (c > 0) { await sb.from("products").update({ price_cents: c, updated_at: new Date().toISOString() }).eq("id", p.id); load(); } };
  const toggle = async (p: Prod) => { await sb.from("products").update({ visible: !p.visible }).eq("id", p.id); load(); };
  const del = async (p: Prod) => { if (confirm(`Excluir "${p.name}"?`)) { const { error } = await sb.from("products").delete().eq("id", p.id); if (error) alert("Não é possível excluir item com registros de presente. Oculte-o."); load(); } };
  const add = async () => { const c = Math.round(parseFloat(np.price.replace(",", ".")) * 100); if (!np.name || !(c > 0)) return alert("Informe nome e preço."); await sb.from("products").insert({ name: np.name, price_cents: c, category_id: +np.category_id, image_url: np.image_url || null }); setNp({ ...np, name: "", price: "", image_url: "" }); load(); };
  function csv() {
    const rows = [["Data", "Convidado", "Presente", "Valor", "Status", "Disse que pagou", "Mensagem"], ...gifts.map(g => [new Date(g.created_at).toLocaleString("pt-BR"), g.guest_name, g.products?.name || "", (g.amount_cents / 100).toFixed(2), g.status, g.guest_claimed_paid ? "sim" : "não", (g.message || "").replace(/\n/g, " ")])];
    const b = new Blob(["\ufeff" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "presentes.csv"; a.click();
  }

  if (ok === null) return <div className="wrap box">Carregando…</div>;
  if (!ok) return (<div className="wrap"><form className="box" onSubmit={login} style={{ maxWidth: 380, margin: "60px auto" }}><h2>Área da Carol 🔒</h2>
    <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} /><input type="password" placeholder="Senha" value={pw} onChange={e => setPw(e.target.value)} />
    {err && <p className="err">{err}</p>}<button className="btn" style={{ width: "100%" }}>Entrar</button></form></div>);

  const sum = (s: string) => gifts.filter(g => g.status === s).reduce((a, g) => a + g.amount_cents, 0);
  return (<div className="wrap"><h1>Painel</h1>
    <div className="box"><b>Confirmados:</b> {brl(sum("confirmed"))} · <b>Pendentes:</b> {brl(sum("pending"))} <button className="btn alt" onClick={csv}>Exportar CSV</button> <button className="btn alt" onClick={() => sb.auth.signOut().then(load)}>Sair</button></div>
    <div className="box" style={{ overflowX: "auto" }}><h2>Presentes</h2><table><thead><tr><th>Quando</th><th>Quem</th><th>Item</th><th>Valor</th><th>Status</th><th>Recado</th><th></th></tr></thead><tbody>
      {gifts.map(g => <tr key={g.id}><td>{new Date(g.created_at).toLocaleString("pt-BR")}</td><td>{g.guest_name}</td><td>{g.products?.name}</td><td>{brl(g.amount_cents)}</td>
        <td>{g.status}{g.status === "pending" && g.guest_claimed_paid ? " (diz que pagou)" : ""}</td><td>{g.message}</td>
        <td>{g.status === "pending" && <button className="tag" onClick={() => setStatus(g.id, "confirmed")}>Confirmar Pix</button>} {g.status !== "cancelled" && <button className="tag" onClick={() => confirm("Cancelar e liberar o item?") && setStatus(g.id, "cancelled")}>Cancelar</button>}</td></tr>)}</tbody></table></div>
    <div className="box"><h2>Convite do churrasco</h2>
      {(["invite_text", "event_date", "event_time", "address", "notes"] as const).map(k => k === "invite_text" || k === "notes"
        ? <textarea key={k} rows={3} placeholder={k === "invite_text" ? "Comunicado" : "Orientações"} value={ev[k] || ""} onChange={e => setEv({ ...ev, [k]: e.target.value })} />
        : <input key={k} placeholder={{ event_date: "Data", event_time: "Horário", address: "Endereço" }[k]} value={ev[k] || ""} onChange={e => setEv({ ...ev, [k]: e.target.value })} />)}
      <button className="btn" onClick={saveEv}>Salvar convite</button></div>
    <div className="box" style={{ overflowX: "auto" }}><h2>Produtos</h2>
      <div className="row"><input placeholder="Nome" value={np.name} onChange={e => setNp({ ...np, name: e.target.value })} /><input placeholder="Preço (ex 89,90)" value={np.price} onChange={e => setNp({ ...np, price: e.target.value })} /><input placeholder="URL da imagem (opcional)" value={np.image_url} onChange={e => setNp({ ...np, image_url: e.target.value })} /><input placeholder="ID categoria (1-12)" value={np.category_id} onChange={e => setNp({ ...np, category_id: e.target.value })} /><button className="btn" onClick={add}>Adicionar</button></div>
      <table><tbody>{prods.map(p => <tr key={p.id} style={{ opacity: p.visible ? 1 : .5 }}><td>{p.name}</td><td><input style={{ width: 90 }} defaultValue={(p.price_cents / 100).toFixed(2).replace(".", ",")} onBlur={e => setPrice(p, e.target.value)} /></td>
        <td><button className="tag" onClick={() => toggle(p)}>{p.visible ? "Ocultar" : "Mostrar"}</button> <button className="tag" onClick={() => del(p)}>Excluir</button></td></tr>)}</tbody></table></div>
  </div>);
}
