import type { Behavior, Snapshot, Stimulus, Vec3 } from '../types';
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));
export class BehaviorController {
  behavior: Behavior = 'resting';
  position: Vec3 = [0, -.16, .5];
  target: Vec3 = [0, -.16, .5];
  heading = -.2;
  bank = 0;
  flight = 0;
  feeding = 0;
  stateAge = 0;
  private escapeCooldown = 0;
  private lastCause: string | null = null;
  private lureHeading = -.18;
  private lure: Vec3 = [-1.6, -.8, 1];
  update(snapshot: Snapshot, event?: Stimulus, dt = .05) {
    const m = snapshot.motor;
    this.stateAge += dt; this.escapeCooldown = Math.max(0, this.escapeCooldown - dt);
    const motor = (m.left + m.right) * .5;
    if (snapshot.causeId !== this.lastCause && motor > .014 && event && snapshot.trace?.id === event.id && snapshot.trace.motorAt !== null) { this.lastCause = snapshot.causeId; if (event.position) { this.lure = [...event.position]; this.lureHeading = Math.atan2(this.lure[2] - .5, -this.lure[0]); } }
    let next = this.behavior;
    if (m.threat > .08 && motor > .025 && snapshot.trace?.motorAt != null && this.escapeCooldown === 0) { next = 'startled'; this.escapeCooldown = 5.5; }
    else if (this.behavior === 'startled') { if (this.stateAge > 1.45) next = 'recovering'; }
    else if (this.behavior === 'recovering') { if (this.stateAge > 2.8 && m.threat < .045) next = 'resting'; }
    else if (m.attraction > .025 && motor > .016 && m.threat < Math.max(.04, m.attraction * .75)) {
      if (this.behavior === 'approaching' && this.stateAge > 1.2) next = 'feeding';
      else if (this.behavior !== 'feeding') next = 'approaching';
    } else if ((this.behavior === 'feeding' || this.behavior === 'approaching') && this.stateAge < 2.7) { /* complete the movement with hysteresis */ }
    else if (m.arousal > .055 && motor > .018) next = 'hovering';
    else if (snapshot.modules[0] + snapshot.modules[1] > .045) next = 'sensing';
    else if (this.stateAge > 1.5) next = 'resting';
    if (next !== this.behavior) { this.behavior = next; this.stateAge = 0; }
    const b = this.behavior;
    const threatSide = this.lure[0] < 0 ? 1 : -1;
    if (b === 'startled') this.target = [threatSide * 1.45, .3, .3];
    else if (b === 'approaching' || b === 'feeding') {
      const pitch=this.feeding*.13;
      const reach=.55+1.53*Math.cos(pitch)-.6*Math.sin(pitch);
      const tipHeight=.16-1.53*Math.sin(pitch)-.6*Math.cos(pitch);
      this.target = [Math.max(-1.4, Math.min(1.4, this.lure[0] + Math.cos(this.lureHeading) * reach)), this.lure[1]-tipHeight, Math.max(-.3, Math.min(1.1, this.lure[2] - Math.sin(this.lureHeading) * reach))];
    }
    else if (b === 'hovering') this.target = [Math.sin(snapshot.time * .45) * .6, -.02, .45];
    else this.target = [0, -.16, .5];
    const speed = b === 'startled' ? 4.5 : b === 'approaching' ? 1.05 : .8;
    const vx = this.target[0] - this.position[0];
    for (let i = 0; i < 3; i++) this.position[i] = damp(this.position[i], this.target[i], speed, dt);
    const airborne = ['startled','approaching','hovering'].includes(b);
    this.flight = damp(this.flight, airborne ? 1 : 0, 4, dt);
    this.feeding = damp(this.feeding, b === 'feeding' ? 1 : 0, 3, dt);
    const desiredHeading = b === 'approaching' || b === 'feeding' ? this.lureHeading : -.18 + Math.max(-.35, Math.min(.35, (m.right - m.left) * 3 + vx * .16));
    this.heading = damp(this.heading, desiredHeading, 2.4, dt);
    this.bank = damp(this.bank, airborne ? -vx * .11 : 0, 3, dt);
  }
}
