type Walker = {
  x: () => number;
  y: () => number;
  velocityX: () => number;
  goTo: (x: number, y: number, arrive: (() => void) | null) => void;
  steer: (x: number, y: number) => void;
  place: (x: number, y: number) => void;
  stop: () => void;
  update: (delta: number) => void;
  moving: () => boolean;
};

type Clamp = (x: number, y: number) => [number, number];

const arriveDistance: number = 5; // units
const brakeDistance: number = 90; // units
const acceleration: number = 9; // per s
const restSpeed: number = 8; // units/s
const progressStep: number = 2; // units
const stuckTime: number = 0.5; // s

function createWalker(speed: number, clamp: Clamp): Walker {
  let x: number = 0;
  let y: number = 0;
  let velocityX: number = 0;
  let velocityY: number = 0;
  let goalX: number | null = null;
  let goalY: number = 0;
  let steerX: number = 0;
  let steerY: number = 0;
  let arrive: (() => void) | null = null;
  let closest: number = Infinity;
  let stuck: number = 0;

  function goTo(
    targetX: number,
    targetY: number,
    done: (() => void) | null,
  ): void {
    const [clampedX, clampedY] = clamp(targetX, targetY);

    goalX = clampedX;
    goalY = clampedY;
    arrive = done;
    closest = Infinity;
    stuck = 0;
  }

  function stop(): void {
    goalX = null;
    arrive = null;
  }

  function update(delta: number): void {
    let wantX: number = 0;
    let wantY: number = 0;

    if (steerX !== 0 || steerY !== 0) {
      wantX = steerX * speed;
      wantY = steerY * speed;
    } else if (goalX !== null) {
      const awayX: number = goalX - x;
      const awayY: number = goalY - y;
      const distance: number = Math.hypot(awayX, awayY);

      if (distance < closest - progressStep) {
        closest = distance;
        stuck = 0;
      } else {
        stuck += delta;
      }

      if (distance < arriveDistance || stuck > stuckTime) {
        const done: (() => void) | null = arrive;

        goalX = null;
        arrive = null;
        done?.();
      } else {
        const pace: number = speed * Math.min(distance / brakeDistance, 1);

        wantX = (awayX / distance) * pace;
        wantY = (awayY / distance) * pace;
      }
    }

    const blend: number = Math.min(acceleration * delta, 1);

    velocityX += (wantX - velocityX) * blend;
    velocityY += (wantY - velocityY) * blend;

    const [nextX, nextY] = clamp(x + velocityX * delta, y + velocityY * delta);

    x = nextX;
    y = nextY;
    steerX = 0;
    steerY = 0;
  }

  return {
    x: () => x,
    y: () => y,
    velocityX: () => velocityX,
    goTo: goTo,
    steer: (directionX: number, directionY: number) => {
      steerX = directionX;
      steerY = directionY;

      if (directionX !== 0 || directionY !== 0) {
        stop();
      }
    },
    place: (placeX: number, placeY: number) => {
      [x, y] = clamp(placeX, placeY);
      velocityX = 0;
      velocityY = 0;
      stop();
    },
    stop: stop,
    update: update,
    moving: () =>
      goalX !== null || Math.hypot(velocityX, velocityY) > restSpeed,
  };
}

export { createWalker };
export type { Walker, Clamp };
