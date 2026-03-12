"use client";
import { useState, useRef, useEffect } from "react";
import Navbar from "../components/Navbar";
import { queryDocuments, QueryResult } from "../services/api";
const PROPERTIES=["All Properties","Pinecrest Plaza","Riverside Tower","Summit Office Park"];
const SUITES=["All Suites","Suite 101","Suite 202","Suite 305"];
const TENANTS=["All Tenants","Apex Corp","Blue Ridge LLC","Summit Holdings"];
export default function QueryPage() {
  const [question,setQuestion]=useState("");
  const [property,setProperty]=useState("All Properties");
  const [suite,setSuite]=useState("All Suites");
  const [tenant,setTenant]=useState("All Tenants");
  const [history,setHistory]=useState<string[]>([]);
  const [showHistory,setShowHistory]=useState(false);
  const [loading,setLoading]=useState(false);
  const [answer,setAnswer]=useState<QueryResult|null>(null);
  const [error,setError]=useState<string|null>(null);
  const histRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{try{setHistory(JSON.parse(localStorage.getItem("crestmind_history")||"[]"));}catch{}},[]);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(histRef.current&&!histRef.current.contains(e.target as Node))setShowHistory(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const submit=async()=>{
    const q=question.trim();if(!q||loading)return;
    setLoading(true);setAnswer(null);setError(null);setShowHistory(false);
    const next=[q,...history.filter(h=>h!==q)].slice(0,8);
    setHistory(next);localStorage.setItem("crestmind_history",JSON.stringify(next));
    try{const r=await queryDocuments({question:q,property:property==="All Properties"?"all":property,suite:suite==="All Suites"?"all":suite,tenant:tenant==="All Tenants"?"all":tenant});setAnswer(r);}
    catch{setError("Something went wrong. Please try again.");}
    finally{setLoading(false);}
  };
  const filtered=history.filter(h=>!question||h.toLowerCase().includes(question.toLowerCase()));
  return(
    <div><Navbar/>
    <main style={{maxWidth:860,margin:"0 auto",padding:"48px 24px"}}>
      <h1 style={{fontFamily:"Playfair Display,serif",fontSize:32,fontWeight:600,color:"var(--text-primary)",margin:"0 0 8px"}}>Ask a Question</h1>
      <p style={{fontSize:14,color:"var(--text-muted)",marginBottom:36}}>Ask anything about your property documents in plain English</p>
      <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        {[{l:"Property",v:property,o:PROPERTIES,s:setProperty},{l:"Suite",v:suite,o:SUITES,s:setSuite},{l:"Tenant",v:tenant,o:TENANTS,s:setTenant}].map(({l,v,o,s})=>(
          <div key={l} style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:10,color:"var(--text-muted)",letterSpacing:"0.07em",textTransform:"uppercase"}}>{l}</label>
            <select value={v} onChange={e=>s(e.target.value)} style={{padding:"8px 32px 8px 14px",borderRadius:8,outline:"none",background:"rgba(255,255,255,0.05)",border:`1px solid ${v!==o[0]?"rgba(201,169,110,0.4)":"var(--border)"}`,color:v!==o[0]?"var(--gold)":"var(--text-muted)",fontSize:13,cursor:"pointer",fontFamily:"DM Sans,sans-serif",minWidth:155}}>
              {o.map(x=><option key={x} value={x} style={{background:"#14161f"}}>{x}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div ref={histRef} style={{position:"relative"}}>
        <div style={{display:"flex",gap:10,alignItems:"flex-end",background:"rgba(255,255,255,0.04)",border:`1px solid ${question?"rgba(201,169,110,0.35)":"var(--border)"}`,borderRadius:14,padding:"14px 14px 14px 18px"}}>
          <textarea rows={2} value={question} placeholder="e.g. When does the lease for Suite 101 expire?" onChange={e=>setQuestion(e.target.value)} onFocus={()=>setShowHistory(true)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit();}}} style={{flex:1,background:"transparent",border:"none",outline:"none",color:"var(--text-body)",fontSize:14,resize:"none",fontFamily:"DM Sans,sans-serif",lineHeight:1.65}}/>
          <button onClick={submit} disabled={!question.trim()||loading} style={{padding:"10px 26px",borderRadius:8,border:"none",background:question.trim()&&!loading?"linear-gradient(135deg,var(--gold),var(--gold-light))":"rgba(255,255,255,0.07)",color:question.trim()&&!loading?"#0c0e14":"rgba(255,255,255,0.25)",fontSize:13,fontWeight:600,cursor:question.trim()?"pointer":"default",whiteSpace:"nowrap",flexShrink:0,fontFamily:"DM Sans,sans-serif"}}>{loading?"Thinking...":"Ask ->"}</button>
        </div>
        {showHistory&&filtered.length>0&&(
          <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:60,background:"#14161f",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.55)"}}>
            <div style={{padding:"8px 18px",borderBottom:"1px solid rgba(255,255,255,0.05)",fontSize:10,color:"var(--text-dim)",letterSpacing:"0.08em",textTransform:"uppercase"}}>Recent Queries</div>
            {filtered.map((h,i)=><button key={i} onMouseDown={()=>{setQuestion(h);setShowHistory(false);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 18px",background:"transparent",border:"none",borderBottom:i<filtered.length-1?"1px solid rgba(255,255,255,0.04)":"none",color:"var(--text-muted)",fontSize:13,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}}>Recent: {h}</button>)}
          </div>
        )}
      </div>
      <p style={{fontSize:11,color:"var(--text-dim)",marginTop:8}}>Press Enter to submit</p>
      {loading&&<div style={{textAlign:"center",marginTop:48}}><div style={{display:"inline-flex",gap:7}}>{[0,1,2].map(i=><div key={i} style={{width:9,height:9,borderRadius:"50%",background:"var(--gold)",animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div><p style={{fontSize:13,color:"var(--text-muted)",marginTop:14}}>Searching documents...</p></div>}
      {error&&!loading&&<div style={{marginTop:32,padding:"16px 20px",borderRadius:10,background:"rgba(252,165,165,0.06)",border:"1px solid rgba(252,165,165,0.2)"}}><p style={{fontSize:13,color:"var(--red)"}}>Error: {error}</p></div>}
      {answer&&!loading&&(()=>{
        const pct=Math.round(answer.confidence*100),color=pct>=80?"var(--green)":pct>=60?"var(--yellow)":"var(--red)",label=pct>=80?"High Confidence":pct>=60?"Medium Confidence":"Low Confidence";
        return<div className="fade-in" style={{marginTop:36}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <span style={{fontSize:11,color:"var(--text-dim)",letterSpacing:"0.06em",textTransform:"uppercase"}}>AI Answer</span>
            <span style={{fontSize:12,fontWeight:500,color,padding:"3px 10px",borderRadius:20,background:`${color}1a`}}>{pct}% - {label}</span>
          </div>
          <div style={{background:"var(--bg-surface)",border:"1px solid rgba(201,169,110,0.22)",borderRadius:14,padding:"24px 28px",marginBottom:20}}>
            <p style={{fontSize:15,color:"var(--text-body)",lineHeight:1.8,margin:0}}>{answer.answer}</p>
          </div>
          {answer.citations.length>0&&<><p style={{fontSize:10,color:"var(--text-dim)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:10}}>Source Citations</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {answer.citations.map((c,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:10,background:"var(--bg-surface)",border:"1px solid var(--border)",cursor:"pointer"}}>
              <span style={{fontSize:20}}>{c.type==="pdf"?"??":"??"}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:"0 0 3px",fontSize:13,fontWeight:500,color:"var(--gold)"}}>{c.document_name}</p>
                <p style={{margin:0,fontSize:12,color:"var(--text-muted)"}}>Page {c.page} - {c.snippet}</p>
              </div>
              <span style={{fontSize:11,color:"var(--text-dim)"}}>View</span>
            </div>)}
          </div></>}
          <p style={{fontSize:11,color:"var(--text-dim)",marginTop:20}}>Always verify figures against source documents.</p>
        </div>;
      })()}
    </main></div>
  );
}
