import type { DoreumiExpression } from "./assets";

/**
 * 슬라이드 속 도름이의 행동과 몸의 움직임. 화면(DOM)과 three.js 를 모르는 순수한 상태 기계다.
 *
 * 좌표는 슬라이드 본문(.canvas) 왼쪽 위를 원점으로 한 무대 px 이고, (x, y) 는 발 가운데다.
 * y 는 아래로 커진다. 발판은 본문 맨 아래(바닥)와 내용 상자들의 윗변이다.
 */

export type Platform = { key: string; left: number; right: number; top: number; floor: boolean };
export type World = { width: number; height: number; platforms: Platform[] };
export type Body = { height: number; halfWidth: number };
export type Expression = DoreumiExpression;
export type Pose = {
  x: number;
  y: number;
  action: string;
  /** 같은 동작을 처음부터 다시 틀어야 할 때마다 1씩 오른다 */
  restart: number;
  timeScale: number;
  expression: Expression;
  facing: -1 | 0 | 1;
  /** 그림자가 떨어질 면의 높이. 없으면 그림자를 숨긴다. */
  surface: number | null;
  grounded: boolean;
};

type State =
  | { kind: "idle"; until: number }
  | { kind: "act"; until: number }
  | { kind: "walk"; target: number; speed: number; offEdge: boolean }
  | { kind: "crouch"; until: number; hop: Hop }
  | { kind: "hop"; hop: Hop; t: number }
  | { kind: "fall" }
  | { kind: "land"; until: number }
  | { kind: "held"; since: number }
  | { kind: "drag"; since: number };

type Hop = { x0: number; y0: number; x1: number; y1: number; apex: number; t1: number; dur: number; target: string };

const GRAVITY = 2400;
const EDGE = 6;
const EMOTES: [string, Expression][] = [
  ["Wave", "smile"],
  ["HeadTilt", "neutral"],
  ["Joy", "laugh"],
  ["Cheer", "cheering"],
  ["Stretch", "proud"],
  ["Bow", "smile"],
];
const DANCE_FACES: Expression[] = ["laugh", "sparkly", "love"];

export class DoreumiBrain {
  x = 0;
  y = 0;
  private vx = 0;
  private vy = 0;
  private support: string | null = null;
  private state: State = { kind: "idle", until: 0 };
  private clock = 0;
  private action = "Idle";
  private expression: Expression = "smile";
  private restart = 0;
  private timeScale = 1;
  private facing: -1 | 0 | 1 = 0;
  private grab = { dx: 0, dy: 0 };
  private dragTarget = { x: 0, y: 0 };
  private lastDance = -Infinity;
  private started = false;
  /** 놓은 순간의 손가락 자리. 화면이 느려 마지막 끌기가 아직 반영되지 않았어도 거기서 떨어진다. */
  private releasedAt: { x: number; y: number } | null = null;

  constructor(
    private readonly clip: { duration: (action: string) => number; has: (action: string) => boolean; dances: readonly string[] },
    private readonly random: () => number = Math.random,
  ) {}

  /** 처음 자리: 바닥 오른쪽. 나타나면 손을 흔든다. */
  spawn(world: World, body: Body) {
    const floor = floorOf(world);
    this.x = clamp(world.width - body.halfWidth - 70, minX(body), maxX(world, body));
    this.y = floor.top;
    this.support = floor.key;
    this.started = false;
  }

  /** 정지 그림으로 바꿀 때 공중에 있지 않게 발밑 면에 내려놓는다. */
  settle(world: World, body: Body) {
    this.x = clamp(this.x, minX(body), maxX(world, body));
    const below = surfaceBelow(world, this.x, Math.min(this.y, world.height) - 1, body);
    this.y = below.top;
    this.support = below.key;
    this.vx = this.vy = 0;
    this.enter({ kind: "idle", until: this.clock + 1 }, "Idle", "smile");
  }

  press(x: number, y: number) {
    if (this.state.kind === "drag") return;
    this.grab = { dx: this.x - x, dy: this.y - y };
    this.dragTarget = { x: this.x, y: this.y };
    // 눌린 동안에는 제자리에 멈춘다. 걷던 중이면 다리도 멈춘다.
    const still = this.action === "Walk" || this.action === "Run" ? "Idle" : this.action;
    this.enter({ kind: "held", since: this.clock }, this.grounded() ? still : "Falling", "surprise");
  }

  /** 눌린 채 6px 넘게 움직이면 들어 올린다 */
  lift() {
    this.support = null;
    this.vx = this.vy = 0;
    this.enter({ kind: "drag", since: this.clock }, "Dragged", "surprise");
  }

