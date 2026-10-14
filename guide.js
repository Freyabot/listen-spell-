(() => {
  'use strict';
  const key = 'listen-spell-guide-completed-v1';
  const dialog = document.getElementById('practice-guide');
  const trigger = document.getElementById('guide-open');
  const steps = [
    {title:'先选今天想练的内容',body:'在左侧选择章节与小节，点击「开始听写」。需要找某一道题时，可以输入题号；想专心练习，也可以收起学习目录。',tip:'从一个小节开始就好 (｡•ᴗ•｡)',visual:'词书 → 章节 → 小节',detail:'目录随时可以展开或收起。'},
    {title:'听见一个词，写下一个词',body:'听音频后，在横线上的输入框中逐词拼写。绿色表示拼写正确，红色表示尚未匹配；全部写对后，会显示中文释义。',tip:'没听清也没关系，再听一遍 (´･ᴗ･`)',visual:'听音频 → 逐词输入 → 查看释义',detail:'输入未匹配不直接计入错题。'},
    {title:'两个按键，掌握练习节奏',body:'Enter 播放或暂停当前词组。Space 在未完成时切换到下一个单词；整条词组写对后，按 Space 立即进入下一条，不会自动跳转。',tip:'按自己的节奏继续 (ง •̀_•́)ง',visual:'Enter  播放／暂停     Space  切换',detail:'先点进听写输入框；中文输入法选字时，空格仍用于选字。'},
    {title:'把需要再听的词留下来',body:'重听同一词组至少 3 次，或查看过提示答案，会将它加入错题。首次自动播放不计入，循环重播计入重听次数。点击星形按钮可以收藏，左侧可筛选错题或收藏。',tip:'想再练的词，先留个记号 (๑˃̵ᴗ˂̵)و',visual:'重听 · 提示答案 · 收藏',detail:'查看答案后会加入错题；写对后仍保留在错题中供复习。'},
    {title:'回看进度，再练陌生的词',body:'点击左侧「查看练习统计」，查看完成度与需要复习的词组，再点击「复习错题」开始重听。独立完成率表示已完成词组中，未依赖上述帮助的比例。',tip:'每次练习都留下记录 (˶ᵔ ᵕ ᵔ˶)',visual:'练习统计 → 复习错题',detail:'重新开始小节会清空该小节输入、错题与统计，保留收藏和声音设置。'},
    {title:'下次回来，接着练',body:'进度、收藏、声音设置和引导完成状态保存在当前浏览器，换设备或浏览器不会同步。清除网站数据后，这些记录也会被清除。',tip:'准备好了，就开始吧 ヽ(•̀ω•́ )ゝ',visual:'当前浏览器保存 · 无需注册',detail:'完成后，右上角「新手引导」可以随时带你重看这六步。'}
  ];
  let index=0, saved=false, previousFocus=null;
  try { saved=localStorage.getItem(key)==='true'; } catch {}
  function render() {
    const step=steps[index];
    document.getElementById('guide-step').textContent=`${index+1} / ${steps.length}`;
    document.getElementById('guide-title').textContent=step.title;
    document.getElementById('guide-body').textContent=step.body;
    document.getElementById('guide-tip').textContent=step.tip;
    document.getElementById('guide-visual').textContent=step.visual;
    document.getElementById('guide-detail').textContent=step.detail;
    document.getElementById('guide-back').disabled=index===0;
    document.getElementById('guide-next').textContent=index===steps.length-1?'开始练习':'下一步';
    document.getElementById('guide-dots').replaceChildren(...steps.map((_,i)=>{const dot=document.createElement('i');dot.classList.toggle('active',i===index);return dot;}));
  }
  function open() {
    previousFocus=document.activeElement;index=0;
    document.dispatchEvent(new Event('practice-guide-open'));
    render();dialog.showModal();document.getElementById('guide-next').focus();
  }
  function close(complete) {
    if(complete){saved=true;try{localStorage.setItem(key,'true');}catch{}}
    dialog.close();trigger.hidden=false;
    (previousFocus?.isConnected&&!previousFocus.hidden?previousFocus:trigger).focus();
  }
  trigger.hidden=!saved;trigger.addEventListener('click',open);
  document.getElementById('guide-next').addEventListener('click',()=>{if(index===steps.length-1)close(true);else{index++;render();}});
  document.getElementById('guide-back').addEventListener('click',()=>{if(index>0){index--;render();}});
  document.getElementById('guide-skip').addEventListener('click',()=>close(true));
  dialog.addEventListener('cancel',event=>{event.preventDefault();close(false);});
  // Modal controls keep their native keyboard behavior without activating practice shortcuts.
  document.addEventListener('keydown',event=>{
    if(!dialog.open)return;
    event.stopPropagation();
    if(event.key==='Tab'){
      const controls=[...dialog.querySelectorAll('button')].filter(button=>!button.disabled&&!button.hidden);
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  },true);
  if(!saved)open();
})();
