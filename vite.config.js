import {defineConfig} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
const root=import.meta.dirname;
// Optional, ignored, server-only authorization for testing the owner-private API.
// Never use a VITE_ variable or pass these values to the browser.
function apiPreview(){return {name:'brickwild-private-api-preview',configureServer(server){
 server.middlewares.use(async(req,res,next)=>{
  // Isolated development-only HUD validation, including when WebGL is unavailable.
  if(req.url==='/__controls'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(root,'validation/ui-harness.html')));return;}
  if(!req.url?.startsWith('/api/'))return next();
  if(!['/api/generate','/api/generation-status'].includes(req.url)){res.writeHead(404);res.end();return;}
  let config;try{config=JSON.parse(fs.readFileSync(path.join(root,'.sites-runtime/api-preview.json'),'utf8'));}catch{}
  if(!config?.origin||!config?.token){res.setHeader('Content-Type','application/json');res.statusCode=req.url.endsWith('generation-status')?200:503;res.end(JSON.stringify(req.url.endsWith('generation-status')?{configured:false}:{error:'The development preview has no private API connection. Use the published game for live designs.'}));return;}
  const controller=new AbortController();res.on('close',()=>controller.abort());
  try{
   let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>2048){res.writeHead(413);res.end('Description too long');return;}chunks.push(chunk);}
   const upstream=await fetch(new URL(req.url,config.origin),{method:req.method,headers:{'Content-Type':'application/json','Origin':config.origin,'OAI-Sites-Authorization':`Bearer ${config.token}`},body:req.method==='POST'?Buffer.concat(chunks):undefined,signal:controller.signal});
   res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('Content-Type')||'application/json','Cache-Control':'no-store'});res.end(Buffer.from(await upstream.arrayBuffer()));
  }catch{if(!res.destroyed){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'The preview could not reach the private game API. Try again.'}));}}
 });
}};}
export default defineConfig({root:path.join(root,'public'),publicDir:false,server:{host:'0.0.0.0',allowedHosts:['terminal.local']},plugins:[apiPreview()]});
