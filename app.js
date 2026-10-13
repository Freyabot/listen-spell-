(() => {
  'use strict';
  const data = window.PAPER_DATA;
  const papers=window.PAPERS;
  const $ = id => document.getElementById(id);
  const key = window.PROGRESS_KEY || 'listen-spell-paper1-v1';
  const defaults = {index:0, entries:{}, saved:[], seconds:0, hint:false, variant:true, settings:{sfx:true, volume:.65, autoplay:true, autonext:true, speed:1}};
  let state = structuredClone(defaults), storageOK = true;
  try { const saved = JSON.parse(localStorage.getItem(key) || 'null'); if (saved && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < data.length && saved.entries && Array.isArray(saved.saved)) state = {...defaults,...saved,settings:{...defaults.settings,...saved.settings}}; } catch { storageOK = false; }
  state.hint=false;state.variant=true;state.settings.autoplay=true;state.settings.autonext=true;
  if(state.soundVersion!==2){state.settings.volume=.65;state.soundVersion=2;}
  for(const e of Object.values(state.entries)){e.replays=Number(e.replays)||0;e.wrong=e.replays>=3||!!e.revealed;}
  let sessionActive=false;
  let filter = 'all', query = '', started = false, loop = false, reviewMode = false, loopTimer, nextTimer;
  const speech = $('speech');
  const sounds = Object.fromEntries(['typing','correct','wrong'].map(name => [name,new Audio(`audio/${name}-v2.wav`)]));
  Object.values(sounds).forEach(a => a.preload = 'auto');
  const item = () => data[state.index];
  const paperItems=()=>data.filter(d=>d.paper===item().paper);
  const paper=()=>papers.find(p=>p.id===item().paper);
  const phrase = () => item().en;
  const tokens = () => phrase().split(/\s+/);
  const entry = () => {
    const id = item().id;
    const n = tokens().length;
    if (!state.entries[id] || state.entries[id].values.length !== n) state.entries[id] = {values:Array(n).fill(''), statuses:Array(n).fill(''), done:false, wrong:false, first:null, revealed:false, replays:0};
    return state.entries[id];
  };
  const normalize = text => text.normalize('NFKC').toLowerCase().trim().replace(/[’‘]/g,"'").replace(/[.,!?;:]+$/g,'');
  function matches(value, expected) {
    const v = normalize(value), e = normalize(expected);
    if (v === e) return true;
    if (e === 'something') return v === 'sth';
    if (e === 'someone') return ['sb','somebody'].includes(v);
    if (e === 'analyse') return v === 'analyze';
    if (e === 'centre') return v === 'center';
    return false;
  }
  function persist() {
    try { localStorage.setItem(key,JSON.stringify(state)); } catch { storageOK = false; }
    if(window.ON_PROGRESS_CHANGED)window.ON_PROGRESS_CHANGED(state);else $('storage-status').textContent=storageOK?'进度保存在此浏览器':'本地存储不可用';
  }
  const time = seconds => `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  function sound(name, preview = false) {
    if (!preview && !state.settings.sfx) return;
    const a = sounds[name].cloneNode();
    a.volume = Number(state.settings.volume);
    a.play().catch(() => {});
  }
  function feedback(text, kind = '') { const show = text.startsWith('音频');$('feedback').textContent=show?text:'';$('feedback').hidden=!show; }
  function stats() {
    const group=paperItems(),total=group.length;
    const entries = group.map(d=>state.entries[d.id]).filter(Boolean);
    const done = entries.filter(e => e.done || e.completedEver).length;
    const wrong = entries.filter(e => e.wrong).length;
    const completed=entries.filter(e=>e.done||e.completedEver);
    const independent=completed.filter(e=>!e.wrong).length;
    $('completed-count').textContent = `${done} / ${total} 已完成`;
    $('sidebar-progress').style.width = `${done/total*100}%`;
    $('wrong-count').textContent = wrong;
    $('saved-count').textContent = group.filter(d=>state.saved.includes(d.id)).length;
    $('stat-done').textContent = done;
    $('stat-wrong').textContent = wrong;
    $('stat-first').textContent = done ? `${Math.round(independent/done*100)}%` : '—';
    $('stat-saved').textContent=group.filter(d=>state.saved.includes(d.id)).length;
    $('stat-done-caption').textContent=`已完成 / ${total}`;
    $('completion-ring').style.setProperty('--completion',`${done/total*360}deg`);
    $('ring-percent').textContent=`${Math.round(done/total*100)}%`;
    renderSections('section-progress',true);renderSections('summary-sections',false);
  }
  function renderSections(id,interactive){
    const target=$(id);target.replaceChildren();
    const chapterPapers=papers.filter(p=>p.chapterId===item().chapterId);if(interactive)target.style.gridTemplateColumns=`repeat(${chapterPapers.length},minmax(150px,1fr))`;
    chapterPapers.forEach(p=>{const group=data.filter(d=>d.paper===p.id),done=group.filter(d=>state.entries[d.id]?.done||state.entries[d.id]?.completedEver).length;
      const node=document.createElement(interactive?'button':'div');node.className='section-step'+(item().paper===p.id?' active':'');
      node.innerHTML=`<span class=section-label>${p.name}<b>${done} / ${group.length}</b></span><span class=section-track role=progressbar aria-label="${p.name}完成进度" aria-valuemin=0 aria-valuemax=${group.length} aria-valuenow=${done}><i style="width:${done/group.length*100}%"></i></span>`;
      if(interactive){node.setAttribute('aria-label',`切换到 ${p.name}`);node.setAttribute('aria-current',String(item().paper===p.id));node.onclick=()=>switchPaper(p.id);}target.append(node);
    });
  }
  function visibleItems() {
    return paperItems().filter(d => (filter === 'all' || filter === 'wrong' && state.entries[d.id]?.wrong || filter === 'saved' && state.saved.includes(d.id)) && (!query || String(d.ordinal).includes(query)));
  }
  function renderList() {
    const list = $('item-list'); list.replaceChildren();
    const items = visibleItems();
    if (!items.length) { const p = document.createElement('p'); p.className = 'empty-list'; p.textContent = query ? '没有匹配的题目。试试题号。' : filter === 'saved' ? '还没有收藏。点击练习区的星形按钮收藏。' : '重听至少3次或查看答案的词组会出现在这里。'; list.append(p); }
    items.forEach(d => {
      const e = state.entries[d.id];
      const button = document.createElement('button');
      button.className = `item-row${d.id === item().id ? ' active' : ''}${e?.wrong ? ' flagged' : ''}`;
      if (d.id === item().id) button.setAttribute('aria-current','true');
      button.setAttribute('aria-label',`第${d.ordinal}条，词组${e?.done ? '，已完成' : ''}${e?.wrong ? '，错题' : ''}`);
      const number = document.createElement('span'); number.className = 'number'; number.textContent = String(d.ordinal).padStart(3,'0');
      const label = document.createElement('span'); label.className = 'label'; label.textContent = `词组 ${String(d.ordinal).padStart(3,'0')}`;
      const status = document.createElement('span'); status.className = 'state'; status.textContent = e?.wrong ? '!' : e?.done ? '✓' : state.saved.includes(d.id) ? '☆' : '';
      button.append(number,label,status); button.addEventListener('click',() => navigate(d.id-1)); list.append(button);
    });
    const current = items.findIndex(d => d.id === item().id);
    $('prev').disabled = items.length === 0 || current === 0;
    $('next').disabled = items.length === 0 || current === items.length-1;
  }
  function syncWord(i) {
    const e = entry(), input = $('words').querySelectorAll('input')[i];
    input.className = e.statuses[i];
    input.setAttribute('aria-invalid',e.statuses[i] === 'wrong' ? 'true' : 'false');
  }
  function renderWords() {
    $('words').replaceChildren();
    tokens().forEach((token,i) => {
      const wrapper = document.createElement('label'); wrapper.className = 'word'; wrapper.style.width = `${Math.max(62,Math.min(420,token.length*17+22))}px`;wrapper.style.maxWidth='100%';
      const input = document.createElement('input'); input.type = 'text'; input.value = entry().values[i]; input.autocomplete = 'off'; input.spellcheck = false; input.autocapitalize = 'off'; input.setAttribute('autocorrect','off'); input.setAttribute('aria-label',`第${i+1}个单词`); input.setAttribute('enterkeyhint','next');
      input.disabled=!sessionActive; wrapper.append(input); $('words').append(wrapper);
      input.setAttribute('aria-describedby','word-shortcut');
      let composing=false;
      const currentId=item().id;
      const wordStatus=value=>{
        const v=normalize(value),target=normalize(token);
        const partial=!v||target.startsWith(v)||(target==='something'&&'sth'.startsWith(v))||(target==='analyse'&&'analyze'.startsWith(v))||(target==='centre'&&'center'.startsWith(v));
        return matches(value,token)?'correct':partial?'':'wrong';
      };
      function acceptInput(event={}) {
        if(!input.isConnected||item().id!==currentId)return;
        started = true;
        const e = entry(), previous = e.statuses[i];
        const changed=e.values[i]!==input.value;
        e.values[i] = input.value; e.done = false;
        e.statuses[i] = wordStatus(input.value);
        if(e.statuses[i]==='wrong'&&previous!=='wrong'){sound('wrong');e.first=false;}
        if (changed && event.inputType?.startsWith('insert')) sound('typing');
        if (e.statuses[i] === 'correct' && previous !== 'correct') sound('correct');
        syncWord(i); completion(); persist();
      }
      input.addEventListener('compositionstart',()=>{composing=true;clearTimeout(nextTimer);$('translation').hidden=true;});
      input.addEventListener('input',event => {
        if(composing||event.isComposing){
          // Preview Latin letters without treating an IME candidate as a submitted answer.
          input.className=wordStatus(input.value);
          input.setAttribute('aria-invalid','false');
          if(event.inputType?.startsWith('insert'))sound('typing');
          return;
        }
        acceptInput(event);
      });
      input.addEventListener('compositionend',()=>{composing=false;acceptInput({inputType:'insertFromComposition'});});
      input.addEventListener('keydown',event => {
        if (composing || event.isComposing || event.keyCode===229) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (entry().done && event.key === 'Enter') move(1); else submit(i,true); }
        else if (event.key === 'Backspace' && !input.value && i>0) { event.preventDefault(); focusWord(i-1); }
      });
      input.addEventListener('paste',event => {
        const text = event.clipboardData.getData('text').trim();
        if (!/\s/.test(text)) return;
        event.preventDefault(); started = true;
        const pasted = text.split(/\s+/); const remaining = tokens().length-i;
        if (pasted.length > remaining) { feedback(`输入了 ${pasted.length} 个词，当前只剩 ${remaining} 个位置。请核对后再粘贴。`,'error'); sound('wrong'); return; }
        const e = entry(); e.done = false;
        pasted.forEach((v,j) => { e.values[i+j] = v; e.statuses[i+j] = matches(v,tokens()[i+j]) ? 'correct' : 'wrong'; if(e.statuses[i+j] === 'wrong') {e.first=false;} });
        renderWords(); completion(); stats(); renderList(); persist();
        const bad = e.statuses.findIndex(s => s === 'wrong');
        if (bad>=0) {sound('wrong');feedback('有单词未匹配，请检查红色位置。','error');focusWord(bad);} else {sound('correct');focusWord(Math.min(i+pasted.length,tokens().length-1));}
      });
      syncWord(i);
    });
  }
  function focusWord(i) { const input = $('words').querySelectorAll('input')[i]; input?.focus({preventScroll:true}); input?.setSelectionRange(input.value.length,input.value.length); }
  function submit(i,advance) {
    started = true; const e = entry();
    if (!e.values[i].trim()) { feedback('先填写当前单词；也可以重听词组。');focusWord(i); return; }
    if (matches(e.values[i],tokens()[i])) { if(e.statuses[i] !== 'correct') sound('correct');e.statuses[i]='correct';syncWord(i);completion();if(advance && i<tokens().length-1) focusWord(i+1); }
    else {e.statuses[i]='wrong';e.first=false;sound('wrong');syncWord(i);feedback('这个词还不对。重听一下，再试一次。','error');focusWord(i);stats();renderList();}
    persist();
  }
  function completion() {
    clearTimeout(nextTimer);
    const e = entry();
    if (e.statuses.every(s => s === 'correct')) {
      const wasDone = e.done; e.done=true;e.completedEver=true;
      $('translation').textContent=item().zh;$('translation').hidden=false;
      $('word-shortcut').hidden=true;
      if(e.first === null) e.first = !e.revealed;
      feedback(e.wrong ? '词组已写对，已保留在错题中供你复习。' : '全部正确。按 Enter，继续下一条。','success');
      clearTimeout(loopTimer);speech.pause();ttsPlaying=false;window.speechSynthesis?.cancel();setPlaying(false);stats();renderList();
      if(sessionActive) {const currentId=item().id;nextTimer=setTimeout(()=>{if(item().id!==currentId||!entry().done)return;const items=visibleItems(),pos=items.findIndex(d=>d.id===currentId);if(pos===items.length-1)openSummary();else move(1);},1800);}
    } else {$('translation').hidden=true;$('translation').textContent='';$('word-shortcut').hidden=!sessionActive;feedback('');stats();}
  }
  let ttsPlaying=false;
  function stopAudio() {ttsPlaying=false;window.speechSynthesis?.cancel(); clearTimeout(loopTimer);speech.pause();speech.currentTime=0;setPlaying(false); }
  function setPlaying(on) { $('audio-visual').classList.toggle('playing',on);$('play-symbol').textContent=on?'Ⅱ':'▶';$('play-label').textContent=on?'暂停朗读':'播放词组';$('play').setAttribute('aria-label',on?'暂停朗读':'播放当前词组'); }
  function play(options={}) {
    const initial=!sessionActive;
    if(!sessionActive) {sessionActive=true;$('start-session').hidden=true;$('word-shortcut').hidden=false;if(entry().done){const e=entry();e.completedEver=true;e.values=tokens().map(()=>'');e.statuses=tokens().map(()=>'');e.done=false;$('translation').hidden=true;$('translation').textContent='';}renderWords();focusWord(0);}
    started=true;clearTimeout(loopTimer);
    if(!item().audio){
      if(!window.speechSynthesis){feedback('音频尚未配置，此设备不支持英文朗读。');return;}
      if(ttsPlaying){ttsPlaying=false;speechSynthesis.cancel();setPlaying(false);return;}
      const utterance=new SpeechSynthesisUtterance(item().en),playingId=item().id;utterance.lang='en-US';utterance.rate=Number(state.settings.speed);utterance.voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'))||null;
      utterance.onstart=()=>{if(item().id!==playingId)return;ttsPlaying=true;setPlaying(true);if(!initial&&(options.replay||!options.automatic)){const e=entry();e.replays=(e.replays||0)+1;e.wrong=e.replays>=3||e.revealed;stats();renderList();persist();}};
      utterance.onend=()=>{ttsPlaying=false;setPlaying(false);if(loop&&item().id===playingId&&!entry().done)loopTimer=setTimeout(()=>play({replay:true}),1200);};utterance.onerror=e=>{ttsPlaying=false;setPlaying(false);if(!['canceled','interrupted'].includes(e.error))feedback('音频朗读失败，请重试。');};speechSynthesis.speak(utterance);return;
    }
    if(!speech.paused) {speech.pause();setPlaying(false);return;}
    const replay=!initial&&(options.replay||(!options.automatic&&(speech.currentTime===0||speech.ended)));
    const playingId=item().id;
    speech.playbackRate = Number(state.settings.speed);
    speech.play().then(()=>{if(item().id!==playingId)return;setPlaying(true);if(replay){const e=entry();e.replays=(e.replays||0)+1;e.wrong=e.replays>=3||e.revealed;stats();renderList();persist();}}).catch(error=>{if(error.name!=='AbortError') feedback('音频暂时未能播放，请再点击一次播放。','error');});
  }
  speech.addEventListener('ended',()=>{setPlaying(false);if(loop && !entry().done) loopTimer=setTimeout(()=>{speech.currentTime=0;play({replay:true});},1200);});
  speech.addEventListener('pause',()=>setPlaying(false));
  speech.addEventListener('error',()=>feedback('音频加载失败，请刷新页面后重试。','error'));
  function renderPractice() {
    stopAudio();$('translation').hidden=true;$('translation').textContent='';$('answer-panel').hidden=true;$('answer').setAttribute('aria-pressed','false');
    $('word-shortcut').hidden=!sessionActive;
    if(!sessionActive&&entry().done){const e=entry();e.completedEver=true;e.done=false;e.values=tokens().map(()=>'');e.statuses=tokens().map(()=>'');}
    const d=item();$('current-number').textContent=String(d.ordinal).padStart(3,'0');$('source-page').textContent=`第 ${d.page} 页`;
    $('current-total').textContent=`/ ${paper().count}`;$('paper-heading').textContent=String(paper().number).padStart(2,'0');$('crumb-paper').textContent=paper().name;$('footer-paper').textContent=paper().name.toUpperCase();$('paper-select').value=d.paper;$('paper-description').textContent=`${paper().count} 条语料 · ${window.CHAPTERS.find(c=>c.id===d.chapterId)?.title||''}`;renderLibraryPickers();$('source-page').textContent=d.page?`第 ${d.page} 页`:window.CHAPTERS.find(c=>c.id===d.chapterId)?.title||'';document.querySelector('.voice-label').textContent=d.audio?'英文朗读':'设备英文朗读';
    $('save').setAttribute('aria-pressed',String(state.saved.includes(d.id)));$('save').setAttribute('aria-label',state.saved.includes(d.id)?'取消收藏当前词组':'收藏当前词组');
    if(d.audio)speech.src=d.audio;else speech.removeAttribute('src');
    renderWords();feedback('');if(entry().done){$('translation').textContent=d.zh;$('translation').hidden=false;}renderList();stats();
  }
  function switchPaper(id){
    const group=data.filter(d=>d.paper===Number(id));if(!group.length)return;
    filter='all';query='';reviewMode=false;$('search').value='';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='all'));
    const target=group.find(d=>!(state.entries[d.id]?.done||state.entries[d.id]?.completedEver))||group[0];navigate(target.id-1);
    $('section-progress').querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function navigate(index) {
    if(index<0||index>=data.length)return;
    clearTimeout(nextTimer);persist();state.index=index;
    if(sessionActive && entry().done){const e=entry();e.completedEver=true;e.values=tokens().map(()=>'');e.statuses=tokens().map(()=>'');e.done=false;}
    $('summary').hidden=true;$('sidebar').classList.remove('open');$('directory-toggle').setAttribute('aria-expanded','false');renderPractice();persist();
    $('item-list').querySelector('.active')?.scrollIntoView({block:'nearest',inline:'nearest'});
    if(sessionActive) play({automatic:true});
    focusWord(Math.max(0,entry().statuses.findIndex(s=>s!=='correct')));
  }
  function move(direction) {const items=visibleItems(),pos=items.findIndex(d=>d.id===item().id);const target=items[pos<0?0:pos+direction];if(target) navigate(target.id-1);else if(direction>0&&item().ordinal===paper().count&&entry().done) openSummary();}
  function openSummary() {stopAudio();clearTimeout(nextTimer);stats();$('summary').hidden=false;$('summary-close').focus();}
  $('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('play').onclick=play;
  $('start-session').onclick=()=>play({automatic:true});
  $('replay').onclick=()=>{stopAudio();play({replay:true});};
  $('answer').onclick=()=>{if(!sessionActive)return;const showing=$('answer-panel').hidden;$('answer-panel').hidden=!showing;$('answer').setAttribute('aria-pressed',String(showing));if(showing){clearTimeout(nextTimer);const e=entry();e.revealed=true;e.wrong=true;e.first=false;$('answer-text').textContent=item().source||item().en;stats();renderList();persist();}};
  $('save').onclick=()=>{const id=item().id;state.saved=state.saved.includes(id)?state.saved.filter(n=>n!==id):[...state.saved,id];$('save').setAttribute('aria-pressed',String(state.saved.includes(id)));$('save').setAttribute('aria-label',state.saved.includes(id)?'取消收藏当前词组':'收藏当前词组');stats();renderList();persist();};
  $('loop').onclick=()=>{loop=!loop;clearTimeout(loopTimer);$('loop').textContent=loop?'↻ 循环开启':'↻ 循环关闭';$('loop').setAttribute('aria-pressed',String(loop));if(loop&&speech.paused){speech.currentTime=0;play();}};
  $('speed').value=state.settings.speed;$('speed').onchange=()=>{state.settings.speed=Number($('speed').value);speech.playbackRate=state.settings.speed;persist();};
  function setSettings(open) {$('settings').hidden=!open;$('settings-toggle').setAttribute('aria-expanded',String(open));}
  $('settings-toggle').onclick=()=>setSettings($('settings').hidden);$('settings-close').onclick=()=>{setSettings(false);$('settings-toggle').focus();};
  [['sfx-enabled','sfx']].forEach(([id,name])=>{$(id).checked=state.settings[name];$(id).onchange=()=>{state.settings[name]=$(id).checked;if(name==='autonext')clearTimeout(nextTimer);persist();};});
  $('sfx-volume').value=state.settings.volume;$('sfx-volume').oninput=()=>{state.settings.volume=Number($('sfx-volume').value);persist();};
  document.querySelectorAll('[data-sound]').forEach(b=>b.onclick=()=>sound(b.dataset.sound,true));
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{reviewMode=false;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(t=>t.classList.toggle('selected',t===b));renderList();const visible=visibleItems();if(visible.length&&!visible.some(d=>d.id===item().id)) navigate(visible[0].id-1);});
  $('search').oninput=()=>{query=$('search').value.trim();renderList();};
  $('directory-toggle').onclick=()=>{const open=$('sidebar').classList.toggle('open');$('directory-toggle').setAttribute('aria-expanded',String(open));};
  $('summary-open').onclick=openSummary;$('summary-close').onclick=()=>{$('summary').hidden=true;focusWord(0);if(sessionActive){speech.currentTime=0;play();}};
  $('review-wrong').onclick=()=>{const ids=paperItems().filter(d=>state.entries[d.id]?.wrong);if(!ids.length){$('summary').hidden=true;feedback('目前没有错题，继续练习即可。');return;}reviewMode=true;filter='wrong';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='wrong'));query='';$('search').value='';navigate(ids[0].id-1);};
  $('reset-toggle').onclick=()=>$('reset-confirm').hidden=false;$('reset-cancel').onclick=()=>$('reset-confirm').hidden=true;
  $('reset-confirmed').onclick=async()=>{const button=$('reset-confirmed');button.disabled=true;try{stopAudio();const firstId=paper().firstId;paperItems().forEach(d=>delete state.entries[d.id]);reviewMode=false;filter='all';query='';$('search').value='';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='all'));$('reset-confirm').hidden=true;navigate(firstId-1);}catch(e){feedback('重置失败，请刷新后重试。');}finally{button.disabled=false;}};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){setSettings(false);$('sidebar').classList.remove('open');$('directory-toggle').setAttribute('aria-expanded','false');}if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();play();}});
  document.addEventListener('click',event=>{if(!$('settings').hidden&&!$('settings').contains(event.target)&&!$('settings-toggle').contains(event.target))setSettings(false);});
  window.addEventListener('beforeunload',persist);
  function renderLibraryPickers(){
    const bookId=item().bookId,chapterId=item().chapterId;$('book-select').value=bookId;
    const chapters=window.CHAPTERS.filter(c=>c.bookId===bookId);$('chapter-select').replaceChildren();chapters.forEach(c=>{const option=document.createElement('option');option.value=c.id;option.textContent=c.title;$('chapter-select').append(option);});$('chapter-select').value=chapterId;
    $('paper-select').replaceChildren();papers.filter(p=>p.chapterId===chapterId).forEach(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=`${p.name} · ${p.count} 条`;$('paper-select').append(option);});$('paper-select').value=item().paper;
  }
  window.BOOKS.forEach(b=>{const option=document.createElement('option');option.value=b.id;option.textContent=b.title;$('book-select').append(option);});
  $('book-select').onchange=()=>{const c=window.CHAPTERS.find(c=>c.bookId===$('book-select').value);const p=papers.find(p=>p.chapterId===c?.id);if(p)switchPaper(p.id);};
  $('chapter-select').onchange=()=>{const p=papers.find(p=>p.chapterId===$('chapter-select').value);if(p)switchPaper(p.id);};
  $('paper-select').onchange=()=>switchPaper($('paper-select').value);
  window.APPLY_CLOUD_PROGRESS=next=>{const current=entry().values.join('\u0000');state.entries=next.entries;state.saved=next.saved;if(entry().values.join('\u0000')!==current){const focused=[...$('words').querySelectorAll('input')].indexOf(document.activeElement);renderWords();if(focused>=0)focusWord(focused);}stats();renderList();try{localStorage.setItem(key,JSON.stringify(state));}catch{}};
  renderPractice();persist();
})();
