/**
 * Tiny dependency-free, localhost-first static server for PROTOCOL ZERO.
 * Prevents path traversal, serves only the authored film assets and modules.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=resolve(fileURLToPath(new URL('../',import.meta.url)));
const MIME={
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml',
  '.json':'application/json; charset=utf-8',
  '.webp':'image/webp','.avif':'image/avif'
};
const ALLOWED=[
  /^\/$/,
  /^\/index\.html$/,
  /^\/styles\.css$/,
  /^\/src\/[a-z0-9-]+\.mjs$/,
  /^\/assets\/brand\.svg$/,
  /^\/assets\/frames\/shot_\d\d\.svg$/
];
const headers={
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Resource-Policy':'same-origin'
};
export function createFilmServer(){
  return createServer(async(req,res)=>{
    const respond=(status,text)=>{
      res.writeHead(status,{...headers,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      res.end(text);
    };
    if(!['GET','HEAD'].includes(req.method)){respond(405,'Method not allowed');return}
    let path;
    try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}
    catch{respond(400,'Bad request');return}
    if(path.includes('\\') || path.includes('\0') || !ALLOWED.some(re=>re.test(path))){
      respond(404,'Not found');return;
    }
    if(path==='/')path='/index.html';
    const disk=resolve(ROOT,'.'+path);
    if(!disk.startsWith(ROOT+sep)){respond(404,'Not found');return}
    try{
      const meta=await stat(disk);
      if(!meta.isFile()||meta.size>1_800_000){respond(404,'Not found');return}
      const type=MIME[extname(disk)];
      if(!type){respond(404,'Not found');return}
      const body=req.method==='HEAD'?null:await readFile(disk);
      res.writeHead(200,{
        ...headers,'Content-Type':type,
        'Cache-Control':path.endsWith('.html')?'no-cache':'public, max-age=3600',
        'Content-Length':meta.size
      });
      res.end(body);
    }catch(error){
      if(error.code==='ENOENT'){respond(404,'Not found');return}
      respond(500,'Unable to read film resource');
    }
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||4173);
  const host=process.env.HOST||'127.0.0.1';
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('PORT must be a valid TCP port');
  const server=createFilmServer();
  server.listen(port,host,()=>{
    const addr=server.address();
    process.stdout.write('PROTOCOL ZERO ready: http://'+host+':'+addr.port+'/\n');
  });
  const shut=()=>server.close(()=>process.exit(0));
  process.on('SIGINT',shut);process.on('SIGTERM',shut);
}
