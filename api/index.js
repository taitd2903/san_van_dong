import app from "../server/index.js";

export default function handler(req,res){
  const path=Array.isArray(req.query.__path)?req.query.__path.join("/"):req.query.__path||"";
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(req.query)){
    if(key==="__path")continue;
    for(const item of Array.isArray(value)?value:[value])if(item!==undefined)query.append(key,String(item));
  }
  req.url=`/api/${path}${query.size?`?${query}`:""}`;
  return app(req,res);
}
