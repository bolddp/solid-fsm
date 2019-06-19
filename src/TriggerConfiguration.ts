import { StateConfiguration } from "./StateConfiguration";
import { StateMachineContext } from "./StateMachineContext";

/**
 * Configuration for a trigger / target state combination that belongs to a {@link StateConfiguration}.
 * The configuration can optionally also have a guard that can be used to control the flow of the
 * state machine depending on data in the state machine context.
 *
 * When a trigger is fired in the state machine, it examines the current state to look for matching
 * triggers and thereby determining the state that it should transition to.
 */
export class TriggerConfiguration<TState, TTrigger, TContext extends StateMachineContext<TState>> {
  stateConfiguration: StateConfiguration<TState, TTrigger, TContext>;
  targetStateConfiguration: StateConfiguration<TState, TTrigger, TContext>;
  guard?: (context: TContext) => boolean;
  func: (context: TContext) => Promise<void>;

  constructor(stateConfiguration: StateConfiguration<TState, TTrigger, TContext>,
    guard?: (context: TContext) => boolean) {
    this.stateConfiguration = stateConfiguration;
    this.guard = guard;
  }

  /**
   * Part of the fluent API to link a configured trigger to a target state.
   * @param state the state that this trigger configuration should use as target
   */
  goesTo(state: TState): StateConfiguration<TState, TTrigger, TContext> {
    if (this.func) {
      throw new Error('A trigger cannot have both a target state and code that should be executed');
    }
    this.targetStateConfiguration = this.stateConfiguration.stateMachine.state(state);
    return this.stateConfiguration;
  }

  /**
   * Part of the fluent API to link a configured trigger to execute a function. The state machine will
   * remain in its current state.
   * @param func the function that should be executed when a trigger is fired on the current configured state
   */
  execute(func: (context: TContext) => Promise<void>): StateConfiguration<TState, TTrigger, TContext> {
    if (this.targetStateConfiguration) {
      throw new Error('A trigger cannot have both a target state and code that should be executed');
    }
    this.func = func;
    return this.stateConfiguration;
  }
}