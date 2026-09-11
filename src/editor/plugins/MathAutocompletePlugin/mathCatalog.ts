export interface MathItem {
  label: string;
  insert: string;
}

export interface MathCategory {
  name: string;
  items: MathItem[];
  isDynamic?: boolean;
}

export const MATH_CATEGORIES: MathCategory[] = [
  { name: "variables", items: [], isDynamic: true },
  {
    name: "trigonometry",
    items: [
      { label: "sin", insert: "sin()" },
      { label: "cos", insert: "cos()" },
      { label: "tan", insert: "tan()" },
      { label: "asin", insert: "asin()" },
      { label: "acos", insert: "acos()" },
      { label: "atan", insert: "atan()" },
      { label: "atan2", insert: "atan2()" },
      { label: "sinh", insert: "sinh()" },
      { label: "cosh", insert: "cosh()" },
      { label: "tanh", insert: "tanh()" },
    ],
  },
  {
    name: "arithmetic",
    items: [
      { label: "+", insert: "+" },
      { label: "-", insert: "-" },
      { label: "×", insert: "*" },
      { label: "÷", insert: "/" },
      { label: "^", insert: "^" },
      { label: "²", insert: "^2" },
      { label: "³", insert: "^3" },
      { label: "√", insert: "sqrt()" },
      { label: "sqrt", insert: "sqrt()" },
      { label: "abs", insert: "abs()" },
      { label: "mod", insert: "mod" },
      { label: "pow", insert: "pow()" },
      { label: "exp", insert: "exp()" },
      { label: "ceil", insert: "ceil()" },
      { label: "floor", insert: "floor()" },
      { label: "round", insert: "round()" },
      { label: "sign", insert: "sign()" },
    ],
  },
  {
    name: "logarithms",
    items: [
      { label: "log", insert: "log()" },
      { label: "log₂", insert: "log(, 2)" },
      { label: "log₁₀", insert: "log(, 10)" },
    ],
  },
  {
    name: "constants",
    items: [
      { label: "π", insert: "pi" },
      { label: "e", insert: "e" },
      { label: "∞", insert: "Infinity" },
      { label: "i", insert: "i" },
      { label: "phi", insert: "phi" },
    ],
  },
  {
    name: "statistics",
    items: [
      { label: "mean", insert: "mean()" },
      { label: "median", insert: "median()" },
      { label: "std", insert: "std()" },
      { label: "variance", insert: "variance()" },
      { label: "min", insert: "min()" },
      { label: "max", insert: "max()" },
      { label: "sum", insert: "sum()" },
      { label: "prod", insert: "prod()" },
    ],
  },
  {
    name: "algebra",
    items: [
      { label: "derivative", insert: "derivative()" },
      { label: "simplify", insert: "simplify()" },
      { label: "factorial", insert: "factorial()" },
      { label: "gamma", insert: "gamma()" },
      { label: "gcd", insert: "gcd()" },
      { label: "lcm", insert: "lcm()" },
      { label: "fraction", insert: "fraction()" },
      { label: "format", insert: "format()" },
    ],
  },
  {
    name: "matrices",
    items: [
      { label: "det", insert: "det()" },
      { label: "inv", insert: "inv()" },
      { label: "transpose", insert: "transpose()" },
      { label: "dot", insert: "dot()" },
      { label: "cross", insert: "cross()" },
      { label: "eigs", insert: "eigs()" },
      { label: "size", insert: "size()" },
    ],
  },
  {
    name: "comparisons",
    items: [
      { label: "=", insert: "=" },
      { label: "≠", insert: "!=" },
      { label: "<", insert: "<" },
      { label: ">", insert: ">" },
      { label: "≤", insert: "<=" },
      { label: "≥", insert: ">=" },
      { label: "and", insert: "and" },
      { label: "or", insert: "or" },
      { label: "not", insert: "not " },
      { label: "xor", insert: "xor" },
    ],
  },
  {
    name: "random",
    items: [
      { label: "random", insert: "random()" },
      { label: "randomInt", insert: "randomInt()" },
      { label: "pickRandom", insert: "pickRandom()" },
    ],
  },
  {
    name: "geometry",
    items: [
      { label: "distance", insert: "distance()" },
      { label: "intersect", insert: "intersect()" },
    ],
  },
];
