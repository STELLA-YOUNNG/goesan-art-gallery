function drawCropPreview(){
  if(!sourceImg)return;
  const c=$('#cropCanvas'),ctx=c.getContext('2d');
  const maxW=760;
  const scale=Math.min(1,maxW/sourceImg.width);
  c.width=Math.max(1,Math.round(sourceImg.width*scale));
  c.height=Math.max(1,Math.round(sourceImg.height*scale));
  ctx.clearRect(0,0,c.width,c.height);
  ctx.drawImage(sourceImg,0,0,c.width,c.height);
  const x=cropState.x*c.width,y=cropState.y*c.height,w=cropState.w*c.width,h=cropState.h*c.height;
  ctx.save();ctx.fillStyle='rgba(0,0,0,.48)';ctx.beginPath();ctx.rect(0,0,c.width,c.height);ctx.rect(x,y,w,h);try{ctx.fill('evenodd')}catch(e){ctx.fill()}ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(sourceImg,0,0,c.width,c.height);ctx.restore();
  ctx.save();ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);ctx.strokeStyle='#2f695a';ctx.lineWidth=1;ctx.strokeRect(x+2,y+2,Math.max(0,w-4),Math.max(0,h-4));
  const s=10;ctx.fillStyle='#ffffff';[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx,cy])=>{ctx.fillRect(cx-s/2,cy-s/2,s,s);ctx.strokeStyle='#2f695a';ctx.strokeRect(cx-s/2,cy-s/2,s,s)});ctx.restore();
}

let cropDragging=false;let cropDragStart=null;
function canvasPoint(ev){
  const c=$('#cropCanvas'),r=c.getBoundingClientRect();
  const clientX=ev.clientX??(ev.touches?.[0]?.clientX??0),clientY=ev.clientY??(ev.touches?.[0]?.clientY??0);
  return {x:Math.max(0,Math.min(c.width,(clientX-r.left)*(c.width/r.width))),y:Math.max(0,Math.min(c.height,(clientY-r.top)*(c.height/r.height)))};
}
function beginCropDrag(ev){if(!sourceImg)return;ev.preventDefault();cropDragging=true;cropDragStart=canvasPoint(ev);if(ev.pointerId!==undefined){try{$('#cropCanvas').setPointerCapture(ev.pointerId)}catch(e){}}}
function moveCropDrag(ev){
  if(!cropDragging||!cropDragStart)return;ev.preventDefault();
  const c=$('#cropCanvas'),p=canvasPoint(ev);
  const left=Math.min(cropDragStart.x,p.x),top=Math.min(cropDragStart.y,p.y),right=Math.max(cropDragStart.x,p.x),bottom=Math.max(cropDragStart.y,p.y);
  if(right-left<8||bottom-top<8)return;
  cropState={x:left/c.width,y:top/c.height,w:(right-left)/c.width,h:(bottom-top)/c.height};syncCropControls();drawCropPreview();
}
function endCropDrag(ev){if(!cropDragging)return;ev.preventDefault();cropDragging=false;cropDragStart=null;drawCropPreview()}
const cropCanvas=$('#cropCanvas');
cropCanvas.addEventListener('pointerdown',beginCropDrag);cropCanvas.addEventListener('pointermove',moveCropDrag);cropCanvas.addEventListener('pointerup',endCropDrag);cropCanvas.addEventListener('pointercancel',endCropDrag);

async function compressedBlob(){
  if(!sourceImg)return null;
  const sx=Math.max(0,Math.round(cropState.x*sourceImg.width)),sy=Math.max(0,Math.round(cropState.y*sourceImg.height)),sw=Math.max(1,Math.round(cropState.w*sourceImg.width)),sh=Math.max(1,Math.round(cropState.h*sourceImg.height));
  const maxDim=1600,scale=Math.min(1,maxDim/Math.max(sw,sh));
  const c=document.createElement('canvas'),ctx=c.getContext('2d');
  c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
  ctx.drawImage(sourceImg,sx,sy,sw,sh,0,0,c.width,c.height);
  return await new Promise(res=>c.toBlob(res,'image/jpeg',0.82));
}

$('#saveWorkBtn').onclick=async()=>{
  const student=$('#studentName').value.trim(),title=$('#workTitle').value.trim();
  if(!student||!title){alert('학생 이름과 작품 제목을 입력해 주세요.');return}
  if(!editingId&&!sourceImg){alert('작품 사진을 선택해 주세요.');return}
  try{
    let imagePath='',imageUrl='',old=null;
    if(editingId) old=await get('works',editingId);
    if(sourceImg){const imageBlob=await compressedBlob();const uploaded=await uploadArtworkImage(imageBlob,old?.imagePath||'');imagePath=uploaded.imagePath;imageUrl=uploaded.imageUrl}
    else if(old){imagePath=old.imagePath||'';imageUrl=old.imageUrl||''}
    const record={...(old||{}),student,grade:$('#gradeInput').value,title,desc:$('#workDesc').value.trim(),exhibitionId:Number($('#workExhibition').value),imagePath,imageUrl,createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};
    if(editingId) await put('works',record);else await add('works',record);
    closeModal('workModal');resetWorkForm();await renderGallery();await updateHeroRecentWorks();
  }catch(err){console.error(err);alert('온라인 저장 중 오류가 발생했습니다. Supabase 테이블/권한 설정을 확인해 주세요.')}
};

