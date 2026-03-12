"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 40px",borderBottom:"1px solid var(--border)",background:"rgba(12,14,20,0.96)",backdropFilter:"blur(14px)",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,var(--gold),var(--gold-light))",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Playfair Display,serif",fontSize:16,fontWeight:700,color:"#0c0e14"}}>C</div>
        <span style={{fontFamily:"Playfair Display,serif",fontSize:18,color:"var(--text-primary)",letterSpacing:"0.02em"}}>CrestMind <span style={{color:"var(--gold)"}}>AI</span></span>
      </div>
      <div style={{display:"flex",gap:4}}>
        {[{href:"/upload",label:"??  Upload"},{href:"/query",label:"??  Query"}].map(({href,label})=>{
          const active=pathname===href;
          return <Link key={href} href={href} style={{padding:"8px 20px",borderRadius:7,fontSize:13,fontWeight:500,fontFamily:"DM Sans,sans-serif",textDecoration:"none",transition:"all 0.2s",background:active?"rgba(201,169,110,0.13)":"transparent",color:active?"var(--gold)":"var(--text-muted)"}}>{label}</Link>;
        })}
      </div>
      <div style={{fontSize:11,color:"var(--text-dim)",letterSpacing:"0.06em",textTransform:"uppercase"}}>Woodcrest Capital</div>
    </nav>
  );
}
