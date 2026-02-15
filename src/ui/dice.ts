export type DiceRollRequest = {
  count: number;
  sides: number;
  modifier?: number;
  label?: string;
};

export type DiceRollResult = {
  rolls: number[];
  subtotal: number;
  modifier: number;
  total: number;
  notation: string;
  label?: string;
  providerId: string;
  at: string;
};

export type DiceRollProvider = {
  id: string;
  name: string;
  is3d: boolean;
  roll: (request: DiceRollRequest) => Promise<DiceRollResult>;
};

type DiceAnimationAdapter = (
  request: DiceRollRequest,
  plannedRolls: number[],
  notation: string
) => Promise<void>;

const notationFor = (request: DiceRollRequest) => {
  const modifier = request.modifier ?? 0;
  const suffix = modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : `${modifier}`;
  return `${request.count}d${request.sides}${suffix}`;
};

const randomInt = (sides: number) => Math.floor(Math.random() * sides) + 1;

const finalize = (
  request: DiceRollRequest,
  providerId: string,
  rolls: number[]
): DiceRollResult => {
  const modifier = request.modifier ?? 0;
  const subtotal = rolls.reduce((sum, value) => sum + value, 0);
  return {
    rolls,
    subtotal,
    modifier,
    total: subtotal + modifier,
    notation: notationFor(request),
    label: request.label,
    providerId,
    at: new Date().toISOString(),
  };
};

export const createMathRollProvider = (id = "math-random"): DiceRollProvider => ({
  id,
  name: "Math Random",
  is3d: false,
  roll: async (request) => {
    const rolls = Array.from({ length: Math.max(1, request.count) }, () => randomInt(request.sides));
    return finalize(request, id, rolls);
  },
});

export const createAnimated3dProvider = (
  animate: DiceAnimationAdapter,
  id = "css-3d"
): DiceRollProvider => ({
  id,
  name: "CSS 3D",
  is3d: true,
  roll: async (request) => {
    const rolls = Array.from({ length: Math.max(1, request.count) }, () => randomInt(request.sides));
    await animate(request, rolls, notationFor(request));
    return finalize(request, id, rolls);
  },
});

export class ModularDiceRoller {
  private providers = new Map<string, DiceRollProvider>();
  private activeProviderId = "";

  register(provider: DiceRollProvider) {
    this.providers.set(provider.id, provider);
    if (!this.activeProviderId) this.activeProviderId = provider.id;
  }

  use(providerId: string) {
    if (!this.providers.has(providerId)) return false;
    this.activeProviderId = providerId;
    return true;
  }

  activeProvider(): DiceRollProvider | null {
    return this.providers.get(this.activeProviderId) ?? null;
  }

  async roll(request: DiceRollRequest): Promise<DiceRollResult> {
    const provider = this.activeProvider();
    if (!provider) throw new Error("No dice provider configured");
    return provider.roll(request);
  }
}
