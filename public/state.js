/* Pure local demo state. No network or persistence. 5 fictional members, NGN 5,000 each per week.
   The starting point mirrors the saved Walrus Circle history: week 1 is complete (pot paid to Demo A),
   and in week 2 only Demo A has a recorded contribution so far. Next in the agreed order is Demo B. */
(function(root){
const MEMBERS=['A','B','C','D','E'],PER_MEMBER=5000,LATE_BEFORE=3,WEEK=2; /* Demo D / Emeka: paid week 1 late in the saved fictional history */
const NAMES={A:'Amaka',B:'Tunde',C:'Ngozi',D:'Emeka',E:'Halima'};
const display=code=>NAMES[code]+' (Demo '+code+')';
const initialLetter=code=>NAMES[code].charAt(0);
/* Long form "Amaka (Demo A)" for memory texts; short form "Amaka" for the derived summary (the mapping is shown once on the page). */
const withNames=text=>String(text).replace(/\b(?:Member )?Demo ([A-E])\b/g,(_,c)=>display(c));
const shortNames=text=>String(text).replace(/\b(?:Member )?Demo ([A-E])\b/g,(_,c)=>NAMES[c]);
const initial=()=>[true,false,false,false,false];
const totals=state=>{const count=state.filter(Boolean).length;return{count,members:MEMBERS.length,total:count*PER_MEMBER,goal:MEMBERS.length*PER_MEMBER,percent:Math.round(count/MEMBERS.length*100)};};
const record=(state,index)=>state.map((v,i)=>i===index?true:v);
const list=names=>names.length<2?names.join(''):names.slice(0,-1).join(', ')+' and '+names[names.length-1];
const reminder=state=>{if(!state[LATE_BEFORE])return'Suggested reminder: “'+NAMES[MEMBERS[LATE_BEFORE]]+', your week '+WEEK+' sample contribution is still outstanding.”';const open=MEMBERS.filter((n,i)=>!state[i]).map(c=>NAMES[c]);return open.length?list(open)+(open.length===1?' is':' are')+' still outstanding. No late-history reminder applies.':'Everyone has a sample contribution recorded this week. No reminder needed.';};
const api={MEMBERS,NAMES,PER_MEMBER,LATE_BEFORE,WEEK,display,initialLetter,withNames,shortNames,initial,totals,record,reminder};if(typeof module!=='undefined')module.exports=api;else root.DemoState=api;
})(globalThis);