  dragTo(x: number, y: number) {
    this.dragTarget = { x: x + this.grab.dx, y: y + this.grab.dy };
  }

  /** 놓으면 그대로 아래로 떨어진다 */
  drop() {
    if (this.state.kind !== "drag") return;
    this.releasedAt = { ...this.dragTarget };
    this.vx = 0;
    this.vy = 0;
    this.enter({ kind: "fall" }, "Falling", "surprise");
  }

  /** 누르고 바로 떼면(또는 Enter·Space) 제자리에서 뛴다 */
  poke() {
    if (this.support === null) {
      // 공중에서 눌렸다 놓이면 그냥 떨어진다.
      if (this.state.kind === "held") this.startFall(0);
      return;
    }
    if (!this.grounded()) return;
    const action = this.clip.has("Jump") ? "Jump" : "Joy";
    this.restart++;
    this.facing = 0;
    this.enter({ kind: "act", until: this.clock + Math.max(1.2, this.clip.duration(action) - 0.2) }, action, "laugh");
  }

  /** 누름이 취소되면(창 밖 등) 하던 일로 돌아간다 */
  cancel() {
    if (this.state.kind === "drag") this.drop();
    else if (this.state.kind === "held" && this.support === null) this.startFall(0);
    else if (this.state.kind === "held") this.enter({ kind: "idle", until: this.clock + 0.6 }, "Idle", "smile");
  }

  isDragging() {
    return this.state.kind === "drag";
  }

  update(dt: number, world: World, body: Body): Pose {
    this.clock += dt;
    if (!this.started) {
      this.started = true;
      this.enter({ kind: "act", until: this.clock + Math.max(1.5, this.clip.duration("Wave") - 0.3) }, "Wave", "smile");
    }
    const lo = minX(body);
    const hi = maxX(world, body);
    const s = this.state;
    if (this.releasedAt) {
      this.x = clamp(this.releasedAt.x, lo, hi);
      this.y = clamp(this.releasedAt.y, body.height, floorOf(world).top);
      this.releasedAt = null;
    }

    if (s.kind === "drag") {
      // 손가락을 바로 따라오되 본문 밖으로는 못 나간다.
      this.x = clamp(this.dragTarget.x, lo, hi);
      this.y = clamp(this.dragTarget.y, body.height, floorOf(world).top);
      if (this.clock - s.since > 0.7) this.expression = "laugh";
    } else if (s.kind === "fall") {
      this.fall(dt, world, body, lo, hi);
    } else if (s.kind === "hop") {
      this.hop(dt, s, world, body);
    } else if (s.kind !== "held") {
      // 서 있는 동안에는 발판을 따라간다(글이 늘거나 줄면 발판도 움직인다).
      const here = world.platforms.find((p) => p.key === this.support) ?? (this.support === "floor" ? floorOf(world) : undefined);
      if (!here || this.x < here.left - EDGE || this.x > here.right + EDGE || Math.abs(here.top - this.y) > 40) {
        this.startFall(0);
      } else {
        this.y = here.top;
        this.x = clamp(this.x, lo, hi);
        this.onGround(dt, s, here, world, body, lo, hi);
      }
    }

    return {
      x: this.x,
      y: this.y,
      action: this.action,
      restart: this.restart,
      timeScale: this.timeScale,
      expression: this.expression,
      facing: this.facing,
      surface: this.grounded() ? this.y : surfaceBelow(world, this.x, this.y, body).top,
      grounded: this.grounded(),
    };
  }

  private grounded() {
    return this.support !== null && ["idle", "act", "walk", "land", "crouch", "held"].includes(this.state.kind);
  }

  private enter(state: State, action: string, expression: Expression, timeScale = 1) {
    this.state = state;
    this.action = action;
    this.expression = expression;
    this.timeScale = timeScale;
    if (state.kind !== "walk" && state.kind !== "hop" && state.kind !== "fall") this.facing = 0;
  }

