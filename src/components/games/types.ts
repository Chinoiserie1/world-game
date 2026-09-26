export interface BoardProps<V> {
  readonly view: V;
  readonly finished: boolean;
  readonly busy: boolean;
  readonly onMove: (move: Record<string, unknown>) => void;
}
