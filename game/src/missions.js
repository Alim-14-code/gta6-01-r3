// Port Aurora — the story: six jobs from the fixer Mara Voss, and the engine
// that runs them step by step. One job: what the player must do, and whether
// they did it.
import { LANDMARKS } from './city.js';
import { spawnSportsCar } from './vehicles.js';

// Step types:
//   goto     — reach a marker (radius r)
//   enterCar — get into any car
//   stealCar — steal the gold sports car
//   pickup   — reach a marker (the package is grabbed on arrival)
//   deliver  — reach a marker before the timer runs out
//   loseCops — keep every cop farther than 420px for N seconds
//   hold     — stay inside a marker for N seconds
//   escape   — reach the safehouse
export const MISSIONS = [
  {
    id: 'm1', title: 'First Gear', reward: 500,
    brief: 'Mara Voss: "You owe me, Jace. First job is easy — get wheels, meet me at the docks."',
    steps: [
      { t: 'enterCar', label: 'Steal a car (walk up to one, press E)' },
      { t: 'goto', x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, r: 70, label: 'Drive to The Docks' },
    ],
  },
  {
    id: 'm2', title: 'The Package', reward: 800,
    brief: 'Mara Voss: "A package is waiting at Warehouse 9. Pick it up, run it to the Sunset Motel. Ninety seconds — the buyer does not wait."',
    steps: [
      { t: 'pickup', x: LANDMARKS.warehouse.x, y: LANDMARKS.warehouse.y, r: 60, label: 'Pick up the package at Warehouse 9' },
      { t: 'deliver', x: LANDMARKS.motel.x, y: LANDMARKS.motel.y, r: 70, seconds: 90, label: 'Deliver to the Sunset Motel' },
    ],
  },
  {
    id: 'm3', title: 'Hot Wheels', reward: 1200,
    brief: 'Mara Voss: "A gold Comet GT is parked outside the Marina hospital. Bring it to my garage in Downtown. Try not to scratch it — or get caught."',
    steps: [
      { t: 'stealCar', x: LANDMARKS.hospital.x, y: LANDMARKS.hospital.y, r: 80, label: 'Steal the gold Comet GT at Marina General' },
      { t: 'goto', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, r: 70, label: 'Bring the Comet GT to Voss Garage' },
    ],
  },
  {
    id: 'm4', title: 'Lose the Tail', reward: 1500,
    brief: 'Mara Voss: "The cops made the Comet. You are hot — three stars. Shake them and stay clean for twenty seconds."',
    steps: [
      { t: 'loseCops', seconds: 20, label: 'Lose the police (stay out of sight 20s)' },
    ],
  },
  {
    id: 'm5', title: 'The Exchange', reward: 2500,
    brief: 'Mara Voss: "Meet me at the Old Pier. I ride with you to the exchange — then we both disappear before the cops arrive."',
    steps: [
      { t: 'goto', x: LANDMARKS.pier.x, y: LANDMARKS.pier.y, r: 70, label: 'Pick up Mara at the Old Pier' },
      { t: 'deliver', x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y, r: 70, seconds: 120, label: 'Drive Mara to Founders Plaza' },
    ],
  },
  {
    id: 'm6', title: 'The Big One', reward: 5000,
    brief: 'Mara Voss: "Last job, Jace. Aurora National Bank. Grab the cash, hold on for three seconds, and run for the safehouse. Every cop in the city will be coming."',
    steps: [
      { t: 'goto', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, r: 70, label: 'Reach Aurora National Bank' },
      { t: 'hold', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, r: 80, seconds: 3, label: 'Grab the cash — hold position 3s' },
      { t: 'escape', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, r: 80, label: 'Escape to the Safehouse' },
    ],
  },
];

