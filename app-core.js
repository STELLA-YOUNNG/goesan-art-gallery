const SUPABASE_URL='https://mmcmukiygjosimutmrup.supabase.co';
const SUPABASE_KEY='sb_publishable_cZb72z-nQsxIi5OL0N-zfA_z-qP2ngy';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const DB_NAME='goesan_myeongdeok_gallery_v2';
const DB_VERSION=1;
let db;
let editingId=null;
let sourceImg=null;
let cropState={x:0,y:0,w:1,h:1};
let activeGrade='all';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const openModal=id=>$('#'+id).classList.add('show');
const closeModal=id=>$('#'+id).classList.remove('show');

function reqP(req){return Promise.resolve(req)}

function mapWork(r){
  return {
    id:r.id,
    student:r.student,
    grade:String(r.grade),
    title:r.title,
    desc:r.description||'',
    exhibitionId:Number(r.exhibition_id),
    imageUrl:r.image_url,
    imagePath:r.image_path,
    createdAt:Number(r.created_at)||0,
    updatedAt:Number(r.updated_at)||0
  };
}
function mapEx(r){
  return {id:r.id,title:r.title,desc:r.description||'',createdAt:Number(r.created_at)||0};
}
function workImageUrl(w){ return w.imageUrl || ''; }

async function initDB(){
  const {data:{session}}=await sb.auth.getSession();
  setAdminUI(!!session);
  let ex=await getAll('exhibitions');
  if(!ex.length && session){
    await add('exhibitions',{title:'2026 괴산 우리고장 알리기 그림 그리기 대회',desc:'괴산명덕초등학교 학생들의 우리 고장 이야기',createdAt:Date.now()});
  }
  await refreshAll();
}

async function add(store,val){
  if(store==='exhibitions'){
    const payload={title:val.title,description:val.desc||'',created_at:val.createdAt||Date.now()};
    const {data,error}=await sb.from('exhibitions').insert(payload).select().single();
    if(error) throw error;
    return data.id;
  }
  if(store==='works'){
    const payload={student:val.student,grade:Number(val.grade),title:val.title,description:val.desc||'',exhibition_id:Number(val.exhibitionId),image_url:val.imageUrl||'',image_path:val.imagePath||'',created_at:val.createdAt||Date.now(),updated_at:val.updatedAt||Date.now()};
    const {data,error}=await sb.from('artworks').insert(payload).select().single();
    if(error) throw error;
    return data.id;
  }
}
async function put(store,val){
  if(store==='exhibitions'){
    const payload={title:val.title,description:val.desc||'',created_at:val.createdAt||Date.now()};
    const {error}=await sb.from('exhibitions').update(payload).eq('id',val.id);
    if(error) throw error;
    return val.id;
  }
  if(store==='works'){
    const payload={student:val.student,grade:Number(val.grade),title:val.title,description:val.desc||'',exhibition_id:Number(val.exhibitionId),image_url:val.imageUrl||'',image_path:val.imagePath||'',created_at:val.createdAt||Date.now(),updated_at:val.updatedAt||Date.now()};
    const {error}=await sb.from('artworks').update(payload).eq('id',val.id);
    if(error) throw error;
    return val.id;
  }
}
async function del(store,key){
  if(store==='works'){
    const old=await get('works',key);
    if(old?.imagePath) await sb.storage.from('artworks').remove([old.imagePath]);
    const {error}=await sb.from('artworks').delete().eq('id',key);
    if(error) throw error;
    return;
  }
  if(store==='exhibitions'){
    const {error}=await sb.from('exhibitions').delete().eq('id',key);
    if(error) throw error;
  }
}
async function get(store,key){
  if(store==='works'){
    const {data,error}=await sb.from('artworks').select('*').eq('id',key).single();
    if(error) return null;
    return mapWork(data);
  }
  if(store==='exhibitions'){
    const {data,error}=await sb.from('exhibitions').select('*').eq('id',key).single();
    if(error) return null;
    return mapEx(data);
  }
  return null;
}
async function getAll(store){
  if(store==='works'){
    const {data,error}=await sb.from('artworks').select('*').order('created_at',{ascending:false});
    if(error){console.error(error);return []}
    return (data||[]).map(mapWork);
  }
  if(store==='exhibitions'){
    const {data,error}=await sb.from('exhibitions').select('*').order('created_at',{ascending:true});
    if(error){console.error(error);return []}
    return (data||[]).map(mapEx);
  }
  return [];
}
async function getSetting(key){return localStorage.getItem('gallery_'+key)}
async function setSetting(key,value){localStorage.setItem('gallery_'+key,value)}

function setAdminUI(isAdmin){
  document.body.classList.toggle('admin',isAdmin);
  const b=$('#adminBtn');
  if(b) b.textContent=isAdmin?'관리자 로그아웃':'관리자 로그인';
}

async function uploadArtworkImage(blob,oldPath=''){
  const name=`${Date.now()}-${Math.random().toString(36).slice(2,9)}.jpg`;
  const path=`uploads/${name}`;
  const {error}=await sb.storage.from('artworks').upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});
  if(error) throw error;
  const {data}=sb.storage.from('artworks').getPublicUrl(path);
  if(oldPath) await sb.storage.from('artworks').remove([oldPath]);
  return {imagePath:path,imageUrl:data.publicUrl};
}

