export const LANES = [-1, 0, 1];
export const LANE_WIDTH = 2.35;
export const CONTACT_Z = 3.6;

export class Runner {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset(level = 1, bank = 0) {
    this.level = level; this.bank = bank;
    this.phase = 'ready'; this.distance = 0; this.time = 0; this.speed = (9 + (level - 1) * 2) * 1.12;
    this.lane = 0; this.lanePosition = 0; this.jumpY = 0; this.jumpV = 0;
    this.duckTime = 0; this.duckHeld = false; this.invincible = 0;
    this.hearts = 3; this.points = 0; this.combo = 0; this.bestCombo = 0;
    this.items = []; this.events = [];
    this.nextZ = 38; this.group = 0; this.serial = 0; this.safeLane = 0;
    this.words = ['慈','悲','怒','急','怎','意','感','息','想','忍','忘']; this.announced = new Set(); this.retry = []; this.lastKind = ''; this.collected = []; this.fillTrack();
  }
  item(kind, lane, z, extra = {}) {
    const item = {id: ++this.serial, kind, lane, z, resolved: false, hit: false, ...extra};
    this.items.push(item); return item;
  }
  fillTrack() {
    while (this.group < this.words.length && this.nextZ < this.distance + 110) {
      const i=this.group++;
      const patterns=[['animal','bat','animal','boulder','animal','bat','boulder','animal','bat','animal','boulder'],['bat','animal','boulder','animal','bat','animal','boulder','bat','animal','boulder','animal'],['boulder','animal','bat','animal','boulder','bat','animal','boulder','animal','bat','animal']];
      const routes=[[-1,0,1,0,-1,0,1,0,-1,0,1],[1,0,-1,0,1,0,-1,0,1,0,-1],[0,-1,0,1,0,-1,0,1,0,-1,0]];
      const kind=patterns[this.level-1][i],lane=routes[this.level-1][i];
      if(kind==='animal'){
        const species=['rabbit','dog','squirrel','cat','hedgehog'];
        const animalIndex=patterns[this.level-1].slice(0,i).filter(x=>x==='animal').length;
        this.item(kind,null,this.nextZ,{lanes:LANES.filter(x=>x!==lane),safeLane:lane,species:[species[(animalIndex+this.level)%5],species[(animalIndex+this.level)%5]]});
      }else this.item(kind,null,this.nextZ,{drift:kind==='bat'?4:kind==='boulder'?3:0});
      this.item('orb',lane,this.nextZ+18,{value:this.words[i]});
      const gap=[34,28,25][this.level-1];
      this.nextZ+=gap;
      if(([ [2,5,8], [1,3,5,7,9], [0,1,3,4,6,7,9] ][this.level-1]).includes(i)){
        const extra=(i+this.level)%2?'bat':'boulder';
        this.item(extra,null,this.nextZ,{drift:extra==='bat'?4:3});
        this.nextZ+=gap;
      }
    }
    if(this.group===this.words.length && !this.items.some(x=>x.kind==='orb'&&!x.resolved) && this.collected.length<this.words.length){
      for(const word of this.words.filter(x=>!this.collected.includes(x))){
        this.item('orb',[-1,0,1][Math.floor(this.random()*3)],Math.max(this.nextZ,this.distance+45),{value:word});this.nextZ=Math.max(this.nextZ,this.distance+45)+34;
      }
    }
  }
  nextLevel() {
    if (this.phase !== 'stageclear' || this.level >= 3) return false;
    this.reset(this.level + 1, this.score); return true;
  }
  impactTime(item) {
    return (item.z - this.distance - CONTACT_Z) / (this.speed + (item.drift || 0));
  }
  move(direction) {
    if (this.phase !== 'running' || ![-1, 1].includes(direction)) return false;
    const next = Math.max(-1, Math.min(1, this.lane + direction));
    if (next === this.lane) return false;
    this.lane = next; this.events.push({type: 'move', direction}); return true;
  }
  jump() {
    if (this.phase !== 'running' || this.jumpY > .02) return false;
    this.duckTime = 0; this.duckHeld = false; this.jumpV = 7.2; this.jumpY = .025;
    this.events.push({type: 'jump'}); return true;
  }
  duck(held = false) {
    if (this.phase !== 'running') return false;
    this.duckHeld = held; this.duckTime = 1.25;
    if (this.jumpY > 0) this.jumpV = Math.min(this.jumpV, -7);
    this.events.push({type: 'duck'}); return true;
  }
  releaseDuck() { this.duckHeld = false; }
  releaseEvents() { return this.events.splice(0); }
  update(dt) {
    if (this.phase !== 'running') return;
    dt = Math.min(.04, Math.max(0, dt));
    this.time += dt; this.speed = (9 + (this.level - 1) * 2 + Math.min(1.6, this.distance / 280)) * 1.12;
    const nearest = this.nearest();
    const previousZ = new Map(this.items.map(item => [item.id, item.z]));
    const before = this.distance;
    this.distance += this.speed * dt;
    for(const item of this.items){if(!item.resolved&&item.drift&&item.z-this.distance<40)item.z-=item.drift*dt;}
    this.lanePosition += (this.lane - this.lanePosition) * (1 - Math.exp(-15 * dt));
    this.invincible = Math.max(0, this.invincible - dt);
    this.duckTime = this.duckHeld ? Math.max(this.duckTime, .12) : Math.max(0, this.duckTime - dt);
    if (this.jumpY > 0 || this.jumpV > 0) {
      this.jumpV -= 14 * dt; this.jumpY += this.jumpV * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.jumpV = 0; }
    }
    for (const item of this.items) {
      if (item.resolved) continue;
      if (previousZ.get(item.id) - before > CONTACT_Z && item.z - this.distance <= CONTACT_Z) {
        item.resolved = true;
        const sameLane = item.lane === null || Math.abs(this.lanePosition - item.lane) < .58;
        if (item.kind === 'orb') {
          if(sameLane){
            item.hit=true;
            if(!this.collected.includes(item.value))this.collected.push(item.value);
            this.points+=40;this.events.push({type:'orb',value:item.value,id:item.id});
            if(this.collected.length===this.words.length){this.phase=this.level<3?'stageclear':'won';this.events.push({type:this.phase});break;}
          }else this.events.push({type:'miss',value:item.value});
          continue;
        }
        let collision = false;
        if (item.kind === 'log' || item.kind === 'boulder') collision = this.jumpY < .64;
        if (item.kind === 'beam' || item.kind === 'bat') collision = this.duckTime <= 0 || this.jumpY > .2;
        if (item.kind === 'wall') collision = item.lanes.some(x => Math.abs(this.lanePosition - x) < .65);
        if (item.kind === 'animal') collision = item.lanes.some(x=>Math.abs(this.lanePosition-x)<.65);
        if (collision && this.invincible <= 0) {
          this.hearts--; this.combo = 0; this.invincible = 1.45;
          this.events.push({type: 'damage', kind: item.kind});
          if (this.hearts <= 0) { this.phase = 'over'; this.events.push({type: 'over'}); break; }
        } else if (!collision) {
          this.points += 20; this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
          this.events.push({type: 'clear', kind: item.kind});
        }
      }
    }
    this.items = this.items.filter(x => x.z > this.distance - 8); this.fillTrack();
  }
  nearest() { return this.items.filter(x => x.kind !== 'orb' && !x.resolved && x.z - this.distance > CONTACT_Z).sort((a,b) => a.z - b.z)[0]; }
  get score() { return this.bank + Math.floor(this.distance) + this.points; }
  snapshot() { return {phase: this.phase, level: this.level, distance: Math.floor(this.distance), score: this.score, hearts: this.hearts, lane: this.lane, jumping: this.jumpY > .1, crouching: this.duckTime > 0, combo: this.combo, collected: [...this.collected], nextNote: this.words.find(x=>!this.collected.includes(x)) || null}; }
}
