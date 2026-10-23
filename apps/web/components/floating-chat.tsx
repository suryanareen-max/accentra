"use client";
import { useEffect, useRef, useState } from "react";
import { ChatWorkspace } from "./chat-workspace";
export function FloatingChat() {
  const [open,setOpen]=useState(false); const [started,setStarted]=useState(false); const launcher=useRef<HTMLButtonElement>(null);
  function close(){setOpen(false);launcher.current?.focus();}
  useEffect(()=>{if(!open)return;const handle=(event:KeyboardEvent)=>{if(event.key==="Escape")close();};window.addEventListener("keydown",handle);return()=>window.removeEventListener("keydown",handle);},[open]);
  return <><button ref={launcher} className="floating-chat-launcher" aria-label={open?"Close Ask Accentra":"Open Ask Accentra"} aria-expanded={open} aria-controls="accentra-chat-popup" onClick={()=>{setStarted(true);setOpen(!open);}}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z"/><path d="M7 11h10M7 15h6"/></svg><span>Ask Accentra</span></button>{started&&<section hidden={!open} id="accentra-chat-popup" className="floating-chat-panel" role="dialog" aria-label="Ask Accentra chat"><header><strong>Ask Accentra</strong><div><a href="/chat">Open full chat ↗</a><button aria-label="Close chat popup" onClick={close}>×</button></div></header><ChatWorkspace compact/></section>}</>;
}