export function createMissions(G) {
  const M = {
    def: null,
    stepIndex: 0,
    stepT: 0, // progress timer inside the current step
    timer: 0, // countdown for timed steps
    sportsCar: null,
    failed: false,

    current() {
      return this.def ? this.def.steps[this.stepIndex] : null;
    },
    currentLabel() {
      const s = this.current();
      return s ? s.label : '';
    },
    target() {
      const s = this.current();
      if (!s || s.x === undefined) return null;
      return { x: s.x, y: s.y, r: s.r || 60 };
    },

    start(index) {
      this.def = MISSIONS[index];
      this.stepIndex = 0;
      this.stepT = 0;
      this.timer = 0;
      this.failed = false;
      if (!this.def) return;
      G.missionIndex = index;
      G.toast(`${this.def.title} — ${this.def.brief}`, 6);
      G.audio.pickup();
      this.beginStep();
    },

    beginStep() {
      const s = this.current();
      if (!s) { this.complete(); return; }
      this.stepT = 0;
      this.timer = s.seconds || 0;
      if (s.t === 'stealCar') {
        // Park the gold sports car by the hospital if it is not there yet.
        if (!this.sportsCar || this.sportsCar.disabled) {
          this.sportsCar = spawnSportsCar(G, LANDMARKS.hospital.x + 60, LANDMARKS.hospital.y + 40);
        }
      }
      if (s.t === 'loseCops') {
        G.setWanted(3);
        G.toast('WANTED: 3 stars — lose them!', 4);
      }
      if (s.t === 'hold') G.toast('Grab the cash!', 3);
    },

    advance() {
      this.stepIndex++;
      G.audio.pickup();
      if (this.stepIndex >= this.def.steps.length) this.complete();
      else this.beginStep();
    },

    fail(reason) {
      G.audio.missionFail();
      G.toast(`${reason} — job failed. Mara gives you one more shot.`, 5);
      this.start(G.missionIndex);
    },

    complete() {
      const reward = this.def.reward;
      G.cash += reward;
      G.completedMissions.push(this.def.id);
      G.missionIndex++;
      G.audio.missionDone();
      G.toast(`Job done! +$${reward.toLocaleString('en-US')}`, 5);
      G.audio.cash();
      G.save();
      if (G.missionIndex >= MISSIONS.length) {
        G.setState('complete');
        return;
      }
      this.start(G.missionIndex);
    },

    onEnterCar() {
      const s = this.current();
      if (s && s.t === 'enterCar') this.advance();
    },

    update(dt) {
      if (!this.def) return;
      const s = this.current();
      if (!s) return;
      const p = G.player;
      const px = p.car ? p.car.x : p.x;
      const py = p.car ? p.car.y : p.y;
      if (s.t === 'goto' || s.t === 'pickup' || s.t === 'deliver' || s.t === 'escape') {
        if (s.t === 'deliver' || s.t === 'escape') {
          this.timer -= dt;
          if (this.timer <= 0) { this.fail('Too slow'); return; }
        }
        const d = Math.hypot(px - s.x, py - s.y);
        if (d < (s.r || 60)) {
          if (s.t === 'pickup') G.toast('Package secured.', 3);
          if (s.t === 'escape') G.toast('You made it. Clean.', 3);
          this.advance();
        }
      } else if (s.t === 'stealCar') {
        if (p.car && p.car.sports) this.advance();
        else {
          const d = Math.hypot(px - s.x, py - s.y);
          if (d < 260 && (!this.sportsCar || this.sportsCar.kind !== 'parked')) {
            // Player drove off in another car: remind them which one to take.
            G.toastOnce('sports', 'That is not the Comet GT — take the GOLD car.', 5);
          }
        }
      } else if (s.t === 'loseCops') {
        let nearest = Infinity;
        for (const car of G.cars) {
          if (car.kind !== 'police' || car.disabled) continue;
          nearest = Math.min(nearest, Math.hypot(car.x - px, car.y - py));
        }
        let footCop = Infinity;
        for (const ped of G.peds) {
          if (ped.kind !== 'cop' || ped.state === 'down') continue;
          footCop = Math.min(footCop, Math.hypot(ped.x - px, ped.y - py));
        }
        if (Math.min(nearest, footCop) > 420) {
          this.stepT += dt;
          if (this.stepT >= s.seconds) this.advance();
        } else {
          this.stepT = Math.max(0, this.stepT - dt * 2);
        }
      } else if (s.t === 'hold') {
        const d = Math.hypot(px - s.x, py - s.y);
        if (d < (s.r || 80)) {
          this.stepT += dt;
          if (this.stepT >= s.seconds) {
            G.toast('Cash grabbed! RUN!', 3);
            G.setWanted(5);
            this.advance();
          }
        } else {
          this.stepT = 0;
        }
      }
    },
  };
  return M;
}
