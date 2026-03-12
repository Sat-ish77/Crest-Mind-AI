"use client";
import { useState, useCallback, useRef } from "react";
import Navbar from "../components/Navbar";
import { uploadDocument } from "../services/api";
const ACCEPTED = ["pdf","xlsx","xls","jpg","jpeg","png","tiff"];
const MAX_SIZE = 50*1024*1024;
const getExt = (n:string) => n.split(".").pop()?.toLowerCase()??"";
const fmtSize = (b:number) => b<1024?`${b} B`:b<1048576?`${(b/1024).toFixed(1)} KB`:`${(b/1048576).toFixed(1)} MB`;
interface FE{id:string;name:string;size:number;ext:string;status:string;progress:number;errorMsg:string|null}
let seq=0;
export default function UploadPage() {
  const [files,setFiles]=useState<FE[]>([]);
  const [drag,setDrag]=useState(false);
  const ref=useRef<HTMLInputElement>(null);
  const process=useCallback((raw:FileList|null)=>{
    if(!raw)return;
    const inc:FE[]=Array.from(raw).map(f=>{
      const ext=getExt(f.name);
      return{id:`f${++seq}`,name:f.name,size:f.size,ext,status:!ACCEPTED.includes(ext)?"err-type":f.size>MAX_SIZE?"err-size":"uploading",progress:0,errorMsg:!ACCEPTED.includes(ext)?"Unsupported file type":f.size>MAX_SIZE?"Exceeds 50MB":null};
    });
    setFiles(p=>[...p,...inc]);
    inc.forEach(e=>{
      if(e.status!=="uploading")return;
      const f=Array.from(raw).find(x=>x.name===e.name&&x.size===e.size)!;
      uploadDocument(f,p=>setFiles(prev=>prev.map(x=>x.id===e.id?{...x,progress:p}:x)))
        .then(()=>setFiles(prev=>prev.map(x=>x.id===e.id?{...x,status:"done",progress:100}:x)))
        .catch(()=>setFiles(prev=>prev.map(x=>x.id===e.id?{...x,status:"err-upload",errorMsg:"Upload failed"}:x)));
    });
  },[]);
  const total=files.length,done=files.filter(f=>f.status==="done").length,uploading=files.filter(f=>f.status==="uploading").length,errors=files.filter(f=>f.status.startsWith("err")).length;
  return(
    <div><Navbar/>
    <main style={{maxWidth:860,margin:"0 auto",padding:"48px 24px"}}>
      <h1 style={{fontFamily:"Playfair Display,serif",fontSize:32,fontWeight:600,color:"var(--text-primary)",margin:"0 0 8px"}}>Document Upload</h1>
      <p style={{fontSize:14,color:"var(--text-muted)",marginBottom:36}}>Upload property documents</p>
      <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);process(e.dataTransfer.files)}} onClick={()=>ref.current?.click()} style={{border:`2px dashed ${drag?"var(--gold)":"var(--border)"}`,borderRadius:18,padding:"52px 32px",textAlign:"center",cursor:"pointer",background:drag?"rgba(201,169,110,0.05)":"var(--bg-surface)",transition:"all 0.25s"}}>
        <p style={{fontSize:16,fontWeight:500,color:drag?"var(--gold)":"var(--text-body)",marginBottom:6}}>{drag?"Drop files here":"Drag and drop files here"}</p>
        <p style={{fontSize:13,color:"var(--text-muted)",marginBottom:20}}>or click to browse</p>
        <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
          {["PDF","Excel","JPG","PNG"].map(t=><span key={t} style={{padding:"4px 12px",borderRadius:20,background:"rgba(255,255,255,0.06)",fontSize:11,color:"var(--text-muted)",border:"1px solid var(--border)"}}>{t}</span>)}
        </div>
        <p style={{fontSize:11,color:"var(--text-dim)",marginTop:16}}>Max 50 MB per file</p>
        <input ref={ref} type="file" multiple accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.tiff" style={{display:"none"}} onChange={e=>{process(e.target.files);e.target.value="";}}/>
      </div>
      {total>0&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"28px 0 14px",padding:"12px 20px",background:"var(--bg-surface)",borderRadius:10,border:"1px solid var(--border)"}}>
        <div style={{display:"flex",gap:24}}>
          {[{v:total,l:"Total",c:"var(--gold)"},{v:done,l:"Done",c:"var(--green)"},...(uploading>0?[{v:uploading,l:"Uploading",c:"var(--blue)"}]:[]),...(errors>0?[{v:errors,l:"Errors",c:"var(--red)"}]:[])].map(({v,l,c})=><div key={l} style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20,fontWeight:600,color:c}}>{v}</span><span style={{fontSize:12,color:"var(--text-muted)"}}>{l}</span></div>)}
        </div>
        <button onClick={()=>setFiles([])} style={{padding:"6px 14px",borderRadius:6,border:"1px solid var(--border)",background:"transparent",color:"var(--text-muted)",fontSize:12,cursor:"pointer"}}>Clear All</button>
      </div>}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {files.map(f=>{
          const isErr=f.status.startsWith("err"),isDone=f.status==="done",isUp=f.status==="uploading";
          const badges:Record<string,{label:string;bg:string;color:string}>={uploading:{label:`${f.progress}%`,bg:"rgba(147,197,253,0.12)",color:"var(--blue)"},done:{label:"Uploaded",bg:"rgba(110,231,183,0.12)",color:"var(--green)"},"err-upload":{label:"Failed",bg:"rgba(252,165,165,0.12)",color:"var(--red)"},"err-type":{label:"Invalid",bg:"rgba(252,165,165,0.12)",color:"var(--red)"},"err-size":{label:"Too large",bg:"rgba(252,165,165,0.12)",color:"var(--red)"}};
          const b=badges[f.status]??badges["err-upload"];
          return<div key={f.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:10,background:isErr?"rgba(252,165,165,0.04)":"var(--bg-surface)",border:`1px solid ${isErr?"rgba(252,165,165,0.18)":isDone?"rgba(110,231,183,0.12)":"var(--border)"}`}}>
            <span style={{fontSize:11,fontWeight:700,color:"var(--gold)",background:"rgba(201,169,110,0.12)",padding:"4px 8px",borderRadius:6,flexShrink:0}}>{f.ext.toUpperCase()}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <span style={{fontSize:13,fontWeight:500,color:isErr?"var(--red)":"var(--text-body)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"55%"}}>{f.name}</span>
                <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                  <span style={{fontSize:11,color:"var(--text-dim)"}}>{fmtSize(f.size)}</span>
                  <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,background:b.bg,color:b.color}}>{b.label}</span>
                </div>
              </div>
              {isUp&&<div style={{height:3,background:"rgba(255,255,255,0.08)",borderRadius:2,marginTop:7,overflow:"hidden"}}><div style={{height:"100%",width:`${f.progress}%`,background:"linear-gradient(90deg,var(--gold),var(--gold-light))",borderRadius:2,transition:"width 0.2s"}}/></div>}
              {isErr&&<p style={{fontSize:11,color:"var(--red)",margin:"4px 0 0"}}>{f.errorMsg}</p>}
            </div>
            <button onClick={()=>setFiles(p=>p.filter(x=>x.id!==f.id))} style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.22)",fontSize:16,padding:"2px 6px",borderRadius:4}}>X</button>
          </div>;
        })}
      </div>
      {total===0&&<p style={{textAlign:"center",marginTop:48,color:"var(--text-dim)",fontSize:13}}>No files uploaded yet.</p>}
    </main></div>
  );
}