  private onGround(dt: number, s: State, here: Platform, world: World, body: Body, lo: number, hi: number) {
    if (s.kind === "walk") {
      const dir = Math.sign(s.target - this.x) || 1;
      this.facing = dir as -1 | 1;
      this.x += dir * s.speed * dt;
      const arrived = dir > 0 ? this.x >= s.target : this.x <= s.target;
      if (s.offEdge && (this.x < here.left - 2 || this.x > here.right + 2)) {
        this.startFall(dir * s.speed * 0.8);
        return;
      }
      if (arrived || this.x <= lo || this.x >= hi) {
        this.x = clamp(arrived ? s.target : this.x, lo, hi);
        this.enter({ kind: "idle", until: this.clock + 0.4 + this.random() * 0.8 }, "Idle", "smile");
      }
      return;
    }
    if (s.kind === "crouch") {
      if (this.clock >= s.until) {
        this.support = null;
        this.facing = (Math.sign(s.hop.x1 - s.hop.x0) || 0) as -1 | 0 | 1;
        this.enter({ kind: "hop", hop: s.hop, t: 0 }, "Falling", "laugh");
      }
      return;
    }
    if ((s.kind === "idle" || s.kind === "act" || s.kind === "land") && this.clock >= s.until) {
      if (s.kind === "land") {
        const [action, face] = this.random() < 0.5 ? (["Joy", "laugh"] as const) : (["Cheer", "cheering"] as const);
        this.restart++;
        this.enter({ kind: "act", until: this.clock + Math.max(1.2, this.clip.duration(action) - 0.3) }, action, face);
        return;
      }
      this.decide(here, world, body, lo, hi);
    }
  }

  /** 다음에 무엇을 할지 고른다. 걷기가 가장 잦고 춤·점프·손 인사가 섞인다. */
  private decide(here: Platform, world: World, body: Body, lo: number, hi: number) {
    const hopTargets = world.platforms.filter((p) => p.key !== here.key && Math.min(p.right, hi) - Math.max(p.left, lo) > 24);
    const dances = this.clip.dances.filter((id) => this.clip.has(id));
    const canDance = dances.length > 0 && this.clock - this.lastDance > 10;
    const options: [number, () => void][] = [
      [0.3, () => this.walk(here, lo, hi, 58, false)],
      [0.06, () => this.walk(here, lo, hi, 150, false)],
      [0.14, () => this.enter({ kind: "idle", until: this.clock + 1.2 + this.random() * 2 }, "Idle", this.random() < 0.5 ? "smile" : "neutral")],
      [canDance ? 0.2 : 0, () => this.dance(dances)],
      [0.14, () => this.emote()],
      [hopTargets.length ? 0.16 : 0.04, () => this.hopTo(hopTargets.length ? hopTargets : [here], here, lo, hi, body)],
      [here.floor ? 0 : 0.05, () => this.walk(here, lo, hi, 70, true)],
    ];
    let pick = this.random() * options.reduce((sum, [weight]) => sum + weight, 0);
    for (const [weight, run] of options) {
      if ((pick -= weight) <= 0 && weight > 0) return run();
    }
    options[0][1]();
  }

  private walk(here: Platform, lo: number, hi: number, speed: number, offEdge: boolean) {
    const left = Math.max(here.left + EDGE, lo);
    const right = Math.min(here.right - EDGE, hi);
    let target: number;
    if (offEdge) {
      // 가장자리 너머로 걸어 나가 떨어진다. 본문 밖으로는 안 간다.
      const toLeft = here.left - 30 > lo && (here.right + 30 > hi || this.random() < 0.5);
      target = toLeft ? here.left - 30 : here.right + 30;
      if (target < lo || target > hi) return this.enter({ kind: "idle", until: this.clock + 1 }, "Idle", "smile");
    } else {
      if (right - left < 40) return this.enter({ kind: "idle", until: this.clock + 1.5 }, "Idle", "smile");
      target = left + this.random() * (right - left);
      if (Math.abs(target - this.x) < 50) target = clamp(this.x + (this.x - left > right - this.x ? -1 : 1) * (80 + this.random() * 120), left, right);
    }
    const run = speed > 100;
    this.enter({ kind: "walk", target, speed, offEdge }, run ? "Run" : "Walk", run ? "laugh" : "smile", run ? 1 : 1.25);
  }

  private dance(dances: string[]) {
    const id = dances[Math.floor(this.random() * dances.length)];
    this.lastDance = this.clock;
    this.restart++;
    const length = Math.min(this.clip.duration(id), 9);
    this.enter({ kind: "act", until: this.clock + Math.max(3, length - 0.4) }, id, DANCE_FACES[Math.floor(this.random() * DANCE_FACES.length)]);
  }

  private emote() {
    const [action, face] = EMOTES[Math.floor(this.random() * EMOTES.length)];
    if (!this.clip.has(action)) return this.enter({ kind: "idle", until: this.clock + 1.5 }, "Idle", "smile");
    this.restart++;
    this.enter({ kind: "act", until: this.clock + Math.max(1.2, this.clip.duration(action) - 0.3) }, action, face);
  }

