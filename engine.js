/* Pure finite-domain puzzle engine. No DOM, network, or persistence. */
(function (root) {
  'use strict';
  const N = 6, cells = Array.from({length: 36}, (_, i) => i);
  const row = x => Math.floor(x / N), col = x => x % N;
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function shuffle(a, random) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function partition(random) {
    const rects = [[0, 0, 6, 6]], target = 4 + Math.floor(random() * 5);
    while (rects.length < target) {
      const options = rects.map((q, i) => ({q, i})).filter(({q}) => q[2] * q[3] > 2);
      const {q, i} = options[Math.floor(random() * options.length)];
      const [r, c, h, w] = q;
      const vertical = w > 1 && (h === 1 || random() < .5);
      const cut = 1 + Math.floor(random() * ((vertical ? w : h) - 1));
      rects.splice(i, 1, vertical ? [r,c,h,cut] : [r,c,cut,w], vertical ? [r,c+cut,h,w-cut] : [r+cut,c,h-cut,w]);
    }
    const rooms = Array(36);
    shuffle(rects, random).forEach(([r,c,h,w], id) => { for(let y=r;y<r+h;y++) for(let x=c;x<c+w;x++) rooms[y*6+x]=id; });
    return rooms;
  }
  function nearRoom(cell, room, rooms, diagonal) {
    return cells.some(x => rooms[x] === room && (diagonal ? Math.abs(row(x)-row(cell)) === 1 && Math.abs(col(x)-col(cell)) === 1 : Math.abs(row(x)-row(cell))+Math.abs(col(x)-col(cell)) === 1));
  }
  function unary(clue, cell, rooms) {
    if (clue.type === 'room') return rooms[cell] === clue.room;
    if (clue.type === 'beside' || clue.type === 'touch') return nearRoom(cell, clue.room, rooms, clue.type === 'touch');
    return true;
  }
  function direction(a, b, axis) { return axis === 'north' ? row(a) < row(b) : col(a) < col(b); }
  function clueTrue(clue, positions, rooms) {
    if (clue.type === 'direction') return direction(positions[clue.a], positions[clue.b], clue.axis);
    if (clue.type === 'count') return new Set(rooms).size - new Set(positions.map(x => rooms[x])).size === clue.count;
    return unary(clue, positions[clue.a], rooms);
  }
  function valid(positions, rooms, clues = []) {
    return positions.length === 6 && positions.every(x => Number.isInteger(x) && x >= 0 && x < 36) && new Set(positions.map(row)).size === 6 && new Set(positions.map(col)).size === 6 && positions.filter(x => rooms[x] === rooms[positions[0]]).length === 2 && clues.every(c => clueTrue(c, positions, rooms));
  }
  function initialDomains(puzzle) {
    return Array.from({length:6}, (_, a) => cells.filter(x => puzzle.clues.every(c => c.a !== a || c.type === 'direction' || unary(c,x,puzzle.rooms))));
  }
  function compatible(a, x, b, y, clues) {
    if (row(x) === row(y) || col(x) === col(y)) return false;
    return clues.every(c => c.type !== 'direction' || (c.a !== a || c.b !== b || direction(x,y,c.axis)) && (c.a !== b || c.b !== a || direction(y,x,c.axis)));
  }
  // Arc consistency removes unsupported candidates. This loop never guesses or branches.
  function propagate(puzzle) {
    const domains = initialDomains(puzzle), trace = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (let a=0;a<6;a++) for(let b=0;b<6;b++) if(a!==b) {
        const next = domains[a].filter(x => domains[b].some(y => compatible(a,x,b,y,puzzle.clues)));
        if (next.length !== domains[a].length) { trace.push({person:a, support:b, removed:domains[a].length-next.length}); domains[a]=next; changed=true; }
      }
    }
    const solution = domains.map(d => d[0]);
    return {domains, trace, solved:domains.every(d=>d.length===1) && valid(solution,puzzle.rooms,puzzle.clues), solution};
  }
  // Exhaustive assignment search independent of propagation. Stop only after limit solutions.
  function enumerate(puzzle, limit=2) {
    const domains=initialDomains(puzzle), order=[0,1,2,3,4,5].sort((a,b)=>domains[a].length-domains[b].length), positions=Array(6).fill(-1), solutions=[];
    function visit(depth, rows, cols) {
      if(solutions.length>=limit) return;
      if(depth===6) { if(valid(positions,puzzle.rooms,puzzle.clues)) solutions.push([...positions]); return; }
      const a=order[depth];
      for(const x of domains[a]) {
        if(rows & 1<<row(x) || cols & 1<<col(x)) continue;
        if(!positions.every((y,b)=>y<0 || compatible(a,x,b,y,puzzle.clues))) continue;
        positions[a]=x; visit(depth+1,rows|1<<row(x),cols|1<<col(x)); positions[a]=-1;
        if(solutions.length>=limit) return;
      }
    }
    visit(0,0,0); return solutions;
  }
  function verify(puzzle) {
    const deductions=propagate(puzzle), solutions=enumerate(puzzle);
    return {valid:valid(puzzle.solution,puzzle.rooms,puzzle.clues), unique:solutions.length===1 && solutions[0].every((x,i)=>x===puzzle.solution[i]), forward:deductions.solved && deductions.solution.every((x,i)=>x===puzzle.solution[i]), deductions:deductions.trace.length};
  }
  function generate(seed = Date.now() >>> 0, maxAttempts=100) {
    const random=rng(seed);
    for(let attempt=0;attempt<maxAttempts;attempt++) {
      const rooms=partition(random), columns=shuffle([0,1,2,3,4,5],random);
      let solution=columns.map((c,r)=>r*6+c);
      const pairs=solution.filter(x=>solution.filter(y=>rooms[y]===rooms[x]).length===2);
      if(!pairs.length) continue;
      const victim=pairs[Math.floor(random()*pairs.length)];
      solution=[victim,...shuffle(solution.filter(x=>x!==victim),random)];
      const clues=solution.map((x,a)=>({type:'room',a,room:rooms[x]}));
      for(const axis of ['north','west']) {
        const order=[0,1,2,3,4,5].sort((a,b)=>axis==='north'?row(solution[a])-row(solution[b]):col(solution[a])-col(solution[b]));
        for(let i=0;i<5;i++) clues.push({type:'direction',a:order[i],b:order[i+1],axis});
      }
      for(const type of ['beside','touch']) {
        const choices=[];
        for(let a=0;a<6;a++) for(const room of new Set(rooms)) if(room!==rooms[solution[a]] && nearRoom(solution[a],room,rooms,type==='touch')) choices.push({type,a,room});
        if(choices.length) clues.push(choices[Math.floor(random()*choices.length)]);
      }
      clues.push({type:'count',count:new Set(rooms).size-new Set(solution.map(x=>rooms[x])).size});
      const puzzle={seed:seed>>>0,rooms,solution,clues};
      // Keep room and vocabulary clues; remove redundant directional clues only when deduction still finishes.
      for(const clue of shuffle(clues.filter(c=>c.type==='direction'),random)) {
        const index=clues.indexOf(clue); clues.splice(index,1);
        if(!propagate(puzzle).solved) clues.splice(index,0,clue);
      }
      const result=verify(puzzle);
      if(result.valid && result.unique && result.forward && clues.some(c=>c.type==='beside') && clues.some(c=>c.type==='touch')) return {...puzzle,proof:result};
    }
    throw new Error('GENERATION_EXHAUSTED');
  }
  const API={generate,verify,enumerate,propagate,valid,clueTrue,row,col,rng};
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.MurdokuEngine=API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
