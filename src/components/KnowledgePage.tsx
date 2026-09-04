import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KNOWLEDGE, REFERENCES } from '../physics/knowledge';

export function KnowledgePage({ onClose }: { onClose:()=>void }) {
  const [query,setQuery]=useState(''), [hypotheses,setHypotheses]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';closeRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape')onClose();
      if(event.key==='Tab'){
        const controls=root.current?.querySelectorAll<HTMLElement>('button,input,a[href]'); if(!controls?.length)return;
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',onKey);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',onKey);previous?.focus();};
  },[onClose]);
  const filtered=useMemo(()=>KNOWLEDGE.filter(item=>(!hypotheses||item.evidence==='반드시 가설')&&
    [item.terms,item.explanation,item.limits,item.category].join(' ').toLowerCase().includes(query.toLowerCase())),[query,hypotheses]);
  return <div ref={root} role="dialog" aria-modal="true" aria-labelledby="knowledge-title" className="fixed inset-0 z-[100] bg-[#090f1c] text-slate-200 flex flex-col">
    <header className="shrink-0 p-4 border-b border-slate-700 flex justify-between gap-4"><div><h1 id="knowledge-title" className="text-xl font-semibold">시뮬레이션 용어·단위·이론·논문 해설</h1><p className="text-sm text-slate-400 mt-1">관측, 물리 근사, 가설, 표시 기법을 구분합니다. 가설 검증용 항목에는 반드시 ‘반드시 가설’을 표시합니다.</p></div>
      <button ref={closeRef} onClick={onClose} className="shrink-0 border rounded px-3">시뮬레이션으로 돌아가기</button></header>
    <div className="p-4 flex flex-wrap gap-4 shrink-0"><label className="flex-1">용어 검색<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: nT, 외핵, CLOUD, RK4, 가설" className="ml-2 p-2 rounded bg-slate-900 border border-slate-600 w-2/3" /></label>
      <label className="flex items-center gap-2 text-amber-300"><input type="checkbox" checked={hypotheses} onChange={e=>setHypotheses(e.target.checked)} />반드시 가설 항목만</label><span>{filtered.length} / {KNOWLEDGE.length} 항목</span></div>
    <main className="overflow-y-auto flex-1 min-h-0 p-4 space-y-4">
      <p className="p-3 border border-amber-800 text-amber-200 rounded">이 프로그램은 가설 민감도 실험입니다. 자기장·구름 패턴·합성 파열은 실제 지진 예측의 검증 결과가 아닙니다. 외부장 nT에는 보편적인 영향 임계값이 없으며, 극한 모드는 모델 한계를 넘어서는 방향 실험입니다.</p>
      {filtered.length===0&&<p role="status">검색 결과가 없습니다. 다른 용어나 단위를 입력하세요.</p>}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{filtered.map(item=><article key={item.terms} className="rounded border border-slate-700 p-4 space-y-2">
        <p className="text-xs text-slate-400">{item.category} · <span className={item.evidence==='반드시 가설'?'text-amber-300 font-bold':'text-cyan-300'}>{item.evidence}</span></p>
        <h2 className="font-semibold">{item.terms}</h2><p className="text-sm leading-6">{item.explanation}</p><p className="text-sm text-amber-100/80 leading-6">해석 한계: {item.limits}</p>
        {item.sources?.map(id=><a key={id} href={REFERENCES[id].url} target="_blank" rel="noreferrer" className="block text-xs text-cyan-300 underline">{REFERENCES[id].title}</a>)}
      </article>)}</div>
      <section className="border-t border-slate-700 pt-4"><h2 className="text-lg mb-3">프로그램 참고문헌과 적용 범위</h2><p className="mb-3 text-sm text-slate-400">논문 제목·출처를 클릭하면 원문 페이지가 열립니다. 인용은 해당 기초 기작에 한정되며 프로그램의 가설 전체에 대한 지지를 뜻하지 않습니다.</p>
        {Object.entries(REFERENCES).map(([id,reference])=><article key={id} className="mb-4"><a href={reference.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">{reference.title}</a><p className="text-sm text-slate-400 mt-1">{reference.use}</p></article>)}</section>
    </main>
  </div>;
}
