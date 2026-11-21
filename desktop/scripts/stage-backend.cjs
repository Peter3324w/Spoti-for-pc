const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
// Windows Java starts very slowly when it reads jars directly across the WSL share.
// Cache immutable copies by content, keeping development launches on local storage.
async function stageBackend(source,cache) {
  const names=(await fs.readdir(source)).filter(name=>name.endsWith('.jar')).sort();
  if (!names.length) throw new Error('Playback backend is missing. Run npm run backend:build first.');
  const files=await Promise.all(names.map(async name=>({name,bytes:await fs.readFile(path.join(source,name))})));
  const hash=createHash('sha256');
  for (const file of files) hash.update(file.name).update('\0').update(file.bytes);
  const target=path.join(cache,hash.digest('hex'));
  const ready=path.join(target,'.ready');
  if (await fs.access(ready).then(()=>true,()=>false)) return target;
  await fs.mkdir(cache,{recursive:true});
  const staging=await fs.mkdtemp(path.join(cache,'.stage-'));
  try {
    await Promise.all(files.map(file=>fs.writeFile(path.join(staging,file.name),file.bytes)));
    await fs.writeFile(path.join(staging,'.ready'),'ready');
    try {await fs.rename(staging,target);} catch(error) {
      if (!await fs.access(ready).then(()=>true,()=>false)) throw error;
    }
    return target;
  } finally {await fs.rm(staging,{recursive:true,force:true});}
}
module.exports={stageBackend};
