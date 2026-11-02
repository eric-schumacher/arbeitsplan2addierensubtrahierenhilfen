/* Vollständige Lösungswege ausschließlich im letzten Unterknopf. */
(function(root){
  'use strict';
  const fmt=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
  const numberText=n=>n<0?'−'+fmt(-n):fmt(n);
  const copy=v=>JSON.parse(JSON.stringify(v));
  const plus=(a,b)=>a+b;
  function tokenize(expression){
    return expression.match(/\d+|[()+−]/g).map((t,i)=>({text:/^\d+$/.test(t)?Number(t):t,start:i,span:1}));
  }
  function reduceOnce(cells){
    const stack=[];let group=null;
    for(let i=0;i<cells.length;i++){
      if(cells[i].text==='(')stack.push(i);
      if(cells[i].text===')'){group=[stack.pop(),i];break;}
    }
    let first,last,a,b,op,wholeGroup=false;
    if(group){
      const [l,r]=group;
      if(r-l===2){first=l;last=r;a=cells[l+1].text;op=null;wholeGroup=true;}
      else{wholeGroup=r-l===4;first=wholeGroup?l:l+1;last=wholeGroup?r:l+3;a=cells[l+1].text;op=cells[l+2].text;b=cells[l+3].text;}
    }else{
      if(cells.length===1)return null;
      first=0;last=2;a=cells[0].text;op=cells[1].text;b=cells[2].text;
    }
    if(typeof a!=='number'||(op&&typeof b!=='number'))throw Error('Unvollständiger Rechenschritt');
    const value=op==='+'?a+b:op==='−'?a-b:a;
    const replacement={text:value,start:cells[first].start,span:cells.slice(first,last+1).reduce((s,c)=>s+c.span,0),changed:true};
    const next=[...cells.slice(0,first),replacement,...cells.slice(last+1)].map(c=>({...c,changed:c===replacement}));
    return {cells:next,value,operation:op?`${numberText(a)} ${op} ${numberText(b)} = ${numberText(value)}`:`Klammerwert ${numberText(a)}`,wholeGroup};
  }
  function expressionSteps(expression){
    let cells=tokenize(expression);const original=copy(cells),states=[copy(cells)],frames=[];
    const widths=[2,...original.map(c=>Math.max(String(c.text).length+1,2))];
    const layout=rows=>({kind:'brackets',caption:'Eine Rechnung pro Zeile · Ergebnis genau darunter einsetzen',widths,rows:rows.map((r,i)=>({cells:[{text:i?'=':'',span:1},...copy(r)]}))});
    frames.push({text:'Notiere den Rechenausdruck. Klammern werden von innen nach außen berechnet; sonst gilt links nach rechts.',layout:layout(states)});
    while(cells.length>1){
      const before=copy(cells),change=reduceOnce(cells);cells=change.cells;states.push(copy(cells));
      frames.push({text:change.operation+'. '+(change.wholeGroup?'Ersetze diese Klammer durch ihren Wert.':'Ersetze nur den berechneten Teil durch sein Zwischenergebnis.')+' Übernimm alles andere unverändert in die nächste Zeile.',layout:layout([before,cells])});
      if(frames.length>50)throw Error('Rechenweg zu lang');
    }
    return {frames,value:cells[0].text,layout:layout(states)};
  }
  function columnSteps(expression,subtract){
    const numbers=expression.match(/\d+/g).map(Number),texts=numbers.map(String),digits=Math.max(...texts.map(s=>s.length)),length=digits+(subtract?0:1);
    const upper=Array.from({length},(_,i)=>Math.floor(numbers[0]/10**i)%10),revised=[...upper],result=Array(length).fill(null),carries=Array(length).fill('');
    const names=['Einer','Zehner','Hunderter','Tausender','Zehntausender','Hunderttausender','Millionen'];
    const layout=complete=>{
      const rowCells=vals=>[{text:'',span:1},...[...vals].reverse().map(text=>({text:String(text??'□'),span:1}))];
      const rows=[{role:'places',cells:rowCells(Array.from({length},(_,i)=>['E','Z','H','T','ZT','HT','M'][i]))}];
      const changed=upper.map((v,i)=>v!==revised[i]);
      if(subtract&&changed.some(Boolean))rows.push({role:'unbundled',cells:rowCells(revised.map((v,i)=>changed[i]?v:''))});
      numbers.forEach((n,k)=>{const row=rowCells(Array.from({length},(_,i)=>i<texts[k].length?Math.floor(n/10**i)%10:''));row[0].text=k===0?'':subtract?'−':k===numbers.length-1?'+':'';
        if(k===0)row.forEach((c,i)=>{if(i>0&&changed[length-i])c.crossed=true;});rows.push({cells:row});});
      if(!subtract)rows.push({role:'carry',cells:rowCells(carries)});
      const shown=[...result];if(!subtract&&shown[digits]===null)shown[digits]='';
      if(complete){let i=shown.length-1;while(i>0&&(shown[i]===0||shown[i]===''))shown[i--]='';}
      rows.push({role:'result',cells:rowCells(shown)});
      return {kind:subtract?'subtract':'add',caption:subtract?'Entbündeln · neue Werte stehen über den gestrichenen Ziffern':'Schriftlich addieren · Überträge stehen über dem Ergebnisstrich',widths:Array(length+1).fill(3.5),rows};
    };
    const frames=[{text:'Schreibe '+expression+' stellengerecht untereinander. Beginne bei den Einern.',layout:layout(false)}];let carry=0;
    for(let i=0;i<digits;i++){
      if(subtract){
        const y=Math.floor(numbers[1]/10**i)%10;
        if(revised[i]<y){let donor=i+1;while(revised[donor]===0)donor++;if(donor>=length)throw Error('Entbündeln nicht möglich');
          revised[donor]--;for(let k=donor-1;k>i;k--)revised[k]=9;revised[i]+=10;
          frames.push({text:`${names[i]}: Die obere Stelle reicht nicht. Entbündele bei den ${names[donor]}n eine Einheit${donor>i+1?' und gib sie über die Nullen weiter':''}. Die neuen Werte stehen oben.`,layout:layout(false)});
        }
        result[i]=revised[i]-y;
        frames.push({text:`${names[i]}: ${revised[i]} − ${y} = ${result[i]}. Schreibe ${result[i]} in diese Ergebnisspalte.`,layout:layout(i===digits-1)});
      }else{
        const terms=numbers.map(n=>Math.floor(n/10**i)%10),incoming=carry,sum=terms.reduce(plus,incoming);result[i]=sum%10;carry=Math.floor(sum/10);if(carry)carries[i+1]=String(carry);
        frames.push({text:`${names[i]}: ${[...terms,...(incoming?[incoming]:[])].join(' + ')} = ${sum}. Schreibe ${result[i]} unter den Strich.${carry?` Notiere den Übertrag ${carry} in der nächsten Spalte links.`:''}`,layout:layout(i===digits-1&&!carry)});
      }
    }
    if(!subtract&&carry){result[digits]=carry;frames.push({text:`Links ist noch der Übertrag ${carry} übrig. Schreibe ihn in die nächste Ergebnisspalte.`,layout:layout(true)});}
    const value=subtract?numbers[0]-numbers[1]:numbers.reduce(plus,0);
    return {frames,value,layout:layout(true)};
  }
  function mentalSteps(expression){
    const [aText,op,bText]=expression.split(' '),a=Number(aText),b=Number(bText);
    const pieces=String(b).split('').map((digit,i)=>Number(digit)*10**(String(b).length-1-i)).filter(Boolean);
    const expanded=[a,...pieces.flatMap(n=>[op,n])].join(' '),trace=expressionSteps(expanded);
    trace.frames[0].text=pieces.length>1?`Die Rechnung lautet ${expression}. Zerlege ${b} in ${pieces.join(' + ')}. ${op==='−'?'Ziehe alle Teile nacheinander ab.':'Addiere die Teile nacheinander.'}`:`Die Rechnung lautet ${expression}. Rechne diesen Schritt aus.`;
    return trace;
  }
  const yearValues={2008:682514,2009:665126,2010:677947,2011:662685,2012:673544};
  const football=[[19673,15260,20056,17123],[18624,17720,21047,15975]];
  function yearPair(part){if(part.label==='a)')return [2011,2012];if(part.label==='b)')return [2008,2009];const m=part.label.match(/(\d{4}) → (\d{4})/);return m?[+m[1],+m[2]]:null;}
  function bracketChoices(expression){
    const terms=expression.match(/\d+|[+−]/g),choices=[];
    for(let start=0;start<terms.length;start+=2)for(let end=start+2;end<terms.length;end+=2){const tokens=[...terms];tokens[end]+=')';tokens[start]='('+tokens[start];const grouped=tokens.join(' '),trace=expressionSteps(grouped);choices.push({expression:grouped,...trace});}
    return choices;
  }
  function networkSteps(part){
    const grid=copy(part.network),isA=grid[0][0]==='100';
    const filled=isA?[[100,75,65],[75,60,20],[40,15,1]]:[[500,300,100],[200,50,25],[100,40,5]];
    const frames=[{text:'Beginne mit den gegebenen Kästchen und folge jeweils einem bekannten Pfeil.',network:copy(grid)}];
    const numberOrder=[[0,1,0,0],[0,2,0,1],[1,0,0,0],[1,1,1,0],[1,2,isA?1:0,isA?1:2],[2,0,1,0],[2,1,1,1]];
    for(const [r,c,sr,sc]of numberOrder){if(grid[r*2][c*2]!=='□')continue;const start=filled[sr][sc],target=filled[r][c],diff=start-target;grid[r*2][c*2]=String(target);frames.push({text:`Folge dem Pfeil: ${start} − ${diff} = ${target}. Trage ${target} in das nächste Kästchen ein.`,network:copy(grid)});}
    for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(grid[r][c].includes('□')){
      if(r%2===0&&c%2===1){const a=filled[r/2][(c-1)/2],b=filled[r/2][(c+1)/2];grid[r][c]='−'+(a-b)+' →';frames.push({text:`Fehlender Pfeil nach rechts: Start ${a} − Ziel ${b} = ${a-b}. Beschrifte ihn mit −${a-b}.`,network:copy(grid)});}
      else if(r%2===1&&c%2===0){const a=filled[(r-1)/2][c/2],b=filled[(r+1)/2][c/2];grid[r][c]='↓ −'+(a-b);frames.push({text:`Fehlender Pfeil nach unten: Start ${a} − Ziel ${b} = ${a-b}. Beschrifte ihn mit −${a-b}.`,network:copy(grid)});}
      else throw Error('Ungefülltes Kästchen');
    }
    frames.push({text:'Endlösung: Alle fehlenden Kästchen und Pfeilzahlen sind ergänzt. Jeder Pfeil führt mit der angegebenen Subtraktion zum nächsten Kästchen.',network:copy(grid),final:true});return frames;
  }
  function create(task,part){
    const frames=[],kind=part.kind||task.kind,expression=part.calculation||part.expression;
    const finish=(trace,text)=>{frames.push(...trace.frames);frames.push({text:text||`Endlösung: ${expression} = ${numberText(trace.value)}.`,layout:trace.layout,final:true,value:trace.value});return frames;};
    if(kind==='network')return networkSteps(part);
    if(kind==='word'){
      frames.push({text:'Lies die Frage: '+part.expression+' Bestimme zuerst, was gesucht ist.'});
      if(part.calculation){
        const nums=part.calculation.match(/\d+/g).map(Number);frames.push({text:'Du brauchst die Angaben '+nums.map(fmt).join(' und ')+'. '+(part.calculation.includes('−')?'Gesucht ist ein Unterschied; deshalb wird subtrahiert.':'Die Angaben werden zu einer gemeinsamen Summe zusammengefasst; deshalb wird addiert.')});
        const subtract=part.calculation.includes('−'),trace=task.kind==='mental'?mentalSteps(part.calculation):columnSteps(part.calculation,subtract);
        const years=yearPair(part);
        const answer=task.title.includes('Geburten')&&years?`Endlösung: Von ${years[0]} nach ${years[1]} beträgt die ${yearValues[years[1]]>yearValues[years[0]]?'Zunahme':'Abnahme'} ${fmt(trace.value)} Geburten.`:task.title.includes('Zuschauer')?`Endlösung: Am ${part.label.includes('1. Spieltag')?'1.':'2.'} Spieltag kamen insgesamt ${fmt(trace.value)} Zuschauer.`:`Endlösung: ${part.calculation} = ${fmt(trace.value)}.`;
        return finish(trace,answer);
      }
      if(part.unit){
        const rounded=part.numbers.map(n=>Math.floor((n+part.unit/2)/part.unit)*part.unit),place=part.unit===10000?'Zehntausender':'Tausender';
        frames.push({text:'Nimm die vier Werte aus derselben Spieltagsspalte: '+part.numbers.map(fmt).join(', ')+'. Runde jeden einzeln auf '+place+'.'});
        part.numbers.forEach((n,i)=>{const deciding=Math.floor(n/(part.unit/10))%10;frames.push({text:`${fmt(n)}: Die entscheidende Ziffer ist ${deciding}. Runde ${deciding>=5?'auf':'ab'}: ${fmt(n)} ≈ ${fmt(rounded[i])}.`});});
        return finish(expressionSteps(rounded.join(' + ')),`Endlösung: Der Überschlag für den ${part.label.includes('1. Spieltag')?'1.':'2.'} Spieltag auf ${place} beträgt ${fmt(rounded.reduce(plus,0))} Zuschauer.`);
      }
      if(part.numbers){
        const years=yearPair(part),[a,b]=part.numbers,x=String(a),y=String(b);let i=0;while(x[i]===y[i])i++;
        frames.push({text:`Frühere Angabe (${years[0]}): ${fmt(a)}. Spätere Angabe (${years[1]}): ${fmt(b)}.`});
        frames.push({text:`Vergleiche von links nach rechts. An der ersten unterschiedlichen Stelle steht früher ${x[i]}, später ${y[i]}. Daher gilt: ${fmt(b)} ${b>a?'>':'<'} ${fmt(a)}.`});
        frames.push({text:`Endlösung: Von ${years[0]} nach ${years[1]} hat die Geburtenzahl ${b>a?'zugenommen':'abgenommen'}.`,final:true,value:b>a?'Zunahme':'Abnahme'});return frames;
      }
      if(task.title.includes('Geburten')){
        const changes=Object.keys(yearValues).slice(1).map(y=>({from:Number(y)-1,to:Number(y),delta:yearValues[y]-yearValues[Number(y)-1]}));
        for(const c of changes)frames.push({text:`${c.from} → ${c.to}: ${fmt(yearValues[c.to])} ${c.delta>0?'>':'<'} ${fmt(yearValues[c.from])}; ${c.delta>0?'Anstieg':'Abnahme'} um ${fmt(Math.abs(c.delta))}.`});
        frames.push({text:'Vergleiche die Anstiege: 12 821 > 10 859. Vergleiche getrennt die Abnahmen: 17 388 > 15 262.'});
        frames.push({text:'Endlösung: Der größte Anstieg war von 2009 nach 2010 (12 821 Geburten). Die größte Abnahme war von 2008 nach 2009 (17 388 Geburten).',final:true});return frames;
      }
      const exact=football.map(nums=>nums.reduce(plus,0));
      frames.push({text:'Auf Zehntausender gerundet ergeben beide Spieltage 80 000. Dieser Überschlag unterscheidet die Spieltage noch nicht.'});
      frames.push({text:'Auf Tausender gerundet ergeben sich 72 000 und 74 000. Dieser Überschlag spricht für den zweiten Spieltag.'});
      frames.push({text:`Die genauen Summen sind: 1. Spieltag ${fmt(exact[0])}, 2. Spieltag ${fmt(exact[1])}. Da ${fmt(exact[1])} > ${fmt(exact[0])}, kamen am zweiten Spieltag mehr Zuschauer.`});
      return finish(columnSteps(`${exact[1]} − ${exact[0]}`,true),`Endlösung: Am zweiten Spieltag kamen ${fmt(exact[1]-exact[0])} Zuschauer mehr. Der Tausenderüberschlag zeigt dieselbe Tendenz; der Zehntausenderüberschlag erlaubt noch keinen Unterschied.`);
    }
    if(kind==='mental'){
      frames.push({text:part.expression.includes('□')?`Die Lücke in ${part.expression} bestimmst du mit der Rechnung ${part.calculation}.`:`Berechne ${expression} im Kopf.`});
      return finish(mentalSteps(expression),`Endlösung: ${part.expression.includes('□')?'Die fehlende Zahl ist ':expression+' = '}${fmt(mentalSteps(expression).value)}.`);
    }
    if(kind==='add'||kind==='subtract')return finish(columnSteps(expression,kind==='subtract'));
    if(kind==='placement'){
      const [left,right]=part.expression.split(' = '),target=Number(right),choices=bracketChoices(left).filter(c=>c.value===target),chosen=choices.at(-1);if(!chosen)throw Error('Keine passende Klammer');
      frames.push({text:`Die Zielzahl ist ${target}. Eine passende Klammerstellung ist ${chosen.expression}. Berechne nun zuerst die Klammer.`});
      return finish(chosen,`Endlösung: ${chosen.expression} = ${target}. Die Klammerstellung erfüllt die vorgegebene Rechnung.`);
    }
    if(kind==='freebrackets'){
      const base=part.grouped.replace(/[()]/g,''),choices=bracketChoices(base),distinct=[...new Map(choices.map(c=>[c.value,c])).values()].sort((a,b)=>a.value-b.value);
      const selected=part.label==='a)'?[choices.find(c=>c.expression==='150 − (50 + 35) − 25 + 12 − 5'),choices.find(c=>c.expression==='150 − (50 + 35 − 25) + 12 − 5'),choices.find(c=>c.expression==='150 − 50 + (35 − 25) + 12 − 5')]:distinct;
      selected.forEach((c,i)=>{frames.push({text:`${i+1}. Klammerstellung: ${c.expression}.`});frames.push(...c.frames.slice(1));frames.push({text:`Dieser Versuch ergibt ${fmt(c.value)}.`});});
      frames.push({text:part.label==='a)'?'Endlösung – drei verschiedene Klammerstellungen: '+selected.map(c=>`${c.expression} = ${c.value}`).join('; ')+'.':`Endlösung: Mit einer Klammer sind ${distinct.length} verschiedene Werte möglich: ${distinct.map(c=>c.value).join(', ')}. Die gezeigten Klammerstellungen liefern alle diese Werte.`,final:true,values:selected.map(c=>c.value)});return frames;
    }
    const expr=part.grouped||part.notationExpression||part.expression;
    if(kind==='laws')frames.push({text:'Ordne die Summanden günstig und fasse sie zusammen: '+expr+'. Jede ursprüngliche Zahl kommt genau einmal vor.'});
    if(kind==='signed')frames.push({text:'Plusglieder und abzuziehende Glieder werden getrennt zusammengefasst: '+expr+'. Zwischen den beiden Gruppen steht Minus.'});
    return finish(expressionSteps(expr),`Endlösung: ${part.expression} = ${fmt(expressionSteps(expr).value)}.`);
  }
  function appendLayout(host,layout){
    const wrap=document.createElement('div');wrap.className='notation-scroll';const table=document.createElement('table');table.className='task-notation notation-'+layout.kind;table.style.width=layout.widths.reduce(plus,0)+'ch';
    const caption=document.createElement('caption');caption.textContent=layout.caption;const cols=document.createElement('colgroup');
    layout.widths.forEach(width=>{const col=document.createElement('col');col.style.width=width+'ch';cols.append(col);});const body=document.createElement('tbody');
    layout.rows.forEach(row=>{const tr=document.createElement('tr');if(row.role)tr.className='notation-'+row.role;row.cells.forEach(item=>{const cell=document.createElement(row.role==='places'?'th':'td');cell.colSpan=item.span||1;if(row.role==='places')cell.scope='col';if(item.changed)cell.className='notation-replaced';if(item.crossed){const s=document.createElement('s');s.textContent=item.text;cell.append(s);}else cell.textContent=typeof item.text==='number'?numberText(item.text):item.text;tr.append(cell);});body.append(tr);});
    table.append(caption,cols,body);wrap.append(table);host.append(wrap);
  }
  function appendNetwork(host,grid){const wrap=document.createElement('div');wrap.className='notation-scroll';const table=document.createElement('table');table.className='network-grid';grid.forEach((row,r)=>{const tr=document.createElement('tr');row.forEach((text,c)=>{const td=document.createElement('td');td.textContent=text;if(r%2===0&&c%2===0)td.className='network-number';tr.append(td);});table.append(tr);});wrap.append(table);host.append(wrap);}
  function render(container,task,part){
    const frames=create(task,part);container.replaceChildren();const intro=document.createElement('p');intro.textContent='Gehe einen Rechenschritt nach dem anderen durch. Jeder neue Schritt bleibt stehen. Am Ende erscheint die vollständige Endlösung.';
    const history=document.createElement('div');history.setAttribute('aria-live','polite');const next=document.createElement('button');next.type='button';next.className='answer-button next-hint';let index=0;
    function advance(){if(index>=frames.length)return;const frame=frames[index++],section=document.createElement('section');section.className=frame.final?'dialog-step dialog-finished':'dialog-step';
      const progress=document.createElement('div');progress.className='dialog-progress';progress.textContent=`Schritt ${index} von ${frames.length}`;const text=document.createElement('p');text.textContent=frame.text;section.append(progress,text);
      if(frame.layout)appendLayout(section,frame.layout);if(frame.network)appendNetwork(section,frame.network);history.append(section);
      next.textContent=index===frames.length-1?'Endlösung anzeigen':'Nächster Schritt';next.hidden=index===frames.length;
    }
    next.addEventListener('click',()=>{advance();history.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'});});container.append(intro,history,next);advance();
  }
  const api={create,render,expressionSteps,columnSteps,mentalSteps,bracketChoices,reduceOnce};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.solutionWalkthrough=api;
})(typeof window!=='undefined'?window:globalThis);
