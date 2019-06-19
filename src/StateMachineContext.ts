/**
 * Interface for the state machine context. It contains a field with the current state
 * of the state machine, which can be used to resume a state machine, e.g. load its
 * previous context into a new instance that starts in the same state as the previous
 * state machine instance.
 *
 * Since the states in a state machine are oblivious of eachother, the state machine
 * context is the natural place for them to share information.
 */
export interface StateMachineContext<TState> {
  state: TState;
}