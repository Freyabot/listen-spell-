(async()=>{
 'use strict';
 const cfg=window.PAID_CONFIG,authKey='listen-spell-paid-auth';
 const message=document.getElementById('paid-loading-message');
 let device=localStorage.getItem('listen-spell-device');if(!device){device=crypto.randomUUID();localStorage.setItem('listen-spell-device',device);}
 let lease=sessionStorage.getItem('listen-spell-lease');if(!lease){lease=crypto.randomUUID();sessionStorage.setItem('listen-spell-lease',lease);}
 let session=JSON.parse(localStorage.getItem(authKey)||'null');
 const errors={in_use:'另一个练习窗口正在使用这个账号，请先关闭它，约 90 秒后再试。',device_limit:'已绑定两个浏览器设备，请回到账号页移除旧设备。',license_required:'请先在账号页兑换激活码。',session_expired:'练习会话已结束，请回到账号页重新进入。',audio_unavailable:'私有音频尚未准备完成，测试版暂不支持播放。'};
 async function api(action,payload={}){
  if(!session)throw Error('请先登录账号。');
  if(session.expires_at<Date.now()/1000+60){const r=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok)throw Error('登录已失效，请重新登录。');session=await r.json();session.expires_at=Date.now()/1000+session.expires_in;localStorage.setItem(authKey,JSON.stringify(session));}
  const r=await fetch(cfg.url+'/functions/v1/paid-gateway',{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,payload:{device,lease,...payload}})});
  const data=await r.json();if(!data.ok)throw Error(errors[data.error]||'服务尚未准备好，请稍后重试。');return data;
 }
 try{
  await api('acquire',{label:/Edg\//.test(navigator.userAgent)?'Edge 浏览器':/Chrome\//.test(navigator.userAgent)?'Chrome 浏览器':'其他浏览器'});
  const catalog=await api('catalog');
  const chapters=catalog.chapters.sort((a,b)=>a.number-b.number);
  const sections=catalog.sections.sort((a,b)=>chapters.findIndex(c=>c.id===a.chapter_id)-chapters.findIndex(c=>c.id===b.chapter_id)||a.position-b.position);
  const requested=new URLSearchParams(location.search).get('section');
  const section=sections.find(s=>s.id===requested)||sections.find(s=>s.id==='wl-ielts-ch5-tp1')||sections[0];
  if(!section)throw Error('暂无可练习的小节。');
  const loaded=await api('section',{section:section.id});
  if(!loaded.items?.length)throw Error('这个小节尚未准备好。');
  window.BOOKS=catalog.books;
  window.CHAPTERS=chapters.map(x=>({id:x.id,bookId:x.book_id,title:x.title,number:x.number}));
  window.PAPERS=sections.map((x,i)=>({id:i+1,uid:x.id,name:x.title,chapterId:x.chapter_id,bookId:chapters.find(c=>c.id===x.chapter_id).book_id,number:x.number,count:x.id===section.id?loaded.items.length:0,firstId:1}));
  const paper=window.PAPERS.find(p=>p.uid===section.id);
  window.PAPER_DATA=loaded.items.map((x,i)=>({id:i+1,uid:x.id,sectionUid:x.section_id,paper:paper.id,ordinal:x.position,en:x.english,zh:x.chinese,page:x.page,source:x.source,audio:'protected',bookId:paper.bookId,chapterId:paper.chapterId}));
  window.PROGRESS_KEY=`listen-spell-paid-progress-${session.user.id}-${section.id}`;
  window.LOAD_PAID_SECTION=async id=>{await api('release');location.href='practice.html?section='+encodeURIComponent(window.PAPERS.find(p=>p.id===Number(id)).uid);};
  window.PAID_AUDIO=async id=>(await api('audio',{item:id})).url;
  document.getElementById('paid-loading').hidden=true;document.getElementById('paid-practice').hidden=false;
  await import('./practice-app.js');await import('../guide.js');
  document.getElementById('paid-account').onclick=async()=>{try{await api('release');}finally{location.href='index.html';}};
  let pending=false;
  const timer=setInterval(async()=>{if(pending)return;pending=true;try{await api('heartbeat');}catch(error){clearInterval(timer);document.dispatchEvent(new Event('practice-guide-open'));document.getElementById('paid-practice').hidden=true;document.getElementById('paid-loading').hidden=false;message.textContent=error.message;}finally{pending=false;}},25000);
  window.addEventListener('pagehide',()=>{fetch(cfg.url+'/functions/v1/paid-gateway',{method:'POST',keepalive:true,headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'release',payload:{device,lease}})}).catch(()=>{});});
 }catch(error){message.textContent=error.message;}
})();