async function renderExList(){
  const exs=await getAll('exhibitions'),works=await getAll('works');
  const el=$('#exList');el.innerHTML='';
  exs.forEach(ex=>{
    const count=works.filter(w=>w.exhibitionId===ex.id).length;
    const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee';
    row.innerHTML=`<div><b>${esc(ex.title)}</b><div class="meta">${count}점 · ${esc(ex.desc||'')}</div></div><button class="btn danger">전시 삭제</button>`;
    row.querySelector('button').onclick=async()=>{
      if(count&&!confirm(`이 전시에는 작품 ${count}점이 있습니다. 전시와 작품을 모두 삭제할까요?`))return;
      if(!count&&!confirm('이 전시를 삭제할까요?'))return;
      for(const w of works.filter(w=>w.exhibitionId===ex.id)) await del('works',w.id);
      await del('exhibitions',ex.id);await refreshAll();await renderExList();
    };
    el.appendChild(row);
  });
}
$('#addExBtn').onclick=async()=>{
  const title=$('#newExTitle').value.trim();if(!title)return alert('전시 이름을 입력해 주세요.');
  await add('exhibitions',{title,desc:$('#newExDesc').value.trim(),createdAt:Date.now()});$('#newExTitle').value='';$('#newExDesc').value='';await refreshAll();await renderExList();
};

$('#adminBtn').onclick=async()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(session){await sb.auth.signOut();setAdminUI(false)}else openModal('loginModal');
};
$('#loginSubmit').onclick=async()=>{
  const email=$('#loginEmail').value.trim(),password=$('#loginPassword').value;
  if(!email||!password)return alert('이메일과 비밀번호를 입력해 주세요.');
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error){console.error(error);alert('로그인에 실패했습니다. Supabase 관리자 계정을 확인해 주세요.');return}
  setAdminUI(true);$('#loginPassword').value='';closeModal('loginModal');
};
$('#changePwBtn').onclick=()=>{};
$('#addWorkBtn').onclick=()=>{resetWorkForm();openModal('workModal')};
$('#manageExBtn').onclick=async()=>{await renderExList();openModal('exModal')};
const topManage=$('#manageExBtnTop');if(topManage)topManage.onclick=async()=>{await renderExList();openModal('exModal')};

$('#backupBtn').onclick=async()=>{
  const works=await getAll('works'),ex=await getAll('exhibitions');
  const data=JSON.stringify({version:3,source:'supabase',exhibitions:ex,works},null,2);
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download='goesan_myeongdeok_gallery_backup.json';a.click();
};
$('#restoreLabel').style.display='none';$('#restoreInput').onchange=()=>{};

$('#schoolPhotoBtn').onclick=()=>$('#schoolPhotoInput').click();
$('#schoolPhotoInput').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  const img=new Image();img.onload=async()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d');const max=1200,s=Math.min(1,max/Math.max(img.width,img.height));c.width=img.width*s;c.height=img.height*s;ctx.drawImage(img,0,0,c.width,c.height);const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.8));await setSetting('schoolPhoto',b);await loadSchoolPhoto()};img.src=URL.createObjectURL(f);
};
async function loadSchoolPhoto(){
  const v=await getSetting('schoolPhoto'),img=$('#schoolPhoto'),ph=$('#heroPlaceholder');
  if(!img)return;
  if(v){img.src=v;img.classList.add('show');if(ph)ph.style.display='none'}else{img.classList.remove('show');if(ph)ph.style.display='flex'}
}

$('#exhibitionSelect').onchange=renderGallery;$('#searchInput').oninput=renderGallery;$('#sortSelect').onchange=renderGallery;
$('#clearBtn').onclick=()=>{$('#searchInput').value='';activeGrade='all';$('#sortSelect').value='new';buildGradeTabs();renderGallery()};
$$('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')}));

$('#prevWorkBtn').onclick=showPreviousWork;$('#nextWorkBtn').onclick=showNextWork;$('#prevWorkTextBtn').onclick=showPreviousWork;$('#nextWorkTextBtn').onclick=showNextWork;
document.addEventListener('keydown',e=>{
  if(!$('#viewModal').classList.contains('show'))return;
  if(e.key==='ArrowLeft'){e.preventDefault();showPreviousWork()}else if(e.key==='ArrowRight'){e.preventDefault();showNextWork()}else if(e.key==='Escape'){closeModal('viewModal')}
});

sb.auth.onAuthStateChange((_event,session)=>setAdminUI(!!session));
initDB();
