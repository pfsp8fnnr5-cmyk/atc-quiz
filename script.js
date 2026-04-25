const $ = (id) => document.getElementById(id);
const STORAGE = "atc_quiz_full_questions_v2";
let state = {
  mode: "sequential",
  order: [],
  index: 0,
  sessionAnswers: {},
  correct: 0,
  timerId: null,
  endsAt: null
};

function loadStore(){
  return JSON.parse(localStorage.getItem(STORAGE) || '{"total":0,"correct":0,"wrong":{}}');
}
function saveStore(s){ localStorage.setItem(STORAGE, JSON.stringify(s)); }
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function getRange(){
  let start = clamp(parseInt($("startNo").value||1),1,QUIZ_DATA.length);
  let end = clamp(parseInt($("endNo").value||QUIZ_DATA.length),1,QUIZ_DATA.length);
  if(start>end) [start,end]=[end,start];
  return Array.from({length:end-start+1},(_,i)=>start+i);
}
function modeLabel(mode){
  return {sequential:"順序刷題", random:"隨機刷題", range:"範圍練習", mock:"模擬考", wrong:"錯題本"}[mode] || "刷題";
}
function updateStats(){
  const s = loadStore();
  $("totalDone").textContent = s.total;
  $("accuracy").textContent = s.total ? Math.round(s.correct/s.total*100)+"%" : "0%";
  $("wrongCount").textContent = Object.keys(s.wrong||{}).length;
}
function setMode(mode){
  state.mode=mode;
  document.querySelectorAll(".mode").forEach(b=>b.classList.toggle("active", b.dataset.mode===mode));
}
function startQuiz(){
  const s = loadStore();
  let order = [];
  if(state.mode==="sequential") order = Array.from({length:QUIZ_DATA.length},(_,i)=>i+1);
  if(state.mode==="range") order = getRange();
  if(state.mode==="random") order = shuffle(getRange());
  if(state.mode==="mock"){
    const count = clamp(parseInt($("mockCount").value||50),1,QUIZ_DATA.length);
    order = shuffle(getRange()).slice(0,count);
    const mins = clamp(parseInt($("minutes").value||30),1,300);
    state.endsAt = Date.now() + mins*60*1000;
    startTimer();
  } else {
    state.endsAt = null;
    $("timer").textContent = "--:--";
    if(state.timerId) clearInterval(state.timerId);
  }
  if(state.mode==="wrong"){
    order = Object.keys(s.wrong||{}).map(Number).sort((a,b)=>a-b);
    if(!order.length){ alert("目前沒有錯題紀錄"); return; }
  }
  state.order=order; state.index=0; state.sessionAnswers={}; state.correct=0;
  $("setup").classList.add("hidden"); $("result").classList.add("hidden"); $("quiz").classList.remove("hidden");
  render();
}
function startTimer(){
  if(state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(()=>{
    const left = Math.max(0, state.endsAt-Date.now());
    const m = Math.floor(left/60000), sec = Math.floor((left%60000)/1000);
    $("timer").textContent = String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");
    if(left<=0){ clearInterval(state.timerId); finish(); }
  },300);
}
function render(){
  const qNo = state.order[state.index];
  const item = QUIZ_DATA[qNo-1];
  const answered = state.sessionAnswers[qNo];
  $("progress").textContent = `第 ${state.index+1} / ${state.order.length} 題`;
  $("modeName").textContent = modeLabel(state.mode);
  $("barFill").style.width = `${(state.index)/state.order.length*100}%`;
  $("questionTitle").textContent = `第 ${qNo} 題`;
  $("questionText").textContent = item.question;
  $("feedback").className = "feedback";
  $("feedback").textContent = answered ? (answered.choice===item.answer ? "正確！" : `錯誤，正確答案：${item.answer}`) : "";
  const choices = ["A","B","C","D"].map(c=>{
    let cls="choice";
    if(answered){
      if(c===item.answer) cls+=" correct";
      else if(c===answered.choice) cls+=" wrong";
      else cls+=" disabled";
    }
    return `<button class="${cls}" onclick="choose('${c}')" ${answered?"disabled":""}>${c}</button>`;
  }).join("");
  $("choices").innerHTML = choices;
  $("prevBtn").disabled = state.index===0;
  $("nextBtn").textContent = state.index===state.order.length-1 ? "完成" : "下一題";
}
function choose(choice){
  const qNo = state.order[state.index];
  const item = QUIZ_DATA[qNo-1];
  if(state.sessionAnswers[qNo]) return;
  const ok = choice===item.answer;
  state.sessionAnswers[qNo] = {choice, ok};
  if(ok) state.correct++;
  const s = loadStore();
  s.total++; if(ok) s.correct++;
  if(ok) delete s.wrong[qNo]; else s.wrong[qNo] = {answer: item.answer, picked: choice, time: new Date().toISOString()};
  saveStore(s);
  updateStats();
  render();
}
function next(){
  if(state.index >= state.order.length-1) finish();
  else { state.index++; render(); }
}
function prev(){ if(state.index>0){ state.index--; render(); } }
function showAnswer(){
  const qNo = state.order[state.index];
  const item = QUIZ_DATA[qNo-1];
  $("feedback").className = "feedback bad";
  $("feedback").textContent = `正確答案：${item.answer}`;
}
function finish(){
  if(state.timerId) clearInterval(state.timerId);
  $("quiz").classList.add("hidden"); $("result").classList.remove("hidden");
  const total = state.order.length;
  $("barFill").style.width = "100%";
  $("resultScore").textContent = `${state.correct} / ${total}`;
  $("resultText").textContent = `本次正確率：${total ? Math.round(state.correct/total*100) : 0}%`;
  updateStats();
}
function exportScore(){
  const s = loadStore();
  const wrongNos = Object.keys(s.wrong||{}).sort((a,b)=>a-b);
  const text = [
    "航管697題完整題目版成績",
    `累積作答：${s.total}`,
    `累積答對：${s.correct}`,
    `累積正確率：${s.total?Math.round(s.correct/s.total*100):0}%`,
    `錯題題號：${wrongNos.join(", ") || "無"}`
  ].join("\n");
  const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download="航管刷題成績.txt"; a.click();
  URL.revokeObjectURL(url);
}
document.querySelectorAll(".mode").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("startBtn").addEventListener("click",startQuiz);
$("nextBtn").addEventListener("click",next);
$("prevBtn").addEventListener("click",prev);
$("showBtn").addEventListener("click",showAnswer);
$("backHomeBtn").addEventListener("click",()=>{ $("result").classList.add("hidden"); $("setup").classList.remove("hidden"); $("timer").textContent="--:--"; });
$("reviewWrongBtn").addEventListener("click",()=>{ setMode("wrong"); startQuiz(); });
$("exportBtn").addEventListener("click",exportScore);
$("resetAllBtn").addEventListener("click",()=>{ if(confirm("確定清除所有刷題紀錄與錯題本？")){ localStorage.removeItem(STORAGE); updateStats(); }});
updateStats();
