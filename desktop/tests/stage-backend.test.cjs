const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {stageBackend}=require('../scripts/stage-backend.cjs');
test('Windows development stages jars locally and never reuses stale backend contents',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'spoti-stage-'));
  try {
    const source=path.join(root,'source'),cache=path.join(root,'cache');
    await fs.mkdir(source);
    await fs.writeFile(path.join(source,'backend.jar'),'first');
    const first=await stageBackend(source,cache);
    assert.equal(await fs.readFile(path.join(first,'backend.jar'),'utf8'),'first');
    assert.equal(await stageBackend(source,cache),first);
    await fs.writeFile(path.join(source,'backend.jar'),'second revision');
    const second=await stageBackend(source,cache);
    assert.notEqual(second,first);
    assert.equal(await fs.readFile(path.join(second,'backend.jar'),'utf8'),'second revision');
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