  private hopTo(targets: Platform[], here: Platform, lo: number, hi: number, body: Body) {
    const target = targets[Math.floor(this.random() * targets.length)];
    const left = Math.max(target.left + EDGE, lo);
    const right = Math.min(target.right - EDGE, hi);
    let x1 = left + this.random() * Math.max(0, right - left);
    // 같은 발판 위에서는 옆으로 콩 뛰기
    if (target.key === here.key) x1 = clamp(this.x + (this.random() < 0.5 ? -1 : 1) * (90 + this.random() * 90), left, right);
    const y1 = target.top;
    const apex = Math.min(this.y, y1) - 45 - Math.min(80, Math.abs(x1 - this.x) * 0.12);
    // 머리가 본문 위로 나가지 않을 만큼만 높이 뛴다
    const top = Math.max(apex, body.height * 0.95);
    const t1 = Math.sqrt((2 * Math.max(1, this.y - top)) / GRAVITY);
    const t2 = Math.sqrt((2 * Math.max(1, y1 - top)) / GRAVITY);
    const hop: Hop = { x0: this.x, y0: this.y, x1, y1, apex: top, t1, dur: t1 + t2, target: target.key };
    this.restart++;
    this.enter({ kind: "crouch", until: this.clock + 0.2, hop }, "Landing", "sparkly");
  }

  private hop(dt: number, s: Extract<State, { kind: "hop" }>, world: World, body: Body) {
    s.t = Math.min(s.hop.dur, s.t + dt);
    const { x0, y0, x1, apex, t1, dur } = s.hop;
    const u = s.t / dur;
    this.x = x0 + (x1 - x0) * u;
    this.y = s.t < t1 ? y0 - (y0 - apex) * (1 - ((t1 - s.t) / t1) ** 2) : apex + 0.5 * GRAVITY * (s.t - t1) ** 2;
    if (s.t >= dur) {
      const target = world.platforms.find((p) => p.key === s.hop.target) ?? (s.hop.target === "floor" ? floorOf(world) : undefined);
      if (target && this.x >= target.left - EDGE && this.x <= target.right + EDGE) {
        this.y = target.top;
        this.land(target.key);
      } else {
        this.vx = 0;
        this.vy = GRAVITY * (dur - t1);
        this.enter({ kind: "fall" }, "Falling", "surprise");
        this.fall(0, world, body, minX(body), maxX(world, body));
      }
    }
  }

  private startFall(vx: number) {
    this.support = null;
    this.vx = vx;
    this.vy = 0;
    this.enter({ kind: "fall" }, "Falling", "surprise");
  }

  private fall(dt: number, world: World, body: Body, lo: number, hi: number) {
    const before = this.y;
    this.vy = Math.min(this.vy + GRAVITY * dt, 1800);
    this.vx *= Math.exp(-dt * 1.5);
    this.x = clamp(this.x + this.vx * dt, lo, hi);
    if (this.x <= lo || this.x >= hi) this.vx = 0;
    this.facing = Math.abs(this.vx) > 20 ? ((Math.sign(this.vx) as -1 | 1)) : 0;
    const next = this.y + this.vy * dt;
    const hit = [...world.platforms, floorOf(world)]
      .filter((p) => p.top >= before - 0.5 && p.top <= next && this.x >= p.left && this.x <= p.right && p.top >= body.height * 0.8)
      .sort((a, b) => a.top - b.top)[0];
    if (hit) {
      this.y = hit.top;
      this.land(hit.key);
    } else {
      this.y = next;
    }
  }

  private land(key: string) {
    this.support = key;
    this.vx = this.vy = 0;
    this.restart++;
    this.enter({ kind: "land", until: this.clock + Math.max(0.45, this.clip.duration("Landing") - 0.1) }, "Landing", "surprise");
  }
}

function clamp(value: number, lo: number, hi: number) {
  return hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, value));
}

function minX(body: Body) {
  return body.halfWidth + 4;
}

function maxX(world: World, body: Body) {
  return world.width - body.halfWidth - 4;
}

/** 본문 맨 아래. 발끝 그림자가 테두리에 닿지 않게 4px 띄운다. */
export function floorOf(world: World): Platform {
  return { key: "floor", left: 0, right: world.width, top: world.height - 4, floor: true };
}

function surfaceBelow(world: World, x: number, y: number, body: Body): Platform {
  return (
    world.platforms
      .filter((p) => p.top >= y - 0.5 && x >= p.left && x <= p.right && p.top >= body.height * 0.8)
      .sort((a, b) => a.top - b.top)[0] ?? floorOf(world)
  );
}
