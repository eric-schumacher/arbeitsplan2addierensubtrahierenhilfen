/* Einheitliche Schreibweise: feste Stellenspalten und unveränderte Rechenzeilen. */
(function(root){
  "use strict";
  function valueOf(text){
    const nums=text.match(/\d+/g).map(Number),ops=text.match(/[+−]/g)||[];
    return ops.reduce((v,op,i)=>op==='+'?v+nums[i+1]:v-nums[i+1],nums[0]);
  }
  function expressionModel(expression,mode,count=1){
    const tokens=expression.match(/\d+|[()+−]/g),stack=[],groups=[];
    tokens.forEach((t,i)=>{if(t==='(')stack.push(i);if(t===')')groups.push({start:stack.pop(),end:i});});
    if(stack.length)throw Error('Offene Klammer');
    if(!groups.length&&tokens.length>=3)groups.push({start:0,end:2});
    let cells=tokens.map((text,i)=>({text,start:i,span:1}));
    const rows=[{cells:[{text:'',span:1},...cells]}];
    const limit=mode==='original'||mode==='setup'?0:Math.min(mode==='partial'?1:Math.max(1,count),groups.length);
    for(let j=0;j<limit;j++){
      const g=groups[j],inside=tokens.slice(g.start,g.end+1).filter(t=>t!=='('&&t!==')').join(' ');
      const text=mode==='partial'?String(valueOf(inside)):'□';
      cells=cells.filter(c=>c.start<g.start||c.start>g.end);
      cells.push({text,start:g.start,span:g.end-g.start+1,changed:true});cells.sort((a,b)=>a.start-b.start);
      // Highlight only the replacement made on the current line.
      cells=cells.map(c=>({...c,changed:c.start===g.start&&c.span===g.end-g.start+1}));
      rows.push({cells:[{text:'=',span:1},...cells]});
    }
    return {kind:'brackets',caption:'Ergebnis genau darunter · alles andere unverändert übernehmen',widths:[2,...tokens.map(t=>Math.max(t.length+1,2))],rows,tokens};
  }
  function columnModel(expression,kind,mode,column=0){
    const numbers=expression.match(/\d+/g).map(Number),texts=numbers.map(String),subtract=kind==='subtract';
    const digits=Math.max(...texts.map(s=>s.length)),length=digits+(subtract?0:1);
    const top=Array.from({length},(_,i)=>Math.floor(numbers[0]/10**i)%10),revised=[...top],carryRow=Array(length).fill('');
    const result=Array.from({length},(_,i)=>i<digits?'□':'');
    const last=Math.min(column,digits-1);
    if(mode!=='setup'){
      let carry=0;
      for(let i=0;i<=last;i++){
        if(subtract){
          const y=Math.floor(numbers[1]/10**i)%10;
          if(revised[i]<y){let donor=i+1;while(donor<length&&revised[donor]===0)donor++;
            if(donor>=length)throw Error('Entbündeln nicht möglich');revised[donor]--;
            for(let k=donor-1;k>i;k--)revised[k]=9;revised[i]+=10;}
        }else{
          const sum=numbers.reduce((s,n)=>s+Math.floor(n/10**i)%10,carry);carry=Math.floor(sum/10);
          if(carry)carryRow[i+1]=i<last||mode==='partial'?String(carry):'□';
        }
      }
      if(mode==='partial')result[0]=String(subtract?revised[0]-numbers[1]%10:numbers.reduce((s,n)=>s+n%10,0)%10);
    }
    const change=top.map((v,i)=>revised[i]!==v);
    const cells=values=>[{text:'',span:1},...[...values].reverse().map(text=>({text:String(text),span:1}))];
    const names=['E','Z','H','T','ZT','HT','M'];
    const rows=[{role:'places',cells:cells(Array.from({length},(_,i)=>names[i]))}];
    if(subtract&&change.some(Boolean))rows.push({role:'unbundled',cells:cells(revised.map((v,i)=>change[i]?v:''))});
    numbers.forEach((number,n)=>{
      const values=Array.from({length},(_,i)=>i<texts[n].length?Math.floor(number/10**i)%10:'');
      const row=cells(values);row[0].text=n===0?'':subtract?'−':n===numbers.length-1?'+':'';
      if(n===0)row.forEach((c,i)=>{if(i>0&&change[length-i])c.crossed=true;});
      rows.push({cells:row});
    });
    if(!subtract)rows.push({role:'carry',cells:cells(carryRow)});
    rows.push({role:'result',cells:cells(result)});
    return {kind,caption:subtract?'Stellengerecht · neue Werte beim Entbündeln direkt über die gestrichenen Ziffern':'Stellengerecht · Überträge unmittelbar über dem Ergebnisstrich',widths:Array(length+1).fill(3.5),rows,original:numbers[0],revised,numbers};
  }
  function model(task,part,mode,stepIndex=1){
    const kind=part.kind||task.kind;
    if(kind==='add'||kind==='subtract')return columnModel(part.calculation||part.expression,kind,mode,Math.max(0,stepIndex-1));
    if(mode==='setup'&&['laws','signed'].includes(kind))return expressionModel(part.expression,'original');
    if(mode==='setup'&&kind==='freebrackets')return expressionModel(part.grouped.replace(/[()]/g,''),'original');
    if(['brackets','laws','signed','freebrackets'].includes(kind))return expressionModel(part.notationExpression||part.grouped||part.expression,mode,Math.max(1,stepIndex));
    if(kind==='placement')return expressionModel(mode==='partial'?part.trial:part.expression.split('=')[0],mode==='partial'?'partial':'original');
    return null;
  }
  function append(host,task,part,mode,stepIndex){
    const layout=model(task,part,mode,stepIndex);if(!layout)return;
    const wrap=document.createElement('div');wrap.className='notation-scroll';
    const table=document.createElement('table');table.className='task-notation notation-'+layout.kind;table.style.width=layout.widths.reduce((a,b)=>a+b,0)+'ch';
    const caption=document.createElement('caption');caption.textContent=layout.caption;
    const cols=document.createElement('colgroup');layout.widths.forEach(width=>{const col=document.createElement('col');col.style.width=width+'ch';cols.append(col);});
    const body=document.createElement('tbody');
    layout.rows.forEach(row=>{const tr=document.createElement('tr');if(row.role)tr.className='notation-'+row.role;
      row.cells.forEach(item=>{const cell=document.createElement(row.role==='places'?'th':'td');cell.colSpan=item.span;
        if(row.role==='places')cell.scope='col';if(item.changed)cell.className='notation-replaced';
        if(item.crossed){const s=document.createElement('s');s.textContent=item.text;cell.append(s);}else cell.textContent=item.text;
        tr.append(cell);});body.append(tr);});
    table.append(caption,cols,body);wrap.append(table);host.append(wrap);
  }
  const api={model,append,valueOf,expressionModel,columnModel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.taskNotation=api;
})(typeof window!=='undefined'?window:globalThis);
