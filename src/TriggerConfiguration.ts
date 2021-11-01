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
  private _stateConfiguration: StateConfiguration<TState, TTrigger, TContext>;
  _targetStateConfiguration?: StateConfiguration<TState, TTrigger, TContext>;
  _guard?: (context: TContext) => boolean;
  _func?: (context: TContext) => Promise<void>;
  _isIgnored: boolean;

  constructor(stateConfiguration: StateConfiguration<TState, TTrigger, TContext>,
    guard?: (context: TContext) => boolean) {
    this._stateConfiguration = stateConfiguration;
    this._guard = guard;
    this._isIgnored = false;
  }

  private throwOnFunc(msg: string) {
    if (this._func) {
      throw new Error(msg);
    }
  }

  private throwOnIgnore(msg: string) {
    if (this._isIgnored) {
      throw new Error(msg);
    }
  }

  private throwOnTarget(msg: string) {
    if (this._targetStateConfiguration) {
      throw new Error(msg);
    }
  }

  /**
   * Part of the fluent API to link a configured trigger to a target state.
   * @param state the state that this trigger configuration should use as target
   */
  goesTo(state: TState): StateConfiguration<TState, TTrigger, TContext> {
    this.throwOnFunc('A trigger cannot both have a target state and code that should be executed');
    this.throwOnIgnore('A trigger cannot both have a target state and be ignored');
    this._targetStateConfiguration = this._stateConfiguration._stateMachine.state(state);
    return this._stateConfiguration;
  }

  /**
   * Part of the fluent API to link a configured trigger to execute a function. The state machine will
   * remain in its current state.
   * @param func the function that should be executed when a trigger is fired on the current configured state
   */
  execute(func: (context: TContext) => Promise<void>): StateConfiguration<TState, TTrigger, TContext> {
    this.throwOnTarget('A trigger cannot both have a target state and code that should be executed');
    this.throwOnIgnore('A trigger cannot both be ignored and have code that should be executed');
    this._func = func;
    return this._stateConfiguration;
  }

  ignore(): StateConfiguration<TState, TTrigger, TContext> {
    this.throwOnFunc('A trigger cannot both be ignored and have code that should be executed');
    this.throwOnTarget('A trigger cannot both be ignored and have a target state');
    this._isIgnored = true;
    return this._stateConfiguration;
  }
}