function getFavs(){try{return JSON.parse(localStorage.getItem('goesanGalleryFavs')||'[]')}catch(e){return []}}
function toggleFav(id){let a=getFavs();a=a.includes(id)?a.filter(x=>x!==id):[...a,id];localStorage.setItem('goesanGalleryFavs',JSON.stringify(a))}
function updateFavCount(){const el=$('#favCount');if(el) el.textContent=`마음에 담은 작품 ${getFavs().length}`}

async function refreshAll(){
  const exhibitions=await getAll('exhibitions');
  const sel=$('#exhibitionSelect'),wsel=$('#workExhibition');
  const current=Number(sel.value)||exhibitions[0]?.id;
  sel.innerHTML='';wsel.innerHTML='';
  exhibitions.sort((a,b)=>a.createdAt-b.createdAt).forEach(ex=>{
    const o=document.createElement('option');o.value=ex.id;o.textContent=ex.title;sel.appendChild(o);
    wsel.appendChild(o.cloneNode(true));
  });
  if(exhibitions.some(e=>e.id===current)) sel.value=current;
  buildGradeTabs();
  await renderGallery();
  await updateHeroRecentWorks();
}

function buildGradeTabs(){
  const labels=[['all','전체'],['1','1학년'],['2','2학년'],['3','3학년'],['4','4학년'],['5','5학년'],['6','6학년']];
  $('#gradeTabs').innerHTML='';
  labels.forEach(([v,t])=>{
    const b=document.createElement('button');b.textContent=t;b.className=(activeGrade===v?'active':'');
    b.onclick=()=>{activeGrade=v;buildGradeTabs();renderGallery()};$('#gradeTabs').appendChild(b);
  });
}

async function updateHeroRecentWorks(){
  const works=await getAll('works');
  const sorted=[...works].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const main=sorted[0],small=sorted[1]||sorted[0];
  const mainImg=$('#heroMainImage'),smallImg=$('#heroSmallImage');
  if(main&&mainImg){mainImg.src=workImageUrl(main);if($('#heroMainCaption')) $('#heroMainCaption').textContent=main.title||'최근 업로드 작품'}
  if(small&&smallImg){smallImg.src=workImageUrl(small);if($('#heroSmallCaption')) $('#heroSmallCaption').textContent=small.title||'최근 작품'}
}

async function renderGallery(){
  const works=await getAll('works');
  const exhibitions=await getAll('exhibitions');
  const exId=Number($('#exhibitionSelect').value)||exhibitions[0]?.id;
  const ex=exhibitions.find(e=>e.id===exId);
  $('#currentExTitle').textContent=ex?.title||'전시';
  if($('#overviewExTitle')) $('#overviewExTitle').textContent=ex?.title||'전시';
  $('#currentExDesc').textContent=ex?.desc||'';
  const q=$('#searchInput').value.trim().toLowerCase();
  let filtered=works.filter(w=>w.exhibitionId===exId);
  if(activeGrade!=='all') filtered=filtered.filter(w=>String(w.grade)===activeGrade);
  if(q) filtered=filtered.filter(w=>(w.student+' '+w.title+' '+(w.desc||'')).toLowerCase().includes(q));
  const sort=$('#sortSelect').value;
  filtered.sort((a,b)=>sort==='name'?a.student.localeCompare(b.student,'ko'):sort==='grade'?Number(a.grade)-Number(b.grade):b.createdAt-a.createdAt);
  $('#countInfo').textContent=`전체 ${filtered.length}점`;updateFavCount();
  if($('#overviewExCount')) $('#overviewExCount').textContent=`${filtered.length}점`;
  const g=$('#gallery');g.innerHTML='';
  $('#emptyState').style.display=filtered.length?'none':'block';
  for(const w of filtered){
    const c=document.createElement('article');c.className='art-card';
    const imgUrl=workImageUrl(w),isFav=getFavs().includes(w.id);
    c.innerHTML=`<div class="frame"><div class="thumb"><img src="${imgUrl}" alt="${esc(w.title)}"></div><div class="zoom-label">작품 보기</div></div><div class="card-body"><div class="card-topline">${w.grade}학년 · MYEONGDEOK</div><h3 class="card-title">${esc(w.title)}</h3><div class="card-sub">${esc(w.student)} · 작가</div><div class="card-desc">${esc(w.desc||'')}</div><div class="card-actions"><button class="favBtn ${isFav?'on':''}">${isFav?'♥ 마음에 담음':'♡ 마음에 담기'}</button><button class="btn ghost viewBtn">크게 보기</button><button class="btn ghost admin-only editBtn">수정</button><button class="btn danger admin-only delBtn">삭제</button></div></div>`;
    c.querySelector('.viewBtn').onclick=()=>viewWork(w);
    c.querySelector('.frame').onclick=()=>viewWork(w);
    c.querySelector('.favBtn').onclick=e=>{e.stopPropagation();toggleFav(w.id);renderGallery()};
    c.querySelector('.editBtn').onclick=()=>editWork(w);
    c.querySelector('.delBtn').onclick=()=>deleteWork(w);
    g.appendChild(c);
  }
}

