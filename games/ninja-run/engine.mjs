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
    this.attackCooldown = 0; this.items = []; this.events = [];
    this.nextZ = 38; this.group = 0; this.serial = 0; this.safeLane = 0;
    this.lastKind = ''; this.collected = []; this.fillTrack();
  }
  item(kind, lane, z, extra = {}) {
    const item = {id: ++this.serial, kind, lane, z, resolved: false, hit: false, ...extra};
    this.items.push(item); return item;
  }
  fillTrack() {
    const sequence = ['log','enemy','beam','wall','enemy','log','beam','enemy','wall','enemy'];
    while (this.group < 10 && this.nextZ < this.distance + 190) {
      const i = this.group++, kind = sequence[i];
      if (kind === 'wall') {
        this.safeLane = i === 3 ? -1 : 1;
        this.item(kind, null, this.nextZ, {lanes: LANES.filter(x => x !== this.safeLane), safeLane: this.safeLane});
      } else if (kind === 'enemy') {
        this.item(kind, 0, this.nextZ, {lanePosition: 0, walking: false, contactTime: 0});
      } else this.item(kind, null, this.nextZ);
      this.item('orb', 0, this.nextZ + 23, {value: (i + 1) * 4});
      const extra = this.level >= 3 && [1,4,7].includes(i) ? 'boulder' : this.level >= 2 && [2,5,8].includes(i) ? 'bat' : null;
      if (extra) this.item(extra, null, this.nextZ + 43, {drift: extra === 'bat' ? 5 : 4});
      this.nextZ += extra ? 66 : 46;
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
  attack(id) {
    if (this.phase !== 'running' || this.attackCooldown > 0) return false;
    const e = this.items.find(x => x.id === id && x.kind === 'enemy' && !x.resolved);
    if (!e || e.z - this.distance < CONTACT_Z || e.z - this.distance > 12) return false;
    e.resolved = true; e.hit = true; this.attackCooldown = .2;
    this.points += 50; this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.events.push({type: 'attack', id, lane: e.lanePosition ?? e.lane, z: e.z}); return true;
  }
  releaseEvents() { return this.events.splice(0); }
  update(dt) {
    if (this.phase !== 'running') return;
    dt = Math.min(.04, Math.max(0, dt));
    this.time += dt; this.speed = (9 + (this.level - 1) * 2 + Math.min(1.6, this.distance / 280)) * 1.12;
    const nearest = this.nearest();
    const enemy = nearest?.kind === 'enemy' && nearest.z - this.distance < 15 ? nearest : null;
    const previousZ = new Map(this.items.map(item => [item.id, item.z]));
    if (!enemy && nearest?.drift && nearest.z - this.distance < 32) nearest.z -= nearest.drift * dt;
    const before = this.distance;
    this.distance += (enemy ? 0 : this.speed) * dt;
    for (const e of this.items) {
      if (e.kind !== 'enemy' || e.resolved || e.id !== nearest?.id || e.z - this.distance > 55) continue;
      e.walking = true;
      e.lanePosition += (this.lanePosition - e.lanePosition) * (1 - Math.exp(-3 * dt));
      e.z = Math.max(this.distance + 6.2, e.z - 3.5 * dt);
      if (e.z - this.distance <= 6.21) {
        e.contactTime += dt;
        if (e.contactTime >= 3) {
          e.resolved = true; e.hit = true; this.hearts--; this.combo = 0;
          this.events.push({type:'damage',kind:'enemy'});
          if (this.hearts <= 0) { this.phase='over'; this.events.push({type:'over'}); return; }
        }
      }
    }
    this.lanePosition += (this.lane - this.lanePosition) * (1 - Math.exp(-15 * dt));
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
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
          item.hit = true; this.collected.push(item.value); this.points += 40;
          this.events.push({type: 'orb', id: item.id, value: item.value});
          if (item.value === 40) { this.phase = this.level < 3 ? 'stageclear' : 'won'; this.events.push({type:this.phase}); break; }
          continue;
        }
        let collision = false;
        if (item.kind === 'log' || item.kind === 'boulder') collision = this.jumpY < .64;
        if (item.kind === 'beam' || item.kind === 'bat') collision = this.duckTime <= 0 || this.jumpY > .2;
        if (item.kind === 'wall') collision = item.lanes.some(x => Math.abs(this.lanePosition - x) < .65);
        if (item.kind === 'enemy') collision = sameLane;
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
  snapshot() { return {phase: this.phase, level: this.level, distance: Math.floor(this.distance), score: this.score, hearts: this.hearts, lane: this.lane, jumping: this.jumpY > .1, crouching: this.duckTime > 0, combo: this.combo, collected: [...this.collected], nextGem: this.collected.length < 10 ? (this.collected.length + 1) * 4 : null}; }
}
