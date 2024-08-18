export type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never

export type InferArray<T extends any[]> = T extends (infer U)[] ? U : never;
