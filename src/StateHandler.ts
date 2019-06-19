/**
 * A handler for a state in the state machine, containing code that should be executed
 * when the state is entered and exited.
 */
export interface StateHandler<TTrigger, TContext> {
  /**
   * Called when a state in the state machine is being entered. The state can perform its work
   * and then issue a trigger that signals the result of the work, for instance success or failure.
   * It's also OK for the state to not fire any trigger, since this can also be performed by
   * the state machine reacting to external events.
   *
   * @param trigger a function that can be used to fire a trigger from the state, e.g. when
   * the state has finished its work and the state machine should transition to the next state
   * @param context the state machine context that is used to share data between states. One
   * instance of the context exists for each state machine.
   */
  entering(trigger: (trigger: TTrigger) => Promise<void>, context: TContext): Promise<void>;

  /**
   * Called when the state is exited because the state machine is transitioning to a new state.
   * Code in this method can be used to clean up resources that were allocated when entering
   * the state etc.
   */
  exiting(): Promise<void>;
}