function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
let viewerWorks=[];let viewerIndex=-1;

async function getVisibleWorksForViewer(){
  const works=await getAll('works');
  const exhibitions=await getAll('exhibitions');
  const exId=Number($('#exhibitionSelect').value)||exhibitions[0]?.id;
  const q=$('#searchInput').value.trim().toLowerCase();
  let filtered=works.filter(w=>w.exhibitionId===exId);
  if(activeGrade!=='all') filtered=filtered.filter(w=>String(w.grade)===activeGrade);
  if(q) filtered=filtered.filter(w=>(w.student+' '+w.title+' '+(w.desc||'')).toLowerCase().includes(q));
  const sort=$('#sortSelect').value;
  filtered.sort((a,b)=>sort==='name'?a.student.localeCompare(b.student,'ko'):sort==='grade'?Number(a.grade)-Number(b.grade):b.createdAt-a.createdAt);
  return filtered;
}
function renderViewerWork(){
  const w=viewerWorks[viewerIndex];if(!w)return;
  $('#viewImage').src=workImageUrl(w);$('#viewTitle').textContent=w.title;$('#viewMeta').textContent=`${w.student} · ${w.grade}학년 · ${viewerIndex+1}/${viewerWorks.length}`;$('#viewDesc').textContent=w.desc||'';
  const atStart=viewerIndex<=0,atEnd=viewerIndex>=viewerWorks.length-1;
  $('#prevWorkBtn').disabled=atStart;$('#prevWorkTextBtn').disabled=atStart;$('#nextWorkBtn').disabled=atEnd;$('#nextWorkTextBtn').disabled=atEnd;
}
function showPreviousWork(){if(viewerIndex>0){viewerIndex--;renderViewerWork()}}
function showNextWork(){if(viewerIndex<viewerWorks.length-1){viewerIndex++;renderViewerWork()}}
async function viewWork(w){viewerWorks=await getVisibleWorksForViewer();viewerIndex=viewerWorks.findIndex(x=>x.id===w.id);if(viewerIndex<0){viewerWorks=[w];viewerIndex=0}renderViewerWork();openModal('viewModal')}
async function deleteWork(w){if(confirm(`${w.student} 학생의 "${w.title}" 작품을 삭제할까요?`)){await del('works',w.id);await renderGallery();await updateHeroRecentWorks()}}

function resetWorkForm(){
  editingId=null;sourceImg=null;cropState={x:0,y:0,w:1,h:1};
  $('#workModalTitle').textContent='작품 업로드';$('#studentName').value='';$('#workTitle').value='';$('#workDesc').value='';$('#imageInput').value='';$('#cropWrap').style.display='none';
}
async function editWork(w){
  editingId=w.id;sourceImg=null;$('#workModalTitle').textContent='작품 수정';$('#studentName').value=w.student;$('#gradeInput').value=w.grade;$('#workTitle').value=w.title;$('#workDesc').value=w.desc||'';$('#workExhibition').value=w.exhibitionId;$('#imageInput').value='';$('#cropWrap').style.display='none';openModal('workModal');
}

$('#imageInput').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const img=new Image();img.onload=()=>{sourceImg=img;cropState={x:0,y:0,w:1,h:1};setupCrop();drawCropPreview()};img.src=URL.createObjectURL(f);
});

const cropResetBtn=$('#cropResetBtn');
if(cropResetBtn) cropResetBtn.onclick=()=>{if(!sourceImg)return;cropState={x:0,y:0,w:1,h:1};setupCrop();syncCropControls();drawCropPreview()};

function syncCropControls(){
  const x=Math.round(cropState.x*100),y=Math.round(cropState.y*100),w=Math.round(cropState.w*100),h=Math.round(cropState.h*100);
  $('#cropX').value=x;$('#cropY').value=y;$('#cropW').value=w;$('#cropH').value=h;$('#cropXVal').textContent=x+'%';$('#cropYVal').textContent=y+'%';$('#cropWVal').textContent=w+'%';$('#cropHVal').textContent=h+'%';
}
function setupCrop(){
  $('#cropWrap').style.display='block';
  ['cropX','cropY'].forEach(id=>{const el=$('#'+id);el.min=0;el.max=100;el.step=1});
  ['cropW','cropH'].forEach(id=>{const el=$('#'+id);el.min=5;el.max=100;el.step=1});
  syncCropControls();
}
['cropX','cropY','cropW','cropH'].forEach(id=>$('#'+id).addEventListener('input',()=>{
  let x=Number($('#cropX').value)/100,y=Number($('#cropY').value)/100,w=Number($('#cropW').value)/100,h=Number($('#cropH').value)/100;
  w=Math.max(.05,Math.min(1,w));h=Math.max(.05,Math.min(1,h));x=Math.max(0,Math.min(x,1-w));y=Math.max(0,Math.min(y,1-h));
  cropState={x,y,w,h};syncCropControls();drawCropPreview();
}));
